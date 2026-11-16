import {
  MAX_DESIGN_INSTRUCTIONS,
  contractRegExp,
  type BrandAsset,
  type DesignCapabilities,
  type DesignContentType,
  type DesignEstimate,
  type DesignFormat,
  type DesignGenerationInput,
  type DesignGenerationStart,
  type DesignMode,
  type DesignProposalDetail,
  type DesignReferenceRole,
} from '@edr/contracts';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Alert, Badge, Button, ErrorBanner, Input, LoadingState, Modal, ModalFooter, Select, Textarea } from '../../ui';
import type { BrandApi } from '../brand/brandApi';
import { useResource } from '../brand/useResource';
import {
  STYLE_SUGGESTIONS,
  contentTypeLabel,
  createCopy,
  formatLabel,
  guideCopy,
  modeBadge,
  modeGuide,
  modeLabel,
  ownRoleDescription,
  ownRoleLabel,
  policyLabel,
  qualityLabel,
  roleDescription,
  roleLabel,
  usd,
} from './copy';
import type { DesignApi } from './designApi';
import { ModeGuide } from './ModeGuide';

export interface CreateDesignDialogProps {
  api: DesignApi;
  brandApi: BrandApi;
  capabilities: DesignCapabilities;
  /** The proposal a variant starts from; its image becomes the base and its instructions are kept. */
  parent?: DesignProposalDetail | null;
  /**
   * New instructions to start with (the note of a change request). In the own prompt mode the field starts with the
   * whole prompt of the parent, followed by this note, so the operator edits the prompt that is sent.
   */
  initialInstructions?: string;
  onClose: () => void;
  onStarted: (start: DesignGenerationStart) => void;
}

const NOTE = contractRegExp('Note');

function textError(value: string, max: number): string | undefined {
  const text = value.trim();
  if (text === '') return undefined;
  if ([...text].length > max) return createCopy.tooLong(max);
  return NOTE.test(text) ? undefined : createCopy.textInvalid;
}

/** A request key per request: a repeated confirmation of the same request reuses it, so nothing is charged twice. */
function useRequestKey(signature: string): string {
  const [entry, setEntry] = useState({ signature, key: crypto.randomUUID() });
  useEffect(() => {
    if (entry.signature !== signature) {
      setEntry({ signature, key: crypto.randomUUID() });
    }
  }, [entry.signature, signature]);
  return entry.signature === signature ? entry.key : '';
}

/**
 * Creation of an AI design (PD-ARCH-01G-B): content type, format, model and quality, the count, the style and
 * instructions, and the brand assets with the role each one plays (allowed by its usage policy; nothing is selected
 * automatically). "Revisar alcance y costo" asks the server for the scope, the effective prompt and the estimate;
 * the generation starts only after the explicit cost confirmation, once (request key, disabled button).
 */
export function CreateDesignDialog({
  api,
  brandApi,
  capabilities,
  parent = null,
  initialInstructions = '',
  onClose,
  onStarted,
}: CreateDesignDialogProps) {
  const baseId = useId();
  const defaultModel =
    capabilities.models.find((model) => model.id === capabilities.defaultModel) ?? capabilities.models[0];
  const [contentType, setContentType] = useState<DesignContentType>(parent?.proposal.contentType ?? 'match_preview');
  const [format, setFormat] = useState<DesignFormat>(parent?.proposal.format ?? '4:5');
  const [modelId, setModelId] = useState(parent?.proposal.model ?? defaultModel?.id ?? '');
  const model = capabilities.models.find((entry) => entry.id === modelId) ?? defaultModel;
  const [quality, setQuality] = useState(parent?.proposal.quality ?? model?.qualities[0] ?? 'low');
  const [count, setCount] = useState(1);
  const [style, setStyle] = useState(parent?.generation.style ?? '');
  // The text an own prompt variant starts with: the changes alone when the previous image is edited (the image already
  // carries the prompt that made it, and repeating it contradicts the changes), the whole prompt followed by the changes
  // when it starts from scratch.
  const startText = (previous: boolean): string => {
    if (parent === null || parent.proposal.mode !== 'own_prompt' || previous) return initialInstructions;
    const prompt = [parent.generation.inheritedInstructions, parent.generation.instructions].filter(Boolean).join('\n');
    return initialInstructions === '' ? prompt : `${prompt}\n\n${createCopy.changesHeading}\n${initialInstructions}`;
  };
  const [instructions, setInstructions] = useState(() => startText(true));
  const [roles, setRoles] = useState<Record<string, DesignReferenceRole | ''>>(() =>
    Object.fromEntries(
      (parent?.proposal.references ?? [])
        .filter((reference) => reference.role !== 'transform_base')
        .map((reference) => [reference.assetId, reference.role]),
    ),
  );
  const [mode, setMode] = useState<DesignMode>(parent?.proposal.mode ?? 'guided');
  const own = mode === 'own_prompt';
  // In the own prompt mode a variant may also start from scratch: the same edited prompt without the previous image,
  // which the model otherwise tends to keep as it is.
  const [fromPrevious, setFromPrevious] = useState(true);
  const variant = parent !== null && (fromPrevious || !own);
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [estimate, setEstimate] = useState<DesignEstimate | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<'estimate' | 'generate' | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const loadAssets = useCallback((signal: AbortSignal) => brandApi.listAssets(signal), [brandApi]);
  const assets = useResource(loadAssets);
  const activeAssets: BrandAsset[] =
    assets.state.status === 'ready' ? assets.state.data.filter((asset) => asset.active) : [];

  const errors = {
    style: own ? undefined : textError(style, 300),
    instructions:
      own && instructions.trim() === ''
        ? createCopy.ownPromptRequired
        : textError(instructions, MAX_DESIGN_INSTRUCTIONS),
  };
  const selected = Object.entries(roles).filter((entry): entry is [string, DesignReferenceRole] => entry[1] !== '');
  const tooMany = selected.length > capabilities.limits.maxReferences;
  const zoneOf = (assetId: string) => {
    const kind = activeAssets.find((asset) => asset.id === assetId)?.kind;
    return kind === 'brand_logo' ? 'logo' : kind === 'mascot' ? 'mascot' : 'graphic';
  };
  const placedZones = selected.filter(([, role]) => role === 'reserved_placement').map(([assetId]) => zoneOf(assetId));
  const zoneConflict = new Set(placedZones).size !== placedZones.length;
  const invalid =
    errors.style !== undefined || errors.instructions !== undefined || tooMany || zoneConflict || model === undefined;

  const input: DesignGenerationInput = {
    mode,
    contentType,
    format,
    ...(model === undefined ? {} : { model: model.id }),
    quality,
    count,
    ...(own || style.trim() === '' ? {} : { style: style.trim() }),
    ...(instructions.trim() === '' ? {} : { instructions: instructions.trim() }),
    references: selected.map(([assetId, role]) => ({ assetId, role })),
    ...(parent !== null && variant ? { parentProposalId: parent.proposal.id } : {}),
  };
  const requestKey = useRequestKey(JSON.stringify(input));

  function rolesFor(asset: BrandAsset): DesignReferenceRole[] {
    const allowed = capabilities.policyRoles.find((entry) => entry.policy === asset.usagePolicy)?.roles ?? [];
    return variant ? allowed.filter((role) => role !== 'transform_base') : allowed;
  }

  async function review() {
    if (invalid || busy !== null) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy('estimate');
    setFailure(null);
    try {
      const result = await api.estimate(input, current.signal);
      if (current.signal.aborted) return;
      setEstimate(result);
      setConfirmed(false);
      setStep('review');
    } catch (error) {
      if (!current.signal.aborted) setFailure(error);
    } finally {
      if (!current.signal.aborted) setBusy(null);
    }
  }

  async function generate() {
    if (!confirmed || busy !== null || requestKey === '') return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy('generate');
    setFailure(null);
    try {
      const start = await api.createGeneration({ ...input, requestKey, confirmCost: true }, current.signal);
      if (!current.signal.aborted) onStarted(start);
    } catch (error) {
      if (!current.signal.aborted) {
        setFailure(error);
        setBusy(null);
      }
    }
  }

  const fieldId = (name: string) => `${baseId}-${name}`;

  return (
    <Modal
      title={parent === null ? createCopy.title : createCopy.variantTitle}
      onClose={onClose}
      closeDisabled={busy !== null}
    >
      {step === 'edit' ? (
        <form
          noValidate
          className="grid gap-5"
          aria-busy={busy !== null}
          onSubmit={(event) => {
            event.preventDefault();
            void review();
          }}
        >
          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="mb-1 text-body-sm font-bold text-text-primary">{createCopy.mode}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['guided', 'own_prompt'] as const).map((value) => (
                <label
                  key={value}
                  className={`flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === value ? 'border-brand-gold bg-surface-card' : 'border-border-subtle'}`}
                >
                  <input
                    type="radio"
                    name={fieldId('mode')}
                    value={value}
                    checked={mode === value}
                    disabled={parent !== null}
                    onChange={() => setMode(value)}
                  />
                  <span className="grid gap-1">
                    <strong className="text-text-primary">{modeLabel[value]}</strong>
                    <small className="text-text-secondary">{modeGuide[value].forWhat}</small>
                    <small className="text-text-subtle">{modeGuide[value].result}</small>
                  </span>
                </label>
              ))}
            </div>
            {parent === null ? null : (
              <p className="m-0 text-caption text-text-secondary">{createCopy.variantMode(modeLabel[mode])}</p>
            )}
            {parent === null || !own ? null : (
              <fieldset className="m-0 grid gap-2 border-0 p-0">
                <legend className="mb-1 text-body-sm font-bold text-text-primary">{createCopy.startFrom}</legend>
                {([true, false] as const).map((value) => (
                  <label key={String(value)} className="flex min-h-touch cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name={fieldId('start')}
                      checked={fromPrevious === value}
                      onChange={() => {
                        // An untouched text follows the start point; an edited one is kept.
                        if (instructions === startText(fromPrevious)) setInstructions(startText(value));
                        setFromPrevious(value);
                      }}
                    />
                    <span className="grid gap-1">
                      <strong className="text-text-primary">
                        {value ? createCopy.startPrevious : createCopy.startScratch}
                      </strong>
                      <small className="text-text-secondary">
                        {value ? createCopy.startPreviousHint : createCopy.startScratchHint}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <details className="rounded-xl border border-border-subtle p-3">
              <summary className="cursor-pointer text-body-sm font-bold text-text-primary">{guideCopy.title}</summary>
              <div className="mt-3">
                <ModeGuide highlight={mode} />
              </div>
            </details>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id={fieldId('type')}
              label={createCopy.contentType}
              value={contentType}
              disabled={parent !== null}
              onChange={(event) => setContentType(event.target.value as DesignContentType)}
            >
              {capabilities.contentTypes.map((value) => (
                <option key={value} value={value}>
                  {contentTypeLabel[value]}
                </option>
              ))}
            </Select>
            <Select
              id={fieldId('format')}
              label={createCopy.format}
              value={format}
              disabled={parent !== null}
              onChange={(event) => setFormat(event.target.value as DesignFormat)}
            >
              {capabilities.formats.map((value) => (
                <option key={value} value={value}>
                  {formatLabel[value]}
                </option>
              ))}
            </Select>
            <Select
              id={fieldId('model')}
              label={createCopy.model}
              value={model?.id ?? ''}
              onChange={(event) => {
                const next = capabilities.models.find((entry) => entry.id === event.target.value);
                setModelId(event.target.value);
                if (next !== undefined && !next.qualities.includes(quality)) setQuality(next.qualities[0] ?? 'low');
              }}
            >
              {capabilities.models.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
            <Select
              id={fieldId('quality')}
              label={createCopy.quality}
              description={createCopy.qualityHint}
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
            >
              {(model?.qualities ?? []).map((value) => (
                <option key={value} value={value}>
                  {qualityLabel[value] ?? value}
                </option>
              ))}
            </Select>
            <Select
              id={fieldId('count')}
              label={createCopy.count}
              description={createCopy.countHint(capabilities.limits.maxImagesPerRequest)}
              value={String(count)}
              onChange={(event) => setCount(Number(event.target.value))}
            >
              {Array.from({ length: capabilities.limits.maxImagesPerRequest }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>

          {own ? null : (
            <div className="grid gap-2">
              <Input
                id={fieldId('style')}
                label={createCopy.style}
                description={createCopy.styleHint}
                value={style}
                maxLength={300}
                error={errors.style}
                onChange={(event) => setStyle(event.target.value)}
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label={createCopy.style}>
                {STYLE_SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    size="sm"
                    variant="secondary"
                    aria-pressed={style === suggestion}
                    onClick={() => setStyle(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {parent !== null ? (
            <Alert tone="info">
              {!own ? createCopy.variantNote : fromPrevious ? createCopy.ownVariantNote : createCopy.ownScratchNote}
            </Alert>
          ) : null}
          {parent !== null && !own ? (
            <div className="rounded-xl border border-border-subtle bg-surface-card p-3 text-body-sm">
              <p className="m-0 font-bold text-text-secondary">{createCopy.inherited}</p>
              <p className="m-0 mt-1 whitespace-pre-line text-text-primary">
                {[parent.generation.inheritedInstructions, parent.generation.instructions].filter(Boolean).join('\n') ||
                  '—'}
              </p>
            </div>
          ) : null}
          <div className="grid gap-1">
            <Textarea
              id={fieldId('instructions')}
              label={
                own
                  ? variant
                    ? createCopy.ownChanges
                    : createCopy.ownPrompt
                  : parent === null
                    ? createCopy.instructions
                    : createCopy.newInstructions
              }
              description={own ? createCopy.ownPromptHint : createCopy.instructionsHint}
              value={instructions}
              rows={own ? 12 : 4}
              error={errors.instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
            <p
              className={`m-0 text-caption ${[...instructions.trim()].length > MAX_DESIGN_INSTRUCTIONS ? 'font-bold text-danger' : 'text-text-subtle'}`}
              aria-live="polite"
            >
              {createCopy.characters([...instructions.trim()].length, MAX_DESIGN_INSTRUCTIONS)}
            </p>
          </div>

          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="mb-1 text-body-sm font-bold text-text-primary">{createCopy.references}</legend>
            <p className="m-0 text-caption text-text-secondary">
              {createCopy.referencesHint(capabilities.limits.maxReferences)}
            </p>
            {own ? <Alert tone="info">{createCopy.protectedNote}</Alert> : null}
            {zoneConflict ? (
              <p className="m-0 text-body-sm font-bold text-danger" role="alert">
                {createCopy.onePerZone}
              </p>
            ) : null}
            {assets.state.status === 'loading' ? <LoadingState label={createCopy.reviewing} /> : null}
            {assets.state.status === 'error' ? (
              <ErrorBanner error={assets.state.error} title={createCopy.failedTitle} onRetry={assets.reload} />
            ) : null}
            {assets.state.status === 'ready' && activeAssets.length === 0 ? (
              <p className="m-0 text-body-sm text-text-secondary">{createCopy.noAssets}</p>
            ) : null}
            <ul className="m-0 grid list-none gap-2 p-0">
              {activeAssets.map((asset) => {
                const allowed = rolesFor(asset);
                const role = roles[asset.id] ?? '';
                return (
                  <li
                    key={asset.id}
                    className="grid gap-2 rounded-xl border border-border-subtle bg-surface-card p-3 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center"
                  >
                    <span className="min-w-0">
                      <strong className="block break-words text-text-primary">{asset.label}</strong>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone="neutral">{policyLabel[asset.usagePolicy]}</Badge>
                        {role === '' ? null : (
                          <small className="text-caption text-text-secondary">
                            {(own ? ownRoleDescription : roleDescription)[role]}
                          </small>
                        )}
                      </span>
                    </span>
                    <Select
                      id={fieldId(`role-${asset.id}`)}
                      label={createCopy.role(asset.label)}
                      value={role}
                      onChange={(event) =>
                        setRoles((current) => ({
                          ...current,
                          [asset.id]: event.target.value as DesignReferenceRole | '',
                        }))
                      }
                    >
                      <option value="">{createCopy.notUsed}</option>
                      {allowed.map((value) => (
                        <option key={value} value={value}>
                          {(own ? ownRoleLabel : roleLabel)[value]}
                        </option>
                      ))}
                    </Select>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {failure === null ? null : (
            <ErrorBanner error={failure} title={createCopy.failedTitle} onRetry={() => void review()} />
          )}

          <ModalFooter onCancel={onClose} cancelDisabled={busy !== null}>
            <Button
              type="submit"
              disabled={invalid}
              isLoading={busy === 'estimate'}
              loadingLabel={createCopy.reviewing}
            >
              {createCopy.review}
            </Button>
          </ModalFooter>
        </form>
      ) : estimate === null ? null : (
        <div className="grid gap-5" aria-busy={busy !== null}>
          <section aria-label={createCopy.scope} className="grid gap-3">
            <h3 className="m-0 text-body-lg font-bold text-text-primary">{createCopy.scope}</h3>
            <p className="m-0 flex flex-wrap items-center gap-2 text-body-sm text-text-secondary">
              <Badge tone={estimate.mode === 'own_prompt' ? 'attested' : 'info'}>{modeBadge[estimate.mode]}</Badge>
              {estimate.mode === 'own_prompt' ? createCopy.ownReview : createCopy.guidedReview}
            </p>
            <dl className="m-0 grid gap-2 text-body-sm sm:grid-cols-2">
              {[
                [createCopy.provider, `OpenAI · ${model?.label ?? estimate.model}`],
                [createCopy.contentType, contentTypeLabel[contentType]],
                [createCopy.quality, qualityLabel[estimate.quality] ?? estimate.quality],
                [createCopy.count, String(estimate.count)],
                [createCopy.size, estimate.requestSize],
                [createCopy.output, `${String(estimate.outputWidth)} × ${String(estimate.outputHeight)} px`],
                [
                  createCopy.adaptation,
                  estimate.adaptation === 'none' ? createCopy.adaptationNone : createCopy.adaptationCrop,
                ],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-caption font-bold text-text-secondary">{term}</dt>
                  <dd className="m-0 text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>
            {(
              [
                [createCopy.placed, estimate.references.filter((reference) => !reference.sent)],
                [createCopy.sentList, estimate.references.filter((reference) => reference.sent)],
              ] as const
            ).map(([title, references]) =>
              references.length === 0 ? null : (
                <div key={title} className="grid gap-1.5">
                  <h4 className="m-0 text-body-sm font-bold text-text-secondary">{title}</h4>
                  <ul className="m-0 grid list-none gap-1.5 p-0 text-body-sm" aria-label={title}>
                    {references.map((reference) => (
                      <li key={reference.assetId} className="flex flex-wrap items-center gap-2">
                        <strong className="text-text-primary">{reference.label}</strong>
                        <span className="text-text-secondary">
                          {(estimate.mode === 'own_prompt' ? ownRoleLabel : roleLabel)[reference.role]}
                        </span>
                        <Badge tone={reference.sent ? 'info' : 'success'}>
                          {reference.sent ? createCopy.sent : createCopy.notSent}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
            {estimate.references.some((reference) => !reference.sent) ? null : (
              <p className="m-0 text-body-sm text-text-secondary">{createCopy.nothingPlaced}</p>
            )}
          </section>

          <section
            aria-label={createCopy.cost}
            className="grid gap-2 rounded-xl border border-border-subtle bg-surface-card p-4"
          >
            <h3 className="m-0 text-body-lg font-bold text-text-primary">{createCopy.cost}</h3>
            {estimate.cost.status === 'estimated' && estimate.cost.total !== null && estimate.cost.perImage !== null ? (
              <>
                <p className="m-0 text-heading-sm font-extrabold text-brand-gold">
                  {createCopy.costEstimated(estimate.cost.total, estimate.cost.perImage)}
                </p>
                <p className="m-0 text-caption text-text-secondary">{createCopy.costBasis}</p>
              </>
            ) : (
              <p className="m-0 text-body-sm text-text-primary">{createCopy.costUnavailable}</p>
            )}
            {model?.pricing === null || model?.pricing === undefined ? null : (
              <p className="m-0 text-caption text-text-subtle">
                {createCopy.pricing(model.pricing.source, model.pricing.checkedOn)}
              </p>
            )}
            <p className="m-0 text-caption text-text-secondary">
              {createCopy.limits(estimate.imagesUsedToday, estimate.maxImagesPerDay)}
              {estimate.spentThisMonth === null ? '' : ` ${usd(estimate.spentThisMonth)} este mes.`}
            </p>
          </section>

          <details className="rounded-xl border border-border-subtle bg-surface-card p-3 text-body-sm">
            <summary className="cursor-pointer font-bold text-text-primary">{createCopy.prompt}</summary>
            <pre className="m-0 mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-caption text-text-secondary">
              {estimate.prompt}
            </pre>
          </details>

          <label className="flex min-h-touch items-start gap-3 text-body-sm text-text-primary">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              disabled={busy !== null}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {createCopy.confirm}
          </label>

          {failure === null ? null : <ErrorBanner error={failure} title={createCopy.failedTitle} />}

          <div className="flex flex-wrap justify-end gap-3 border-t border-border-subtle pt-4">
            <Button variant="secondary" disabled={busy !== null} onClick={() => setStep('edit')}>
              {createCopy.back}
            </Button>
            <Button
              disabled={!confirmed}
              isLoading={busy === 'generate'}
              loadingLabel={createCopy.generating}
              onClick={() => void generate()}
            >
              {createCopy.generate(estimate.count)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
