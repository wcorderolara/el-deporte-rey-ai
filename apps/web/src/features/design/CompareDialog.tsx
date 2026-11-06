import type { DesignProposal } from '@edr/contracts';

import { Badge, Modal } from '../../ui';
import { PreviewImage } from '../brand/PreviewImage';
import { contentTypeLabel, designCopy, proposalStatusLabel, proposalStatusTone } from './copy';
import type { DesignApi } from './designApi';

export interface CompareDialogProps {
  api: DesignApi;
  proposals: readonly DesignProposal[];
  onClose: () => void;
}

/** Side-by-side comparison of 2 to 4 proposals (PD-ARCH-01G-B section 17). */
export function CompareDialog({ api, proposals, onClose }: CompareDialogProps) {
  return (
    <Modal title={designCopy.compareTitle} onClose={onClose} size="lg">
      <ul
        className={`m-0 grid list-none gap-4 p-0 ${proposals.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}
        aria-label={designCopy.compareTitle}
      >
        {proposals.map((proposal) => (
          <li key={proposal.id} className="grid content-start gap-2">
            <span className="grid place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas">
              <PreviewImage
                key={proposal.id}
                src={api.proposalFileUrl(proposal.id)}
                alt={designCopy.previewAlt(proposal.name)}
                failedText={designCopy.previewFailed}
                className="h-auto w-full object-contain"
                width={proposal.width}
                height={proposal.height}
              />
            </span>
            <strong className="break-words text-body-sm text-text-primary">{proposal.name}</strong>
            <span className="flex flex-wrap gap-1.5">
              <Badge tone={proposalStatusTone[proposal.status]}>{proposalStatusLabel[proposal.status]}</Badge>
              <Badge tone="neutral">{contentTypeLabel[proposal.contentType]}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
