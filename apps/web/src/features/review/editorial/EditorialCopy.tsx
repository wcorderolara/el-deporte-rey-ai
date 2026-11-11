/**
 * «Copy editorial» of the review (PD-ARCH-01H; layout UX-REVIEW-01): a reading column (about 70 %) and an actions
 * column (about 30 %).
 *
 * - Tabs only for what exists: the editorial deliverables that have a version (Facebook / Instagram, TikTok / Reels,
 *   YouTube, Titulares virales, Pregunta de debate), «Copy para redes» while none exists yet, and the carousel's own
 *   text (the caption of the ZIP), reviewed with its element review.
 * - Each deliverable: read, copy a field or the whole text, edit and save, approve or withdraw (one approval per
 *   deliverable, DE-5), and regenerate it with an optional instruction. The package can be generated or regenerated
 *   whole and downloaded as .txt.
 * - Edits are kept per deliverable while switching tabs or review modes; leaving the page with unsaved edits asks
 *   first. An open edit holds the approval and the regeneration of that deliverable.
 * - «Investigación y fuentes» is a secondary panel, never mixed with the publishable text.
 *
 * The labels say who wrote the text («Texto de prueba (sin IA)» for the stub) and how («Generado con contexto
 * local»; never research that did not happen). A billed writer needs the operator's explicit cost confirmation before
 * every generation. Every guard runs on the server.
 */
import {
  EDITORIAL_DELIVERABLE_FIELDS,
  MAX_EDITORIAL_FIELD_TEXT,
  MAX_EDITORIAL_INSTRUCTIONS,
  type EditorialDeliverable,
  type EditorialEvidence,
  type EditorialFieldName,
  type EditorialPackage,
  type EditorialVersion,
  type Element,
} from '@edr/contracts';
import { useEffect, useId, useState, type ReactNode } from 'react';

import {
  Badge,
  Button,
  ErrorBanner,
  formatDateTime,
  Icon,
  Tabs,
  tabId,
  tabPanelId,
  Textarea,
  type TabOption,
} from '../../../ui';
import { ElementReview } from '../ElementReview';
import { elementStatus } from '../model';
import { UnsavedChangesGuard } from '../UnsavedChangesGuard';

import {
  DELIVERABLE_TAB_ORDER,
  deliverableLabel,
  deliverableTitle,
  editorialCopy,
  fieldLabel,
  flagText,
  originLabel,
  stateLabel,
  writerLabel,
} from './copy';
import { copyText, deliverableText, editorialFileName, editorialText, saveTextFile } from './download';
import type { EditorialPackageState } from './useEditorialPackage';

type CopyTab = EditorialDeliverable | 'social' | 'caption';

interface EditDraft {
  baseVersionId: string;
  fields: Partial<Record<EditorialFieldName, string>>;
}

function newRequestKey(): string {
  return globalThis.crypto.randomUUID();
}

function stateTone(state: EditorialVersion['state']): 'success' | 'warning' | 'neutral' | 'info' {
  return state === 'approved' ? 'success' : state === 'flagged' ? 'warning' : state === 'ready' ? 'info' : 'neutral';
}

/** Whitespace-separated words, the same count as the server's (PD-ARCH-01H). */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/u).length;
}

/** The counter that matters for a field: words for prose, characters for short lines, hashtags for hashtags. */
function fieldCounter(name: EditorialFieldName, words: number, characters: number): string {
  if (name === 'hashtags') return editorialCopy.hashtagCount(words);
  if (name === 'body' || name === 'copy' || name === 'description') return editorialCopy.words(words);
  return editorialCopy.characters(characters);
}

const eyebrow = 'm-0 text-caption font-bold tracking-label text-text-secondary uppercase';
const column =
  'grid min-h-0 min-w-0 content-start gap-5 rounded-panel border border-border-subtle bg-surface-raised p-5 lg:overflow-y-auto';
// Below the full-height layout the actions stay in view while the text scrolls.
const actionsColumn =
  'flex min-h-0 min-w-0 flex-col gap-4 rounded-panel border border-border-subtle bg-surface-raised p-4 md:sticky md:top-3 md:max-h-[calc(100dvh-1.5rem)] md:self-start md:overflow-y-auto lg:static lg:max-h-none lg:self-stretch';

function EvidenceList({ items, title }: { items: readonly EditorialEvidence[]; title: string }) {
  return (
    <section>
      <h4 className="m-0 mb-1 text-body-sm font-bold">{title}</h4>
      {items.length === 0 ? (
        <p className="m-0 text-body-sm text-text-secondary">{editorialCopy.none}</p>
      ) : (
        <ul className="m-0 grid list-none gap-1 p-0 text-body-sm">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.description}</span>
              <span className="block text-caption text-text-secondary">
                {item.source.name} · {editorialCopy.retrievedAt}:{' '}
                <time dateTime={item.retrievedAt}>{formatDateTime(item.retrievedAt)}</time>
              </span>
              {item.conflicts.map((conflict) => (
                <span key={conflict} className="block text-caption text-warning">
                  {conflict}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResearchPanel({ pkg }: { pkg: EditorialPackage }) {
  const { research } = pkg;
  return (
    <details className="max-w-reading rounded-card border border-border-subtle bg-surface-subtle p-4">
      <summary className="cursor-pointer font-bold">{editorialCopy.researchTitle}</summary>
      <div className="mt-3 grid gap-4">
        <p className="m-0 text-body-sm text-text-secondary">{editorialCopy.researchLocalNote}</p>
        <section>
          <h4 className="m-0 mb-1 text-body-sm font-bold">{editorialCopy.keyEvents}</h4>
          {research.keyEvents.length === 0 ? (
            <p className="m-0 text-body-sm text-text-secondary">{editorialCopy.noKeyEvents}</p>
          ) : (
            <ul className="m-0 grid list-disc gap-1 pl-5 text-body-sm">
              {research.keyEvents.map((event) => (
                <li key={event.id}>{event.description}</li>
              ))}
            </ul>
          )}
        </section>
        <EvidenceList items={research.evidence} title={editorialCopy.sources} />
        <EvidenceList items={research.unverified} title={editorialCopy.unverified} />
        <EvidenceList items={research.conflicts} title={editorialCopy.conflicts} />
      </div>
    </details>
  );
}

/** Who wrote the text and how, and the round note: once, above the text. */
function PackageContext({ pkg, title }: { pkg: EditorialPackage; title: string }) {
  const round = pkg.context?.roundState;
  return (
    <header className="grid max-w-reading gap-2">
      <h3 className="m-0 font-display text-heading-sm font-extrabold tracking-heading text-text-primary">{title}</h3>
      <div className="flex flex-wrap gap-2" aria-label="Origen del texto">
        <Badge tone={pkg.writer.kind === 'test' ? 'demo' : 'info'}>{writerLabel(pkg.writer)}</Badge>
        <Badge tone="neutral">
          {pkg.research.mode === 'verified_research' ? editorialCopy.researchVerified : editorialCopy.researchLocal}
        </Badge>
      </div>
      {round?.status === 'incomplete' ? (
        <p role="note" className="m-0 text-body-sm text-warning">
          {editorialCopy.roundIncomplete(round.finished, round.total)}
        </p>
      ) : null}
    </header>
  );
}

export interface EditorialCopyProps {
  projectId: string;
  editorial: EditorialPackageState;
  /** The caption of the selected carousel, reviewed in the «Texto del carrusel» tab. */
  caption: Element | undefined;
  onCaptionChanged: (element: Element) => void;
  onCaptionRefused: () => void;
  /** Reports whether there are unsaved edits (shown on the review mode tab). */
  onDirtyChange?: (dirty: boolean) => void;
}

/** The «Copy editorial» mode of the review page. */
export function EditorialCopy({
  projectId,
  editorial,
  caption,
  onCaptionChanged,
  onCaptionRefused,
  onDirtyChange,
}: EditorialCopyProps) {
  const { api, pkg, loadError, reload } = editorial;
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<CopyTab | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState<Partial<Record<EditorialDeliverable, EditDraft>>>({});
  const [instructions, setInstructions] = useState<Partial<Record<EditorialDeliverable, string>>>({});
  const tabsId = useId();
  const formId = useId();

  const versions = new Map<EditorialDeliverable, EditorialVersion | null>(
    (pkg?.deliverables ?? []).map((entry) => [entry.deliverable, entry.current]),
  );
  const versionOf = (deliverable: EditorialDeliverable): EditorialVersion | null => versions.get(deliverable) ?? null;
  const deliverableTabs = DELIVERABLE_TAB_ORDER.filter((deliverable) => versionOf(deliverable) !== null);
  const hasVersions = deliverableTabs.length > 0;
  const tabs: CopyTab[] = [
    ...(hasVersions ? deliverableTabs : ['social' as const]),
    ...(caption ? ['caption' as const] : []),
  ];
  const selected: CopyTab = tab !== null && tabs.includes(tab) ? tab : (tabs[0] ?? 'social');

  function isDirty(deliverable: EditorialDeliverable): boolean {
    const draft = drafts[deliverable];
    if (draft === undefined) return false;
    const version = versionOf(deliverable);
    if (version === null || version.id !== draft.baseVersionId) return true;
    return version.fields.some((field) => (draft.fields[field.name] ?? field.text) !== field.text);
  }
  const anyDirty = DELIVERABLE_TAB_ORDER.some(isDirty);
  const anyEditing = DELIVERABLE_TAB_ORDER.some((deliverable) => drafts[deliverable] !== undefined);

  useEffect(() => {
    onDirtyChange?.(anyDirty);
  }, [anyDirty, onDirtyChange]);
  // A new draft remounts this view: its edits are gone, so the page must not keep reporting them.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  async function act(work: () => Promise<unknown>, pending = ''): Promise<boolean> {
    setBusy(true);
    setActionError(null);
    setStatus(pending);
    let done = false;
    try {
      await work();
      done = true;
      await reload();
      setStatus('');
    } catch (error) {
      setActionError(error);
      setStatus('');
      await reload();
    } finally {
      setBusy(false);
      setGenerating(false);
      setConfirmed(false);
    }
    return done;
  }

  const writer = pkg?.writer;
  const writerReady = writer?.status === 'ready';
  const costOk = writer === undefined || !writer.requiresCostConfirmation || confirmed;
  const canGenerate = pkg !== null && pkg.available && writerReady && costOk && !busy;

  function generate(deliverable?: EditorialDeliverable, instruction?: string): void {
    if (writer === undefined) return;
    setGenerating(true);
    void act(
      () =>
        api.generate(projectId, {
          requestKey: newRequestKey(),
          ...(deliverable === undefined ? {} : { deliverable }),
          ...(instruction === undefined || instruction === '' ? {} : { instructions: instruction }),
          ...(writer.requiresCostConfirmation ? { confirmCost: confirmed } : {}),
        }),
      editorialCopy.generating,
    );
  }

  function copy(text: string) {
    void copyText(text).then((done) => setStatus(done ? editorialCopy.copied : editorialCopy.copyFailed));
  }

  function discard(deliverable: EditorialDeliverable) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[deliverable];
      return next;
    });
  }

  function startEdit(deliverable: EditorialDeliverable, version: EditorialVersion) {
    setDrafts((current) => ({
      ...current,
      [deliverable]: {
        baseVersionId: version.id,
        fields: Object.fromEntries(version.fields.map((field) => [field.name, field.text])),
      },
    }));
  }

  function save(deliverable: EditorialDeliverable) {
    const draft = drafts[deliverable];
    const version = versionOf(deliverable);
    if (draft === undefined || version === null) return;
    const changed = EDITORIAL_DELIVERABLE_FIELDS[deliverable]
      .map((name) => ({ name, text: draft.fields[name] ?? '' }))
      .filter((field) => field.text !== (version.fields.find((entry) => entry.name === field.name)?.text ?? ''));
    if (changed.length === 0) {
      discard(deliverable);
      return;
    }
    // The edits stay on screen until the server saves them: a refused save loses nothing.
    void act(() => api.edit(projectId, deliverable, draft.baseVersionId, changed), editorialCopy.saving).then(
      (done) => {
        if (done) discard(deliverable);
      },
    );
  }

  function tabOption(value: CopyTab): TabOption<CopyTab> {
    if (value === 'social') {
      return {
        value,
        label: editorialCopy.socialTab,
        ...(pkg === null ? {} : { badge: editorialCopy.tabNotGenerated }),
      };
    }
    if (value === 'caption') {
      const captionStatus = caption === undefined ? null : elementStatus(caption);
      const badge =
        captionStatus === null
          ? undefined
          : captionStatus.issue === 'blocking'
            ? ({ badge: editorialCopy.tabBlocked, badgeTone: 'danger' } as const)
            : captionStatus.issue === 'warning'
              ? ({ badge: editorialCopy.tabWarning, badgeTone: 'warning' } as const)
              : caption?.currentVersion.state === 'approved'
                ? ({ badge: editorialCopy.tabApproved, badgeTone: 'success', badgeSymbol: '✓' } as const)
                : undefined;
      return { value, label: editorialCopy.captionTab, ...badge };
    }
    const version = versionOf(value);
    const badge = isDirty(value)
      ? ({ badge: editorialCopy.tabUnsaved, badgeTone: 'warning' } as const)
      : version?.state === 'approved'
        ? ({ badge: editorialCopy.tabApproved, badgeTone: 'success', badgeSymbol: '✓' } as const)
        : version?.state === 'flagged'
          ? ({ badge: editorialCopy.tabFlagged, badgeTone: 'warning' } as const)
          : undefined;
    return { value, label: deliverableLabel[value], ...badge };
  }

  /** Generation of one deliverable (with its instruction) or of the whole package, with the cost controls. */
  function regenerateBlock(deliverable: EditorialDeliverable | null): ReactNode {
    if (pkg === null || !pkg.available || writer === undefined) return null;
    const editing = deliverable !== null && drafts[deliverable] !== undefined;
    const instruction = deliverable === null ? '' : (instructions[deliverable] ?? '');
    return (
      <section className="grid gap-3 border-t border-border-subtle pt-4">
        <p className={eyebrow}>{hasVersions ? editorialCopy.regenerateTitle : editorialCopy.packageTitle}</p>
        {writerReady ? null : (
          <p role="alert" className="m-0 text-body-sm text-danger">
            {editorialCopy.missingKey}
          </p>
        )}
        {deliverable === null ? null : (
          <Textarea
            id={`${formId}-instructions-${deliverable}`}
            label={editorialCopy.instructionsLabel}
            description={editorialCopy.instructionsHint}
            value={instruction}
            rows={3}
            maxLength={MAX_EDITORIAL_INSTRUCTIONS}
            onChange={(event) =>
              setInstructions((current) => ({
                ...current,
                [deliverable]: event.target.value.replace(/[\r\n]+/gu, ' '),
              }))
            }
          />
        )}
        {writer.requiresCostConfirmation ? (
          <fieldset className="m-0 grid gap-1 rounded-control border border-border-subtle p-3 text-body-sm">
            <legend className="font-bold">{editorialCopy.costTitle}</legend>
            <p className="m-0">{editorialCopy.costEstimate(writer.estimate.total)}</p>
            <p className="m-0 text-text-secondary">{editorialCopy.costUsage(writer)}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              {editorialCopy.costConfirm}
            </label>
          </fieldset>
        ) : null}
        {deliverable === null ? null : (
          <Button
            variant="secondary"
            className="w-full"
            disabled={!canGenerate || editing}
            isLoading={generating}
            loadingLabel={editorialCopy.generating}
            onClick={() => generate(deliverable, instruction.trim())}
          >
            {editorialCopy.regenerateWith(writer)}
          </Button>
        )}
        <Button
          variant={hasVersions ? 'secondary' : 'primary'}
          className="w-full"
          disabled={!canGenerate || anyEditing}
          isLoading={generating && deliverable === null}
          loadingLabel={editorialCopy.generating}
          onClick={() => generate()}
        >
          {hasVersions ? editorialCopy.regenerateAll : editorialCopy.generateAll}
        </Button>
        {anyEditing && hasVersions ? (
          <p className="m-0 text-caption text-text-secondary">{editorialCopy.anyEditingHold}</p>
        ) : null}
        {pkg.lastGeneration?.status === 'failed' && pkg.lastGeneration.errorMessage !== null ? (
          <p role="note" className="m-0 text-body-sm text-warning">
            {editorialCopy.lastFailure}: {pkg.lastGeneration.errorMessage}
          </p>
        ) : null}
      </section>
    );
  }

  /** Download and feedback shared by every deliverable tab. */
  function footer(): ReactNode {
    return (
      <>
        {pkg !== null && hasVersions ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            leadingIcon={<Icon name="text" size={18} />}
            onClick={() => {
              const text = editorialText(pkg, new Date());
              if (text !== null) {
                saveTextFile(text, editorialFileName(pkg));
                setStatus(editorialCopy.downloaded);
              }
            }}
          >
            {editorialCopy.download}
          </Button>
        ) : null}
        <p role="status" aria-live="polite" className="m-0 text-body-sm text-text-secondary">
          {status}
        </p>
        {actionError === null ? null : <ErrorBanner title={editorialCopy.actionError} error={actionError} />}
      </>
    );
  }

  function deliverablePanel(deliverable: EditorialDeliverable, version: EditorialVersion, current: EditorialPackage) {
    const draft = drafts[deliverable];
    const editing = draft !== undefined;
    const dirty = isDirty(deliverable);
    const stale = editing && draft.baseVersionId !== version.id;
    const approved = version.state === 'approved';
    return (
      <div className="grid min-w-0 gap-4 lg:h-full lg:min-h-0 md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]">
        <div className={column}>
          <PackageContext pkg={current} title={deliverableTitle[deliverable]} />
          {editing ? (
            <form
              id={formId}
              className="grid max-w-reading gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                save(deliverable);
              }}
            >
              {EDITORIAL_DELIVERABLE_FIELDS[deliverable].map((name) => {
                const text = draft.fields[name] ?? '';
                return (
                  <Textarea
                    key={name}
                    id={`${formId}-${name}`}
                    label={fieldLabel[name]}
                    description={fieldCounter(name, countWords(text), [...text].length)}
                    value={text}
                    rows={name === 'body' || name === 'description' ? 10 : 3}
                    maxLength={MAX_EDITORIAL_FIELD_TEXT}
                    onChange={(event) =>
                      setDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [deliverable]: { ...draft, fields: { ...draft.fields, [name]: event.target.value } },
                      }))
                    }
                  />
                );
              })}
              {stale ? (
                <p role="note" className="m-0 text-body-sm text-warning">
                  {editorialCopy.editingStale}
                </p>
              ) : null}
            </form>
          ) : (
            <>
              {version.instructions === null ? null : (
                <p className="m-0 text-caption text-text-secondary">
                  {editorialCopy.instructionsUsed(version.instructions)}
                </p>
              )}
              <dl className="m-0 grid max-w-reading gap-6">
                {version.fields.map((field) => (
                  <div key={field.name} className="grid gap-2">
                    <dt className="flex flex-wrap items-center justify-between gap-2">
                      <span className={eyebrow}>
                        {fieldLabel[field.name]}{' '}
                        <span className="font-normal tracking-normal normal-case">
                          · {fieldCounter(field.name, field.words, field.characters)}
                        </span>
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`${editorialCopy.copy} ${fieldLabel[field.name]}`}
                        onClick={() => copy(field.text)}
                      >
                        {editorialCopy.copy}
                      </Button>
                    </dt>
                    <dd
                      className={`m-0 whitespace-pre-wrap text-text-primary ${
                        field.name === 'headline' || field.name.startsWith('headline_') || field.name === 'title'
                          ? 'font-display text-heading-sm font-extrabold tracking-heading'
                          : 'text-body-lg'
                      }`}
                    >
                      {field.text}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <ResearchPanel pkg={current} />
        </div>

        <aside aria-label={editorialCopy.actionsLabel(deliverableTitle[deliverable])} className={actionsColumn}>
          <section className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={eyebrow}>{editorialCopy.approvalTitle}</p>
              <Badge tone={stateTone(version.state)}>{stateLabel[version.state]}</Badge>
            </div>
            <p className="m-0 text-caption text-text-secondary">
              {editorialCopy.version(version.versionNumber)} · {originLabel[version.origin]}
            </p>
            {approved ? (
              <Button
                variant="secondary"
                className="w-full"
                disabled={busy}
                onClick={() => void act(() => api.withdraw(projectId, deliverable))}
              >
                {editorialCopy.withdraw}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy || version.state !== 'ready' || editing}
                leadingIcon={<Icon name="check" size={18} />}
                onClick={() => void act(() => api.approve(projectId, deliverable, version.id))}
              >
                {editorialCopy.approve}
              </Button>
            )}
            {editing ? <p className="m-0 text-caption text-warning">{editorialCopy.editingHold}</p> : null}
            <p className="m-0 text-caption text-text-secondary">{editorialCopy.approvalScope}</p>
          </section>

          <section className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={eyebrow}>{editorialCopy.validationsTitle}</p>
              <Badge
                tone={version.flags.length === 0 ? 'success' : 'warning'}
                symbol={version.flags.length === 0 ? '✓' : '!'}
              >
                {version.flags.length === 0 ? editorialCopy.noFlags : editorialCopy.flagCount(version.flags.length)}
              </Badge>
            </div>
            {version.flags.length === 0 ? null : (
              <section
                role="alert"
                className="rounded-control border border-warning bg-warning-surface p-3 text-body-sm"
              >
                <h4 className="m-0 mb-1 font-bold text-warning">{editorialCopy.flagsTitle}</h4>
                <ul className="m-0 grid list-disc gap-1 pl-5 text-text-primary">
                  {version.flags.map((flag) => (
                    <li key={`${flag.code}-${flag.field}-${flag.excerpt}`}>{flagText(flag)}</li>
                  ))}
                </ul>
              </section>
            )}
          </section>

          <section className="grid gap-2">
            {editing ? (
              <>
                <Button
                  type="submit"
                  form={formId}
                  variant="primary"
                  className="w-full"
                  disabled={busy || !dirty}
                  isLoading={busy && status === editorialCopy.saving}
                  loadingLabel={editorialCopy.saving}
                >
                  {editorialCopy.save}
                </Button>
                <Button variant="secondary" className="w-full" disabled={busy} onClick={() => discard(deliverable)}>
                  {editorialCopy.cancel}
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                disabled={busy}
                leadingIcon={<Icon name="pencil" size={18} />}
                onClick={() => startEdit(deliverable, version)}
              >
                {editorialCopy.edit}
              </Button>
            )}
            <Button variant="secondary" className="w-full" onClick={() => copy(deliverableText(deliverable, version))}>
              {editorialCopy.copyAll}
            </Button>
          </section>

          {regenerateBlock(deliverable)}
          {footer()}
        </aside>
      </div>
    );
  }

  function socialPanel() {
    return (
      <div className="grid min-w-0 gap-4 lg:h-full lg:min-h-0 md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]">
        <div className={column}>
          {pkg === null ? (
            loadError === null ? (
              <p role="status" className="m-0">
                {editorialCopy.loading}
              </p>
            ) : (
              <ErrorBanner title={editorialCopy.loadError} error={loadError} onRetry={() => void reload()} />
            )
          ) : (
            <>
              <PackageContext pkg={pkg} title={editorialCopy.socialTab} />
              <p className="m-0 max-w-reading text-text-secondary">{editorialCopy.intro}</p>
              <p className="m-0 max-w-reading">
                {!pkg.available
                  ? pkg.unavailableReason === 'no_draft'
                    ? editorialCopy.noDraft
                    : editorialCopy.noConfirmedFacts
                  : editorialCopy.empty}
              </p>
              <ResearchPanel pkg={pkg} />
            </>
          )}
        </div>
        {pkg === null || !pkg.available ? null : (
          <aside aria-label={editorialCopy.actionsLabel(editorialCopy.socialTab)} className={actionsColumn}>
            {regenerateBlock(null)}
            {footer()}
          </aside>
        )}
      </div>
    );
  }

  let content: ReactNode;
  if (selected === 'caption' && caption !== undefined) {
    content = <ElementReview element={caption} onChanged={onCaptionChanged} onRefused={onCaptionRefused} />;
  } else if (selected !== 'caption' && selected !== 'social' && pkg !== null && versionOf(selected) !== null) {
    content = deliverablePanel(selected, versionOf(selected) as EditorialVersion, pkg);
  } else {
    content = socialPanel();
  }

  return (
    <section
      aria-labelledby="editorial-title"
      aria-busy={pkg === null && loadError === null ? 'true' : undefined}
      className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full"
    >
      <h2 id="editorial-title" className="sr-only">
        {editorialCopy.title}
      </h2>
      <UnsavedChangesGuard when={anyDirty} />
      <Tabs
        id={tabsId}
        label={editorialCopy.tabsLabel}
        options={tabs.map(tabOption)}
        value={selected}
        onChange={setTab}
        size="sm"
        className="self-start"
      />
      <div
        role="tabpanel"
        id={tabPanelId(tabsId, selected)}
        aria-labelledby={tabId(tabsId, selected)}
        className="min-h-0 min-w-0 flex-1"
      >
        {content}
      </div>
    </section>
  );
}
