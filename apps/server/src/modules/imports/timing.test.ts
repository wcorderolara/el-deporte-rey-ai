/**
 * Linear-time assurance of the CSV parser and the JSON pre-scan (SC-05 option A, PD-15; security/design-review-
 * change-1.md section 6.3 condition 2; V-44, NV-12).
 *
 * For every worst-case shape of the adversarial corpus, the median time of one parse of a 512 KiB input must stay
 * within a fixed multiple of the median time at 64 KiB. Linear time gives a ratio of about 8 (eight times the input);
 * quadratic time would give about 64. The bound is `MAX_RATIO` = 24 (three times the linear ratio), fixed here and
 * never raised to make a run pass: a failure means option B (a worker thread) must be planned (MED-05).
 *
 * Measurements: samples of 64 KiB and 512 KiB runs are interleaved (so host load affects both sizes alike); each
 * 64 KiB sample averages 8 consecutive parses and each 512 KiB sample is one parse, so both sizes measure about the
 * same amount of work per sample; after warm-up runs, the median of `SAMPLES` samples is taken. The numbers are
 * printed for the task report.
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
const SMALL_REPEATS = 8;
const WARM_UP = 3;
const SAMPLES = 11;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

/** Median milliseconds of one run of `work` on each input, sizes interleaved. */
function measure(work: (input: string) => void, small: string, large: string): { small: number; large: number } {
  const timeOf = (input: string, repeats: number): number => {
    const start = performance.now();
    for (let index = 0; index < repeats; index += 1) {
      work(input);
    }
    return (performance.now() - start) / repeats;
  };
  for (let index = 0; index < WARM_UP; index += 1) {
    timeOf(small, SMALL_REPEATS);
    timeOf(large, 1);
  }
  const smallSamples: number[] = [];
  const largeSamples: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    smallSamples.push(timeOf(small, SMALL_REPEATS));
    largeSamples.push(timeOf(large, 1));
  }
  return { small: median(smallSamples), large: median(largeSamples) };
}

const results: string[] = [];

function check(kind: string, shape: string, work: (input: string) => void, generate: (size: number) => string): void {
  const small = generate(SMALL);
  const large = generate(CAP);
  expect(large.length).toBeGreaterThan(0.9 * CAP);
  expect(large.length).toBeLessThanOrEqual(CAP);
  const { small: tSmall, large: tLarge } = measure(work, small, large);
  // Below timer resolution a ratio is meaningless; 1 microsecond is far below any measured 64 KiB parse.
  const ratio = tLarge / Math.max(tSmall, 0.001);
  results.push(
    `${kind} | ${shape} | 64 KiB ${tSmall.toFixed(3)} ms | 512 KiB ${tLarge.toFixed(3)} ms | ratio ${ratio.toFixed(2)}`,
  );
  expect(ratio).toBeLessThanOrEqual(MAX_RATIO);
}

describe('linear time at the cap (NV-12)', () => {
  it.each(Object.entries(CSV_SHAPES))('CSV parser: %s', (shape, generate) => {
    check('csv', shape, (input) => parseCsv(input, new ImportErrorList('file')), generate);
  });

  it.each(Object.entries(JSON_SHAPES))('JSON pre-scan: %s', (shape, generate) => {
    check('json-prescan', shape, (input) => prescanJson(input, new ImportErrorList('file')), generate);
  });

  it('prints the measurements', () => {
    console.info(`[T50 timing] bound ${String(MAX_RATIO)}\n${results.join('\n')}`);
    expect(results).toHaveLength(Object.keys(CSV_SHAPES).length + Object.keys(JSON_SHAPES).length);
  });
});
