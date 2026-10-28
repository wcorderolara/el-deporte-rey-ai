/**
 * Operator-attested labelling (PD-17, BR-17, OD-28, AD-38): content is labelled operator-attested when any fact it
 * uses is MANUALLY_APPROVED. The export manifest states the same with `operatorAttested: true`. The label is never
 * worded or styled as verification.
 */
import type { ExportDetail, SlideTrace } from '@edr/contracts';

/** True when a text segment of an exported element version refers to a MANUALLY_APPROVED fact. */
export function exportUsesAttestedFacts(detail: Pick<ExportDetail, 'elements'>): boolean {
  return detail.elements.some((element) =>
    element.version.fields.some((field) =>
      field.segments.some((segment) => segment.provenance === 'fact' && segment.factStatus === 'manually_approved'),
    ),
  );
}

/** True when a fact of an exported slide is MANUALLY_APPROVED. */
export function traceUsesAttestedFacts(trace: Pick<SlideTrace, 'facts'>): boolean {
  return trace.facts.some((fact) => fact.status === 'manually_approved');
}
