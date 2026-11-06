/**
 * Request and output sizes of a design proposal (PD-ARCH-01G-B; Image API size rules checked 2026-11-05).
 *
 * - A model with flexible sizes gets the exact aspect ratio: both edges multiples of 16, total pixels within the
 *   provider's bounds (1:1 1024x1024, 4:5 1024x1280, 9:16 1008x1792).
 * - A model with standard sizes only gets the closest standard size (1024x1024 or the 2:3 portrait 1024x1536), and
 *   the stored proposal is a centred crop of it at the target ratio (4:5 1024x1280, 9:16 864x1536): the design is cut,
 *   never stretched.
 */
import type { DesignFormat } from '@edr/contracts';

export type Adaptation = 'none' | 'center_crop';

export interface ProposalSize {
  /** `WIDTHxHEIGHT` sent to the provider. */
  readonly requestSize: string;
  readonly requestWidth: number;
  readonly requestHeight: number;
  /** Size of the stored proposal. */
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly adaptation: Adaptation;
}

const FLEXIBLE: Readonly<Record<DesignFormat, readonly [number, number]>> = {
  '1:1': [1024, 1024],
  '4:5': [1024, 1280],
  '9:16': [1008, 1792],
};

const STANDARD: Readonly<
  Record<DesignFormat, { request: readonly [number, number]; output: readonly [number, number] }>
> = {
  '1:1': { request: [1024, 1024], output: [1024, 1024] },
  '4:5': { request: [1024, 1536], output: [1024, 1280] },
  '9:16': { request: [1024, 1536], output: [864, 1536] },
};

/** The sizes of a format for a model with or without flexible sizes. */
export function proposalSize(format: DesignFormat, flexibleSizes: boolean): ProposalSize {
  if (flexibleSizes) {
    const [width, height] = FLEXIBLE[format];
    return {
      requestSize: `${String(width)}x${String(height)}`,
      requestWidth: width,
      requestHeight: height,
      outputWidth: width,
      outputHeight: height,
      adaptation: 'none',
    };
  }
  const { request, output } = STANDARD[format];
  return {
    requestSize: `${String(request[0])}x${String(request[1])}`,
    requestWidth: request[0],
    requestHeight: request[1],
    outputWidth: output[0],
    outputHeight: output[1],
    adaptation: request[0] === output[0] && request[1] === output[1] ? 'none' : 'center_crop',
  };
}

/** The orientation of a size, for the published per-image cost tables. */
export function orientationOf(width: number, height: number): 'square' | 'portrait' | 'landscape' {
  return width === height ? 'square' : height > width ? 'portrait' : 'landscape';
}
