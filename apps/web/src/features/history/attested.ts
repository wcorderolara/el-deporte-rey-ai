/**
 * Operator-attested labelling (PD-17, BR-17, OD-28, AD-38): content is labelled operator-attested when any fact it
 * uses is MANUALLY_APPROVED. The export manifest states the same with `operatorAttested: true`. The label is never
 * worded or styled as verification. The slide trace shows it; the export detail no longer does (UX-REVIEW-01, Product
 * Owner, 2026-11-11).
 */
import type { SlideTrace } from '@edr/contracts';

/** True when a fact of an exported slide is MANUALLY_APPROVED. */
export function traceUsesAttestedFacts(trace: Pick<SlideTrace, 'facts'>): boolean {
  return trace.facts.some((fact) => fact.status === 'manually_approved');
}
