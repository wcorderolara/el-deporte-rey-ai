/**
 * Cost estimate and computed cost of a generation (PD-ARCH-01G-B section 15). No price is fixed in code: both come from
 * the configured model (`pricing`, `publishedImageCosts`), copied from the provider's published list with the date it
 * was checked.
 *
 * - Estimate: the published output cost of one image of the quality and orientation, times the count; `unavailable`
 *   when the provider publishes no such figure. It is shown as an estimate, never as the final cost: input images,
 *   the prompt text and non-standard sizes change the real cost.
 * - Computed cost: the token usage the provider reports, priced with the configured per-million prices; null when the
 *   usage or a needed price is missing. It is still the provider's invoice that is authoritative.
 */
import type { DesignCostEstimate } from '@edr/contracts';

import type { ImageModel, ImageUsage } from '../../providers/images/index.js';

import { orientationOf } from './sizes.js';

const UNAVAILABLE: DesignCostEstimate = Object.freeze({
  status: 'unavailable',
  currency: null,
  perImage: null,
  total: null,
  basis: 'none',
  pricingSource: null,
  pricingCheckedOn: null,
});

/** Rounds a dollar amount to millionths, so that sums stay stable. */
export function roundAmount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function estimateCost(
  model: ImageModel,
  quality: string,
  width: number,
  height: number,
  count: number,
): DesignCostEstimate {
  const perImage = model.publishedImageCosts?.[quality]?.[orientationOf(width, height)];
  if (perImage === undefined || model.pricing === null) {
    return UNAVAILABLE;
  }
  return {
    status: 'estimated',
    currency: 'USD',
    perImage,
    total: roundAmount(perImage * count),
    basis: 'published_output_cost',
    pricingSource: model.pricing.source,
    pricingCheckedOn: model.pricing.checkedOn,
  };
}

/** The cost of one reported usage, or null when it cannot be computed from verifiable figures. */
export function computedCost(model: ImageModel, usage: ImageUsage | null): number | null {
  const pricing = model.pricing;
  if (pricing === null || usage === null || usage.outputImageTokens === null) {
    return null;
  }
  const textOut = usage.outputTextTokens ?? 0;
  if (textOut > 0 && pricing.textOutputPerMillionTokens === null) {
    return null;
  }
  const total =
    ((usage.inputTextTokens ?? 0) * pricing.textInputPerMillionTokens +
      (usage.inputImageTokens ?? 0) * pricing.imageInputPerMillionTokens +
      usage.outputImageTokens * pricing.imageOutputPerMillionTokens +
      textOut * (pricing.textOutputPerMillionTokens ?? 0)) /
    1_000_000;
  return roundAmount(total);
}

/** Sums two usages field by field (a missing count stays missing only when both are). */
export function addUsage(a: ImageUsage | null, b: ImageUsage | null): ImageUsage | null {
  if (a === null) return b;
  if (b === null) return a;
  const sum = (x: number | null, y: number | null) => (x === null && y === null ? null : (x ?? 0) + (y ?? 0));
  return {
    inputTextTokens: sum(a.inputTextTokens, b.inputTextTokens),
    inputImageTokens: sum(a.inputImageTokens, b.inputImageTokens),
    outputImageTokens: sum(a.outputImageTokens, b.outputImageTokens),
    outputTextTokens: sum(a.outputTextTokens, b.outputTextTokens),
    totalTokens: sum(a.totalTokens, b.totalTokens),
  };
}
