/**
 * Export eligibility of an editorial version (REVIEW-APPROVAL-01; PD-33 as amended, option A: independent approvals).
 *
 * A version of a deliverable goes into a carousel's export when it is the current version, it is approved, it has no
 * flag, and every fact it rests on is publishable now (`blockingFactRefs`, the rule its approval applied). An approved
 * version whose facts stopped being publishable stays approved, but it is not exportable until it is reviewed.
 *
 * The export (`export/service.ts`) and the editorial package (`EditorialDeliverableState.exportable`, shown by the
 * final approval dialog) both use this function, so the dialog, the backend and the ZIP never disagree. The export
 * checks it again when it writes the files, because eligibility can change after the dialog is shown. No network, no
 * provider.
 */
import type { Language } from '@edr/contracts';

import { type PublishabilityContext, blockingFactRefs } from '../content/index.js';

/** What eligibility needs of a stored editorial version. */
export interface EditorialVersionEligibility {
  readonly approvedAt: string | null;
  readonly supersededAt: string | null;
  readonly flagCount: number;
  readonly factIds: readonly string[];
}

/** True when the version goes into an export (see the module notes). */
export function editorialExportable(
  context: PublishabilityContext,
  projectId: string,
  language: Language,
  version: EditorialVersionEligibility,
): boolean {
  if (version.supersededAt !== null || version.approvedAt === null || version.flagCount > 0) {
    return false;
  }
  return blockingFactRefs(context, projectId, language, version.factIds).length === 0;
}
