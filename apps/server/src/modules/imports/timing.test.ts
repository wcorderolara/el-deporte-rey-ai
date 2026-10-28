/**
 * Linear-time assurance of the CSV parser and the JSON pre-scan (SC-05 option A, PD-15; security/design-review-
 * change-1.md section 6.3 condition 2; V-44, NV-12), made robust to host load (T67, OD-64).
 *
 * For every worst-case shape of the adversarial corpus, the time of one parse of a 512 KiB input must stay within a
 * fixed multiple of the time at 64 KiB. Linear time gives a ratio of about 8 (eight times the input); quadratic time
 * would give about 64. The bound is `MAX_RATIO` = 24 (three times the linear ratio), fixed here and never raised to
 * make a run pass: a failure means option B (a worker thread) must be planned (MED-05).
 *
 * Method (one attempt of the comparison):
 * - the 64 KiB and 512 KiB runs are interleaved round by round, and the order inside a round alternates, so host
 *   load, frequency changes, core migration and garbage left by the previous run fall on both sizes alike;
 * - each 64 KiB sample averages `SMALL_REPEATS` (8) consecutive parses and each 512 KiB sample is one parse, so a
 *   sample of either size takes about the same wall time and is equally exposed to interruptions;
 * - `WARM_UP` rounds are discarded, then `SAMPLES` rounds are measured;
 * - the time of each size is the minimum of its samples. Load only ever adds time to a sample, so the minimum is the
 *   sample closest to the parser's own cost; a median moves with load, which made the T50 version fail once
 *   (ratio 32.0 under parallel load);
 * - ratio = min(512 KiB) / min(64 KiB), compared with `MAX_RATIO`.
 *
 * Steadiness and bounded retry. The minimum is trustworthy when several samples sit close to it: a size is steady
 * when its lower-quartile sample is within `STEADY_SPREAD` of its minimum. An attempt is conclusive when
 * - it passes (ratio <= MAX_RATIO) and the 64 KiB measurement (the denominator, whose inflation could hide a
 *   super-linear parser) is steady; or
 * - it fails (ratio > MAX_RATIO) and the 512 KiB measurement (the numerator, whose inflation could fake a failure)
 *   is steady.
 * A conclusive attempt is counted. An inconclusive attempt is discarded and the whole comparison is measured again
 * from fresh samples, at most `MAX_RETRIES` (2) times; the last attempt is counted whatever its steadiness. Samples
 * are never mixed across attempts, the bound is the same in every attempt, and the counted attempt must pass.
 *
 * Why this cannot let a quadratic parser pass. A quadratic parser costs about 64 times more at 512 KiB, so its
 * measured ratio can drop to 24 or below only if min(64 KiB) is inflated by at least 64 / 24 (about 2.7 times) in
 * every one of the `SAMPLES` small samples while at least one large sample, taken in the same rounds and of the
 * same duration, is not; the minimum of the large size cannot fall below the parser's own cost. Load that slows
 * every small sample slows the interleaved large samples too. A retry is spent only on an inconclusive attempt; a
 * steady failure is final at once. A retry can only replace an attempt with a fresh one held to the same bound; it
 * never averages, raises or skips anything. The positive control below (a seeded quadratic parser) runs the same
 * comparison and must fail it.
 *
 * The numbers of every attempt are printed for the task report.
 */
import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv/parser.js';
import { ImportErrorList } from './errors.js';
import { prescanJson } from './json/prescan.js';
import { CAP, CSV_SHAPES, JSON_SHAPES, KIB } from './test/corpus.js';

/** Fixed bound on t(512 KiB) / t(64 KiB). */
const MAX_RATIO = 24;
const SMALL = 64 * KIB;
/** Parses per 64 KiB sample, so that both sizes measure about the same work per sample (CAP / SMALL). */
const SMALL_REPEATS = 8;
const WARM_UP = 5;
const SAMPLES = 21;
/** A size is steady when its lower-quartile sample is at most this multiple of its minimum. */
const STEADY_SPREAD = 1.5;
/** Retries of the whole comparison after an inconclusive attempt (three attempts at most). */
const MAX_RETRIES = 2;
/** Below timer resolution a ratio is meaningless; 1 microsecond is far below any measured 64 KiB parse. */
const MIN_MEASURABLE_MS = 0.001;
/** Per-test time limit: up to three attempts of a shape, on a loaded host. */
const TEST_TIMEOUT_MS = 60_000;

interface SizeMeasurement {
  /** Minimum sample, milliseconds per parse. */
  readonly min: number;
  /** Lower-quartile sample, milliseconds per parse. */
  readonly q25: number;
  readonly steady: boolean;
}

interface Attempt {
  readonly small: SizeMeasurement;
  readonly large: SizeMeasurement;
  readonly ratio: number;
  readonly passes: boolean;
  readonly conclusive: boolean;
}

interface Comparison {
  /** Every attempt, in order; the last one is the counted one. */
  readonly attempts: readonly Attempt[];
  readonly counted: Attempt;
}

function summarize(samples: readonly number[]): SizeMeasurement {
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0] ?? Number.NaN;
  const q25 = sorted[Math.floor(sorted.length / 4)] ?? Number.NaN;
  return { min, q25, steady: q25 <= STEADY_SPREAD * min };
}

/** Milliseconds per run of `work` on `input`, averaged over `repeats` consecutive runs. */
function timeOf(work: (input: string) => void, input: string, repeats: number): number {
  const start = performance.now();
  for (let index = 0; index < repeats; index += 1) {
    work(input);
  }
  return (performance.now() - start) / repeats;
}

/** One attempt: interleaved rounds with alternating order, the minimum per size, the ratio and its steadiness. */
function attemptComparison(work: (input: string) => void, small: string, large: string): Attempt {
  const smallSamples: number[] = [];
  const largeSamples: number[] = [];
  for (let round = 0; round < WARM_UP + SAMPLES; round += 1) {
    let tSmall: number;
    let tLarge: number;
    if (round % 2 === 0) {
      tSmall = timeOf(work, small, SMALL_REPEATS);
      tLarge = timeOf(work, large, 1);
    } else {
      tLarge = timeOf(work, large, 1);
      tSmall = timeOf(work, small, SMALL_REPEATS);
    }
    if (round >= WARM_UP) {
      smallSamples.push(tSmall);
      largeSamples.push(tLarge);
    }
  }
  const smallSize = summarize(smallSamples);
  const largeSize = summarize(largeSamples);
  const ratio = largeSize.min / Math.max(smallSize.min, MIN_MEASURABLE_MS);
  const passes = ratio <= MAX_RATIO;
  return {
    small: smallSize,
    large: largeSize,
    ratio,
    passes,
    conclusive: passes ? smallSize.steady : largeSize.steady,
  };
}

/** The comparison with at most `MAX_RETRIES` retries after inconclusive attempts; the last attempt is counted. */
function compare(work: (input: string) => void, small: string, large: string): Comparison {
  const attempts: Attempt[] = [];
  for (;;) {
    const attempt = attemptComparison(work, small, large);
    attempts.push(attempt);
    if (attempt.conclusive || attempts.length > MAX_RETRIES) {
      return { attempts, counted: attempt };
    }
  }
}

function describeAttempt(attempt: Attempt, index: number, total: number): string {
  const size = (label: string, measurement: SizeMeasurement): string =>
    `${label} min ${measurement.min.toFixed(3)} ms q25 ${measurement.q25.toFixed(3)} ms${measurement.steady ? '' : ' (unsteady)'}`;
  return [
    `attempt ${String(index + 1)}/${String(total)}`,
    size('64 KiB', attempt.small),
    size('512 KiB', attempt.large),
    `ratio ${attempt.ratio.toFixed(2)}`,
    `${attempt.passes ? 'within' : 'above'} bound${attempt.conclusive ? '' : ', inconclusive'}`,
  ].join(' | ');
}

function record(lines: string[], kind: string, shape: string, comparison: Comparison): void {
  comparison.attempts.forEach((attempt, index) => {
    lines.push(`${kind} | ${shape} | ${describeAttempt(attempt, index, comparison.attempts.length)}`);
  });
}

function inputsOf(generate: (size: number) => string): { small: string; large: string } {
  const small = generate(SMALL);
  const large = generate(CAP);
  expect(large.length).toBeGreaterThan(0.9 * CAP);
  expect(large.length).toBeLessThanOrEqual(CAP);
  return { small, large };
}

const results: string[] = [];
const controls: string[] = [];

function check(kind: string, shape: string, work: (input: string) => void, generate: (size: number) => string): void {
  const { small, large } = inputsOf(generate);
  const comparison = compare(work, small, large);
  record(results, kind, shape, comparison);
  expect(comparison.attempts.length).toBeLessThanOrEqual(MAX_RETRIES + 1);
  expect(comparison.counted.ratio).toBeLessThanOrEqual(MAX_RATIO);
}

const QUOTE = 0x22;
const COMMA = 0x2c;
/**
 * Characters between two re-scans of the seeded defect. Character reads: 64 KiB 65 536 + 229 376 = 0.29 M,
 * 512 KiB 524 288 + 16 515 072 = 17.0 M.
 */
const DEFECT_STRIDE = 8192;
/** Keeps the result of the control parser observable, so the work cannot be optimized away. */
let controlSink = 0;

/**
 * Positive control: a CSV field scanner with a seeded quadratic defect. Instead of keeping the quoted-field state, it
 * recomputes it every `DEFECT_STRIDE` characters by counting the quotes from the start of the input, so its time
 * grows with the square of the input (expected ratio about 58: 17.0 M / 0.29 M character reads).
 */
function seededQuadraticScan(input: string): number {
  let separators = 0;
  let inQuotes = false;
  for (let index = 0; index < input.length; index += 1) {
    if (index % DEFECT_STRIDE === 0) {
      let quotes = 0;
      for (let back = 0; back < index; back += 1) {
        if (input.charCodeAt(back) === QUOTE) {
          quotes += 1;
        }
      }
      inQuotes = quotes % 2 === 1;
    }
    const code = input.charCodeAt(index);
    if (code === QUOTE) {
      inQuotes = !inQuotes;
    } else if (code === COMMA && !inQuotes) {
      separators += 1;
    }
  }
  return separators;
}

describe('linear time at the cap (NV-12)', () => {
  it.each(Object.entries(CSV_SHAPES))(
    'CSV parser: %s',
    (shape, generate) => {
      check('csv', shape, (input) => parseCsv(input, new ImportErrorList('file')), generate);
    },
    TEST_TIMEOUT_MS,
  );

  it.each(Object.entries(JSON_SHAPES))(
    'JSON pre-scan: %s',
    (shape, generate) => {
      check('json-prescan', shape, (input) => prescanJson(input, new ImportErrorList('file')), generate);
    },
    TEST_TIMEOUT_MS,
  );

  it('prints the measurements', () => {
    console.info(`[T67 timing] bound ${String(MAX_RATIO)}\n${results.join('\n')}`);
    expect(results.length).toBeGreaterThanOrEqual(Object.keys(CSV_SHAPES).length + Object.keys(JSON_SHAPES).length);
  });
});

describe('positive control: a seeded quadratic parser fails the same comparison', () => {
  // One CSV shape and the JSON shape that failed under load in T50, taken from the same corpus.
  const controlShapes = [
    ['csv: only double quotes', CSV_SHAPES['only double quotes']],
    ['json: long member names with escapes', JSON_SHAPES['long member names with escapes']],
  ] as const;

  it.each(controlShapes)(
    'seeded quadratic scan on %s',
    (shape, generate) => {
      expect(generate).toBeTypeOf('function');
      if (generate === undefined) {
        return;
      }
      const { small, large } = inputsOf(generate);
      const comparison = compare(
        (input) => {
          controlSink = (controlSink + seededQuadraticScan(input)) | 0;
        },
        small,
        large,
      );
      record(controls, 'seeded-quadratic', shape, comparison);
      expect(comparison.attempts.length).toBeLessThanOrEqual(MAX_RETRIES + 1);
      expect(comparison.counted.ratio).toBeGreaterThan(MAX_RATIO);
    },
    TEST_TIMEOUT_MS,
  );

  it('prints the control measurements', () => {
    console.info(
      `[T67 timing control] bound ${String(MAX_RATIO)} (sink ${String(controlSink)})\n${controls.join('\n')}`,
    );
    expect(controls.length).toBeGreaterThanOrEqual(2);
  });
});
