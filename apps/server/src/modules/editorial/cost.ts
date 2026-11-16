/**
 * Cost of an editorial generation (PD-ARCH-01H, PD-30). No price is fixed in code: both figures use the configured
 * prices of the writer, copied from the provider's published list with the date they were checked; the provider's
 * invoice stays authoritative.
 *
 * - Estimate (before the request, the reserve the monthly limit is checked against): an upper bound. Every token
 *   covers at least one byte of the prompt, so the input tokens are at most the UTF-8 bytes of the system and user
 *   messages; the output tokens are at most `max_completion_tokens`. Null when the writer has no prices.
 * - Computed (after the answer): the reported input and output tokens times the prices; null when the usage or a
 *   price is missing. A billed generation without a computed cost counts its estimate in the monthly spend.
 */
import type { EditorialUsage, EditorialWriterDescription } from '../../providers/ai/index.js';

/** Rounds a dollar amount to millionths, so that sums stay stable. */
export function roundAmount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** The conservative estimate of one request whose prompt has `promptBytes` bytes; null without prices. */
export function estimateCost(writer: EditorialWriterDescription, promptBytes: number): number | null {
  if (!writer.billed) {
    return 0;
  }
  if (writer.pricing === null || writer.maxOutputTokens === null) {
    return null;
  }
  const { inputPerMillionTokens, outputPerMillionTokens } = writer.pricing;
  return roundAmount(
    (promptBytes * inputPerMillionTokens + writer.maxOutputTokens * outputPerMillionTokens) / 1_000_000,
  );
}

/** The cost of a reported usage, or null when it cannot be computed from verifiable figures. */
export function computedCost(writer: EditorialWriterDescription, usage: EditorialUsage | null): number | null {
  if (!writer.billed) {
    return 0;
  }
  if (writer.pricing === null || usage === null || usage.inputTokens === null || usage.outputTokens === null) {
    return null;
  }
  const { inputPerMillionTokens, outputPerMillionTokens } = writer.pricing;
  return roundAmount(
    (usage.inputTokens * inputPerMillionTokens + usage.outputTokens * outputPerMillionTokens) / 1_000_000,
  );
}

/** Start of the UTC day of an instant, as stored timestamps are compared (ISO strings). */
export function utcDayStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Start of the UTC month of an instant. */
export function utcMonthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
