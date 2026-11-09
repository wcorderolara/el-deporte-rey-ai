import type {
  DesignGeneration,
  DesignGenerationStart,
  DesignMode,
  DesignModelAccess,
  DesignProposal,
  DesignProposalDetail,
  DesignProposalStatus,
} from '@edr/contracts';
import { useCallback, useId, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Icon,
  IconButton,
  LoadingState,
  Modal,
  ModalFooter,
  Select,
  ViewModeToggle,
  formatDateTime,
} from '../../ui';
import type { BrandApi } from '../brand/brandApi';
import { PreviewImage } from '../brand/PreviewImage';
import { useResource } from '../brand/useResource';
import { CompareDialog } from './CompareDialog';
import {
  contentTypeLabel,
  designCopy,
  guideCopy,
  modeBadge,
  modeLabel,
  proposalStatusLabel,
  proposalStatusTone,
  roleLabel,
} from './copy';
import { CreateDesignDialog } from './CreateDesignDialog';
import type { DesignApi } from './designApi';
import { GenerationProgress } from './GenerationProgress';
import { ModeGuide } from './ModeGuide';
import { ProposalDetailDialog } from './ProposalDetailDialog';

export interface DesignProposalsSectionProps {
  api: DesignApi;
  brandApi: BrandApi;
  /** Opens "Crear plantilla" with an approved proposal (PD-ARCH-01G-C). */
  onCreateTemplate?: (proposal: DesignProposal) => void;
}

const STATUSES: readonly DesignProposalStatus[] = ['pending_review', 'approved', 'changes_requested', 'rejected'];
const MAX_COMPARE = 4;

function Thumbnail({ api, proposal, size }: { api: DesignApi; proposal: DesignProposal; size: 'sm' | 'lg' }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas ${size === 'sm' ? 'h-16 w-14' : 'aspect-[4/5] w-full'}`}
    >
      <PreviewImage
        key={proposal.id}
        src={api.proposalFileUrl(proposal.id)}
        alt={designCopy.previewAlt(proposal.name)}
        failedText={designCopy.previewFailed}
        className="absolute inset-0 h-full w-full object-contain"
        width={proposal.width}
        height={proposal.height}
      />
    </span>
  );
}

function referencesText(proposal: DesignProposal): string {
  return proposal.references.length === 0
    ? designCopy.noReferences
    : proposal.references.map((reference) => `${reference.label} (${roleLabel[reference.role]})`).join(', ');
}

/**
 * AI design proposals inside Plantillas (PD-ARCH-01G-B section 17): the provider status and usage, "Crear diseño con
 * IA", the running generations, and the proposal library (table by default, cards, status filter) with comparison,
 * detail, review and variants. Proposals are shown apart from the templates and are never offered as templates.
 */
export function DesignProposalsSection({ api, brandApi, onCreateTemplate }: DesignProposalsSectionProps) {
  const headingId = useId();
  const loadCapabilities = useCallback((signal: AbortSignal) => api.getCapabilities(signal), [api]);
  const capabilities = useResource(loadCapabilities);
  const loadProposals = useCallback((signal: AbortSignal) => api.listProposals(signal), [api]);
  const proposals = useResource(loadProposals);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [status, setStatus] = useState<DesignProposalStatus | ''>('');
  const [modeFilter, setModeFilter] = useState<DesignMode | ''>('');
  const [creating, setCreating] = useState<{ parent: DesignProposalDetail | null; instructions?: string } | null>(null);
  const [running, setRunning] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [access, setAccess] = useState<DesignModelAccess | null>(null);
  const [deleting, setDeleting] = useState<DesignProposal | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteFailure, setDeleteFailure] = useState<unknown>(null);
  const [announcement, setAnnouncement] = useState('');
  const [checking, setChecking] = useState(false);

  const ready = capabilities.state.status === 'ready' ? capabilities.state.data : null;
  const all = proposals.state.status === 'ready' ? proposals.state.data : [];
  const shown = all.filter(
    (proposal) => (status === '' || proposal.status === status) && (modeFilter === '' || proposal.mode === modeFilter),
  );

  const reloadProposals = proposals.reload;
  const reloadCapabilities = capabilities.reload;
  const changed = useCallback(
    (generation: DesignGeneration) => {
      if (generation.status === 'completed' || generation.status === 'failed' || generation.completedCount > 0) {
        reloadProposals();
      }
      if (generation.status === 'completed' || generation.status === 'failed') {
        reloadCapabilities();
      }
    },
    [reloadProposals, reloadCapabilities],
  );

  function started(start: DesignGenerationStart) {
    setCreating(null);
    setRunning((current) => (current.includes(start.generation.id) ? current : [start.generation.id, ...current]));
  }

  function decided(proposal: DesignProposal) {
    proposals.update((current) => current.map((item) => (item.id === proposal.id ? proposal : item)));
  }

  function askDelete(proposal: DesignProposal) {
    setOpen(null);
    setDeleteFailure(null);
    setDeleting(proposal);
  }

  async function confirmDelete() {
    if (deleting === null || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteFailure(null);
    try {
      await api.deleteProposal(deleting.id);
      proposals.update((current) => current.filter((item) => item.id !== deleting.id));
      setSelected((current) => current.filter((id) => id !== deleting.id));
      setAnnouncement(designCopy.deleted(deleting.name));
      setDeleting(null);
    } catch (error) {
      setDeleteFailure(error);
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= MAX_COMPARE
          ? current
          : [...current, id],
    );
  }

  async function checkAccess() {
    if (ready?.defaultModel === null || ready === null) return;
    setChecking(true);
    try {
      setAccess(await api.checkModelAccess(ready.defaultModel));
    } catch {
      setAccess({ model: ready.defaultModel, access: 'error', errorCode: null });
    } finally {
      setChecking(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid max-w-reading gap-2">
          <h2 id={headingId} className="m-0 font-display text-heading-sm font-extrabold text-text-primary">
            {designCopy.heading}
          </h2>
          <p className="m-0 text-body-sm text-text-secondary">{designCopy.intro}</p>
          <p className="m-0 text-caption text-text-subtle">{designCopy.separation}</p>
          <details className="rounded-xl border border-border-subtle p-3">
            <summary className="cursor-pointer text-body-sm font-bold text-text-primary">{guideCopy.title}</summary>
            <div className="mt-3">
              <ModeGuide />
            </div>
          </details>
        </div>
        <Button disabled={ready?.status !== 'ready'} onClick={() => setCreating({ parent: null })}>
          <span aria-hidden="true">✦</span>
          {designCopy.create}
        </Button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {capabilities.state.status === 'error' ? (
        <ErrorBanner
          error={capabilities.state.error}
          title={designCopy.capabilitiesFailedTitle}
          onRetry={capabilities.reload}
        />
      ) : null}
      {ready?.status === 'disabled' ? <Alert tone="warning">{designCopy.statusDisabled}</Alert> : null}
      {ready?.status === 'missing_api_key' ? <Alert tone="warning">{designCopy.statusMissingKey}</Alert> : null}
      {ready !== null && ready.status !== 'disabled' ? (
        <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
          <Badge tone="neutral">{designCopy.usage(ready.limits.imagesUsedToday, ready.limits.maxImagesPerDay)}</Badge>
          {ready.limits.spentThisMonth === null ? null : (
            <Badge tone="neutral">{designCopy.spent(ready.limits.spentThisMonth)}</Badge>
          )}
          {ready.status === 'ready' ? (
            <Button
              size="sm"
              variant="secondary"
              isLoading={checking}
              loadingLabel={designCopy.checking}
              onClick={() => void checkAccess()}
            >
              {designCopy.checkAccess}
            </Button>
          ) : null}
          {access === null ? null : (
            <span role="status" className={access.access === 'available' ? 'text-success' : 'text-warning'}>
              {designCopy.access[access.access]}
            </span>
          )}
        </div>
      ) : null}

      {running.map((generationId) => (
        <GenerationProgress
          key={generationId}
          api={api}
          generationId={generationId}
          onChange={changed}
          onDismiss={() => setRunning((current) => current.filter((id) => id !== generationId))}
        />
      ))}

      {proposals.state.status === 'loading' ? <LoadingState layout="panel" label={designCopy.loading} /> : null}
      {proposals.state.status === 'error' ? (
        <ErrorBanner error={proposals.state.error} title={designCopy.loadFailedTitle} onRetry={proposals.reload} />
      ) : null}
      {proposals.state.status === 'ready' && all.length === 0 ? (
        <EmptyState headingLevel={3} title={designCopy.empty} description={designCopy.emptyDescription} icon="✦" />
      ) : null}
      {proposals.state.status === 'ready' && all.length > 0 ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              id={`${headingId}-status`}
              label={designCopy.filterStatus}
              value={status}
              wrapperClassName="min-w-48"
              onChange={(event) => setStatus(event.target.value as DesignProposalStatus | '')}
            >
              <option value="">{designCopy.allStatuses}</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {proposalStatusLabel[value]}
                </option>
              ))}
            </Select>
            <Select
              id={`${headingId}-mode`}
              label={designCopy.filterMode}
              value={modeFilter}
              wrapperClassName="min-w-48"
              onChange={(event) => setModeFilter(event.target.value as DesignMode | '')}
            >
              <option value="">{designCopy.allModes}</option>
              {(['guided', 'own_prompt'] as const).map((value) => (
                <option key={value} value={value}>
                  {modeLabel[value]}
                </option>
              ))}
            </Select>
            <ViewModeToggle value={view} onChange={setView} />
            <Button variant="secondary" disabled={selected.length < 2} onClick={() => setComparing(true)}>
              {designCopy.compare(selected.length)}
            </Button>
            <span className="text-caption text-text-subtle">{designCopy.compareHint}</span>
          </div>
          <p className="m-0 text-body-sm text-text-secondary" aria-live="polite">
            {designCopy.count(shown.length, all.length)}
          </p>
          {view === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">{designCopy.tableCaption}</caption>
                <thead>
                  <tr className="border-b border-border-subtle text-caption text-text-secondary">
                    <th scope="col" className="px-3 py-3">
                      <span className="sr-only">{designCopy.compareTitle}</span>
                    </th>
                    {[
                      designCopy.columns.preview,
                      designCopy.columns.name,
                      designCopy.filterMode,
                      designCopy.columns.type,
                      designCopy.columns.format,
                      designCopy.columns.date,
                      designCopy.columns.status,
                      designCopy.columns.model,
                      designCopy.columns.references,
                    ].map((column) => (
                      <th key={column} scope="col" className="px-3 py-3">
                        {column}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-right">
                      {designCopy.columns.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((proposal) => (
                    <tr key={proposal.id} className="border-b border-border-subtle align-middle last:border-0">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={designCopy.select(proposal.name)}
                          checked={selected.includes(proposal.id)}
                          disabled={!selected.includes(proposal.id) && selected.length >= MAX_COMPARE}
                          onChange={() => toggle(proposal.id)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Thumbnail api={api} proposal={proposal} size="sm" />
                      </td>
                      <th scope="row" className="px-3 py-3 text-body-sm font-bold text-text-primary">
                        {proposal.name}
                        {proposal.parentProposalId === null ? null : (
                          <small className="block font-normal text-text-secondary">{designCopy.variantOf}</small>
                        )}
                      </th>
                      <td className="px-3 py-3">
                        <Badge tone={proposal.mode === 'own_prompt' ? 'attested' : 'neutral'}>
                          {modeBadge[proposal.mode]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {contentTypeLabel[proposal.contentType]}
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">{proposal.format}</td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {formatDateTime(proposal.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={proposalStatusTone[proposal.status]}>{proposalStatusLabel[proposal.status]}</Badge>
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">{proposal.model}</td>
                      <td className="px-3 py-3 text-caption text-text-secondary">{referencesText(proposal)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="inline-flex gap-2">
                          <IconButton label={designCopy.open(proposal.name)} onClick={() => setOpen(proposal.id)}>
                            <Icon name="eye" />
                          </IconButton>
                          <IconButton label={designCopy.delete(proposal.name)} onClick={() => askDelete(proposal)}>
                            <Icon name="trash" />
                          </IconButton>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul
              aria-label={designCopy.listLabel}
              className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3"
            >
              {shown.map((proposal) => (
                <li key={proposal.id} className="min-w-0">
                  <Card as="article" aria-label={proposal.name} className="flex h-full min-w-0 flex-col gap-3">
                    <Thumbnail api={api} proposal={proposal} size="lg" />
                    <div className="grid gap-1">
                      <p className="m-0 text-caption font-bold tracking-label text-info uppercase">
                        {contentTypeLabel[proposal.contentType]} · {proposal.format}
                      </p>
                      <h3 className="m-0 break-words text-body-lg font-bold text-text-primary">{proposal.name}</h3>
                      <p className="m-0 text-caption text-text-secondary">
                        {formatDateTime(proposal.createdAt)} · {proposal.model}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={proposalStatusTone[proposal.status]}>{proposalStatusLabel[proposal.status]}</Badge>
                      <Badge tone={proposal.mode === 'own_prompt' ? 'attested' : 'neutral'}>
                        {modeBadge[proposal.mode]}
                      </Badge>
                      {proposal.parentProposalId === null ? null : <Badge tone="info">{designCopy.variantOf}</Badge>}
                    </span>
                    <p className="m-0 text-caption text-text-secondary">{referencesText(proposal)}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={designCopy.open(proposal.name)}
                        onClick={() => setOpen(proposal.id)}
                      >
                        Ver detalle
                      </Button>
                      <IconButton label={designCopy.delete(proposal.name)} onClick={() => askDelete(proposal)}>
                        <Icon name="trash" />
                      </IconButton>
                      <label className="flex items-center gap-2 text-caption text-text-secondary">
                        <input
                          type="checkbox"
                          checked={selected.includes(proposal.id)}
                          disabled={!selected.includes(proposal.id) && selected.length >= MAX_COMPARE}
                          onChange={() => toggle(proposal.id)}
                        />
                        <span>{designCopy.select(proposal.name)}</span>
                      </label>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {creating !== null && ready !== null ? (
        <CreateDesignDialog
          api={api}
          brandApi={brandApi}
          capabilities={ready}
          parent={creating.parent}
          {...(creating.instructions === undefined ? {} : { initialInstructions: creating.instructions })}
          onClose={() => setCreating(null)}
          onStarted={started}
        />
      ) : null}
      {open === null ? null : (
        <ProposalDetailDialog
          key={open}
          api={api}
          proposalId={open}
          onClose={() => setOpen(null)}
          onDecided={decided}
          currentPromptVersion={ready?.promptVersion ?? ''}
          onVariant={(detail, instructions) => {
            setOpen(null);
            setCreating({ parent: detail, ...(instructions === undefined ? {} : { instructions }) });
          }}
          onDelete={askDelete}
          {...(onCreateTemplate === undefined
            ? {}
            : {
                onCreateTemplate: (proposal: DesignProposal) => {
                  setOpen(null);
                  onCreateTemplate(proposal);
                },
              })}
        />
      )}
      {deleting === null ? null : (
        <Modal title={designCopy.deleteTitle} onClose={() => setDeleting(null)} closeDisabled={deleteBusy}>
          <div className="grid gap-4">
            <p className="m-0 text-body-md text-text-primary">{designCopy.deleteQuestion(deleting.name)}</p>
            <p className="m-0 text-body-sm text-text-secondary">{designCopy.deleteNote}</p>
            {deleteFailure === null ? null : <ErrorBanner error={deleteFailure} title={designCopy.deleteFailedTitle} />}
            <ModalFooter onCancel={() => setDeleting(null)} cancelDisabled={deleteBusy}>
              <Button
                variant="danger"
                isLoading={deleteBusy}
                loadingLabel={designCopy.deleting}
                onClick={() => void confirmDelete()}
              >
                {designCopy.deleteConfirm}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      )}
      {comparing ? (
        <CompareDialog
          api={api}
          proposals={selected
            .map((id) => all.find((proposal) => proposal.id === id))
            .filter((proposal): proposal is DesignProposal => proposal !== undefined)}
          onClose={() => setComparing(false)}
        />
      ) : null}
    </section>
  );
}
