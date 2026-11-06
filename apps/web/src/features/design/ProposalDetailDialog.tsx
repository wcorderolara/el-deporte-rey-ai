import {
  MAX_DESIGN_DECISION_NOTE,
  contractRegExp,
  type DesignDecision,
  type DesignProposal,
  type DesignProposalDetail,
} from '@edr/contracts';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Alert, Badge, Button, ErrorBanner, Icon, LoadingState, Modal, Textarea, formatDateTime } from '../../ui';
import { PreviewImage } from '../brand/PreviewImage';
import { useResource } from '../brand/useResource';
import {
  contentTypeLabel,
  designCopy,
  detailCopy,
  formatLabel,
  modeBadge,
  proposalStatusLabel,
  proposalStatusTone,
  qualityLabel,
  roleLabel,
  usd,
} from './copy';
import type { DesignApi } from './designApi';

export interface ProposalDetailDialogProps {
  api: DesignApi;
  proposalId: string;
  onClose: () => void;
  onDecided: (proposal: DesignProposal) => void;
  /** Opens a variant of the proposal, with the note of a change request as its new instructions. */
  onVariant: (detail: DesignProposalDetail, instructions?: string) => void;
  /** The prompt version the server uses now (capabilities). */
  currentPromptVersion: string;
  /** Asks to delete the proposal (the section confirms and deletes it). */
  onDelete: (proposal: DesignProposal) => void;
}

const NOTE = contractRegExp('Note');

/**
 * A proposal for review (PD-ARCH-01G-B section 18): the image, its data, the brand assets used with their role, the
 * prompt sent, the usage and computed cost, the decision history; approve, reject or request changes with a note,
 * and request a variant. A decision changes no template and no brand asset.
 */
export function ProposalDetailDialog({
  api,
  proposalId,
  onClose,
  onDecided,
  onVariant,
  onDelete,
  currentPromptVersion,
}: ProposalDetailDialogProps) {
  const noteId = useId();
  const load = useCallback((signal: AbortSignal) => api.getProposal(proposalId, signal), [api, proposalId]);
  const { state, reload, update } = useResource(load);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<DesignDecision | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [announcement, setAnnouncement] = useState('');
  const [showBackground, setShowBackground] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function decide(decision: DesignDecision) {
    const text = note.trim();
    if (decision === 'changes_requested' && text === '') {
      setNoteError(detailCopy.noteRequired);
      document.getElementById(noteId)?.focus();
      return;
    }
    if (text !== '' && (!NOTE.test(text) || [...text].length > MAX_DESIGN_DECISION_NOTE)) {
      setNoteError(
        [...text].length > MAX_DESIGN_DECISION_NOTE
          ? detailCopy.noteTooLong(MAX_DESIGN_DECISION_NOTE)
          : 'Usa solo texto imprimible.',
      );
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(decision);
    setFailure(null);
    setNoteError(undefined);
    try {
      const proposal = await api.decide(
        proposalId,
        { decision, ...(text === '' ? {} : { note: text }) },
        current.signal,
      );
      if (current.signal.aborted) return;
      update((detail) => ({
        ...detail,
        proposal,
        decisions: [
          ...detail.decisions,
          { decision, note: text === '' ? null : text, decidedAt: proposal.decidedAt ?? '' },
        ],
      }));
      setNote('');
      setAnnouncement(detailCopy.decided(proposalStatusLabel[proposal.status]));
      onDecided(proposal);
      if (decision === 'changes_requested' && state.status === 'ready') {
        onVariant({ ...state.data, proposal }, text);
      }
    } catch (error) {
      if (!current.signal.aborted) setFailure(error);
    } finally {
      if (!current.signal.aborted) setBusy(null);
    }
  }

  const detail = state.status === 'ready' ? state.data : null;
  return (
    <Modal
      title={detailCopy.title(detail?.proposal.name ?? '')}
      onClose={onClose}
      closeDisabled={busy !== null}
      size="lg"
    >
      {state.status === 'loading' ? <LoadingState layout="panel" label={designCopy.loading} /> : null}
      {state.status === 'error' ? (
        <ErrorBanner error={state.error} title={detailCopy.loadFailedTitle} onRetry={reload} />
      ) : null}
      {detail === null ? null : (
        <div className="grid gap-5">
          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>
          <div className="grid gap-5 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <figure className="m-0 grid place-items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-canvas p-2">
              <PreviewImage
                key={`${detail.proposal.id}-${showBackground ? 'background' : 'preview'}`}
                src={
                  showBackground
                    ? api.proposalBackgroundUrl(detail.proposal.id)
                    : api.proposalFileUrl(detail.proposal.id)
                }
                alt={designCopy.previewAlt(detail.proposal.name)}
                failedText={designCopy.previewFailed}
                className="h-auto max-h-[28rem] w-full object-contain"
                width={detail.proposal.width}
                height={detail.proposal.height}
              />
            </figure>
            <div className="grid content-start gap-4">
              {detail.hasBackground ? (
                <div>
                  <Button size="sm" variant="secondary" onClick={() => setShowBackground((value) => !value)}>
                    {showBackground ? detailCopy.showComposed : detailCopy.showBackground}
                  </Button>
                </div>
              ) : null}
              <span className="flex flex-wrap gap-2">
                <Badge tone={proposalStatusTone[detail.proposal.status]}>
                  {proposalStatusLabel[detail.proposal.status]}
                </Badge>
                <Badge tone={detail.proposal.mode === 'own_prompt' ? 'attested' : 'neutral'}>
                  {modeBadge[detail.proposal.mode]}
                </Badge>
                {detail.proposal.parentProposalId === null ? null : <Badge tone="info">{designCopy.variantOf}</Badge>}
                {detail.variantIds.length === 0 ? null : (
                  <Badge tone="neutral">{detailCopy.variants(detail.variantIds.length)}</Badge>
                )}
              </span>
              <dl aria-label={detailCopy.data} className="m-0 grid gap-2 text-body-sm sm:grid-cols-2">
                {[
                  [detailCopy.type, contentTypeLabel[detail.proposal.contentType]],
                  [detailCopy.format, formatLabel[detail.proposal.format]],
                  [detailCopy.size, `${String(detail.proposal.width)} × ${String(detail.proposal.height)} px`],
                  [
                    detailCopy.model,
                    `${detail.proposal.model} · ${qualityLabel[detail.proposal.quality] ?? detail.proposal.quality}`,
                  ],
                  [detailCopy.created, formatDateTime(detail.proposal.createdAt)],
                  [detailCopy.cost, detail.cost === null ? detailCopy.costUnknown : usd(detail.cost)],
                ].map(([term, value]) => (
                  <div key={term}>
                    <dt className="text-caption font-bold text-text-secondary">{term}</dt>
                    <dd className="m-0 break-words text-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
              {detail.layers.length === 0 ? null : (
                <section aria-label={detailCopy.layers} className="grid gap-1.5">
                  <h3 className="m-0 text-body-sm font-bold text-text-secondary">{detailCopy.layers}</h3>
                  <ul className="m-0 grid list-none gap-1 p-0 text-body-sm">
                    {detail.layers.map((layer) => (
                      <li key={layer.assetId} className="text-text-primary">
                        {layer.label}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section aria-label={detailCopy.references} className="grid gap-1.5">
                <h3 className="m-0 text-body-sm font-bold text-text-secondary">{detailCopy.references}</h3>
                {detail.proposal.references.length === 0 ? (
                  <p className="m-0 text-body-sm text-text-secondary">{designCopy.noReferences}</p>
                ) : (
                  <ul className="m-0 grid list-none gap-1 p-0 text-body-sm">
                    {detail.proposal.references.map((reference) => (
                      <li key={reference.assetId}>
                        <strong className="text-text-primary">{reference.label}</strong>{' '}
                        <span className="text-text-secondary">· {roleLabel[reference.role]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {detail.generation.mode === 'own_prompt' || detail.generation.promptVersion === currentPromptVersion ? (
            <p className="m-0 text-caption text-text-subtle">
              {detailCopy.promptVersion(detail.generation.promptVersion)}
            </p>
          ) : (
            <Alert tone="warning">{detailCopy.outdated(detail.generation.promptVersion, currentPromptVersion)}</Alert>
          )}
          <details className="rounded-xl border border-border-subtle bg-surface-card p-3 text-body-sm">
            <summary className="cursor-pointer font-bold text-text-primary">{detailCopy.promptTitle}</summary>
            <dl className="m-0 mt-2 grid gap-2">
              {[
                [detailCopy.style, detail.generation.style],
                [detailCopy.inherited, detail.generation.inheritedInstructions],
                [detailCopy.instructions, detail.generation.instructions],
              ]
                .filter((entry): entry is [string, string] => entry[1] !== null)
                .map(([term, value]) => (
                  <div key={term}>
                    <dt className="text-caption font-bold text-text-secondary">{term}</dt>
                    <dd className="m-0 whitespace-pre-line text-text-primary">{value}</dd>
                  </div>
                ))}
            </dl>
            <pre className="m-0 mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-caption text-text-secondary">
              {detail.generation.prompt}
            </pre>
          </details>

          <section aria-label={detailCopy.decisions} className="grid gap-2">
            <h3 className="m-0 text-body-lg font-bold text-text-primary">{detailCopy.decisions}</h3>
            {detail.decisions.length === 0 ? (
              <p className="m-0 text-body-sm text-text-secondary">{detailCopy.noDecisions}</p>
            ) : (
              <ol className="m-0 grid gap-1 pl-5 text-body-sm text-text-primary">
                {detail.decisions.map((decision, index) => (
                  <li key={`${decision.decidedAt}-${String(index)}`}>
                    {proposalStatusLabel[decision.decision]} · {formatDateTime(decision.decidedAt)}
                    {decision.note === null ? null : <span className="text-text-secondary"> — {decision.note}</span>}
                  </li>
                ))}
              </ol>
            )}
            <Textarea
              id={noteId}
              label={detailCopy.note}
              description={detailCopy.noteHint}
              value={note}
              rows={2}
              disabled={busy !== null}
              error={noteError}
              onChange={(event) => setNote(event.target.value)}
            />
            <p
              className={`m-0 text-caption ${[...note.trim()].length > MAX_DESIGN_DECISION_NOTE ? 'font-bold text-danger' : 'text-text-subtle'}`}
              aria-live="polite"
            >
              {detailCopy.noteCharacters([...note.trim()].length, MAX_DESIGN_DECISION_NOTE)}
            </p>
            <Alert tone="info">
              {detail.proposal.mode === 'own_prompt' ? detailCopy.ownPromptNote : detailCopy.approvalNote}
            </Alert>
            {failure === null ? null : <ErrorBanner error={failure} title={detailCopy.failedTitle} />}
            <div className="flex flex-wrap gap-3">
              <Button isLoading={busy === 'approved'} disabled={busy !== null} onClick={() => void decide('approved')}>
                {detailCopy.approve}
              </Button>
              <Button
                variant="secondary"
                isLoading={busy === 'changes_requested'}
                disabled={busy !== null}
                onClick={() => void decide('changes_requested')}
              >
                {detailCopy.requestChanges}
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={() => onVariant(detail)}>
                {detailCopy.variant}
              </Button>
              <Button
                variant="danger"
                isLoading={busy === 'rejected'}
                disabled={busy !== null}
                onClick={() => void decide('rejected')}
              >
                {detailCopy.reject}
              </Button>
              <Button
                variant="quiet"
                disabled={busy !== null}
                aria-label={designCopy.delete(detail.proposal.name)}
                onClick={() => onDelete(detail.proposal)}
              >
                <Icon name="trash" />
                {designCopy.deleteConfirm}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
