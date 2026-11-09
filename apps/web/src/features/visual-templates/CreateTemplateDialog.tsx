import { contractRegExp, type DesignContentType, DesignContentTypeSchema, type DesignProposal } from '@edr/contracts';
import { useCallback, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Alert,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingState,
  Modal,
  ModalFooter,
  Select,
  Textarea,
} from '../../ui';
import { PreviewImage } from '../brand/PreviewImage';
import { useResource } from '../brand/useResource';
import { contentTypeLabel, modeBadge } from '../design/copy';
import type { DesignApi } from '../design/designApi';
import { createCopy } from './copy';
import { editorPath } from './VisualTemplatesSection';
import type { VisualTemplatesApi } from './visualTemplatesApi';

export interface CreateTemplateDialogProps {
  api: VisualTemplatesApi;
  designApi: DesignApi;
  /** A proposal chosen beforehand (from the proposal detail); the operator can still pick another one. */
  initialProposalId?: string | null;
  onClose: () => void;
}

const LABEL = contractRegExp('Label');
const NOTE = contractRegExp('Note');

/** A label for the template from the proposal name (at most 80 characters). */
function defaultName(proposal: DesignProposal): string {
  return [...proposal.name].slice(0, 80).join('');
}

/**
 * "Crear plantilla" (PD-ARCH-01G-C): picks an approved design proposal and creates a draft template from it, a local
 * operation that calls no AI provider. Own-prompt proposals need the operator's acknowledgement that the image may
 * contain generated text, people, logos or a generated Ketsi; guided proposals carry a review note. The editor opens
 * on success.
 */
export function CreateTemplateDialog({ api, designApi, initialProposalId = null, onClose }: CreateTemplateDialogProps) {
  const baseId = useId();
  const navigate = useNavigate();
  const load = useCallback(
    async (signal: AbortSignal) =>
      (await designApi.listProposals(signal)).filter((proposal) => proposal.status === 'approved'),
    [designApi],
  );
  const { state, reload } = useResource(load);
  const [selectedId, setSelectedId] = useState<string | null>(initialProposalId);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  /** The content type of the template; the proposal's until the operator chooses another (decision 01G-C-1). */
  const [contentType, setContentType] = useState<DesignContentType | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<{ select?: string; name?: string; acknowledge?: string }>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const proposals = state.status === 'ready' ? state.data : [];
  const selected = proposals.find((proposal) => proposal.id === selectedId) ?? null;
  const nameValue = name ?? (selected === null ? '' : defaultName(selected));
  const contentTypeValue = contentType ?? selected?.contentType ?? null;

  async function submit() {
    if (busy) return;
    const next: typeof errors = {};
    const trimmed = nameValue.trim();
    if (selected === null) next.select = createCopy.selectRequired;
    if (trimmed === '' || !LABEL.test(trimmed)) next.name = createCopy.nameRequired;
    if (selected?.mode === 'own_prompt' && !acknowledged) next.acknowledge = createCopy.acknowledgeRequired;
    setErrors(next);
    if (selected === null || Object.keys(next).length > 0) return;
    const text = description.trim();
    const group = category.trim();
    setBusy(true);
    setFailure(null);
    try {
      const detail = await api.create({
        sourceProposalId: selected.id,
        name: trimmed,
        ...(contentTypeValue === null ? {} : { contentType: contentTypeValue }),
        ...(text !== '' && NOTE.test(text) ? { description: text } : {}),
        ...(group !== '' && LABEL.test(group) ? { category: group } : {}),
        ...(selected.mode === 'own_prompt' || acknowledged ? { acknowledgeWarnings: true } : {}),
      });
      onClose();
      void navigate(editorPath(detail.template.id));
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={createCopy.title} onClose={onClose} closeDisabled={busy} size="lg">
      <div className="grid gap-5">
        <p className="m-0 text-body-sm text-text-secondary">{createCopy.intro}</p>
        {state.status === 'loading' ? <LoadingState layout="panel" label={createCopy.loading} /> : null}
        {state.status === 'error' ? (
          <ErrorBanner error={state.error} title={createCopy.loadFailedTitle} onRetry={reload} />
        ) : null}
        {state.status === 'ready' && proposals.length === 0 ? (
          <EmptyState headingLevel={3} title={createCopy.empty} description={createCopy.emptyDescription} icon="✦" />
        ) : null}
        {proposals.length > 0 ? (
          <fieldset className="m-0 grid gap-2 border-0 p-0" aria-describedby={`${baseId}-select-error`}>
            <legend className="mb-2 text-body-sm font-bold text-text-primary">{createCopy.proposals}</legend>
            <ul className="m-0 grid max-h-80 list-none gap-3 overflow-y-auto p-0 sm:grid-cols-2 lg:grid-cols-3">
              {proposals.map((proposal) => (
                <li key={proposal.id}>
                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${selectedId === proposal.id ? 'border-brand-gold bg-surface-card' : 'border-border-subtle bg-surface-raised'}`}
                  >
                    <input
                      type="radio"
                      name={`${baseId}-proposal`}
                      value={proposal.id}
                      checked={selectedId === proposal.id}
                      onChange={() => {
                        setSelectedId(proposal.id);
                        setAcknowledged(false);
                      }}
                    />
                    <span className="relative grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas">
                      <PreviewImage
                        key={proposal.id}
                        src={designApi.proposalBackgroundUrl(proposal.id)}
                        alt={createCopy.proposalAlt(proposal.name)}
                        failedText={createCopy.proposalFailed}
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </span>
                    <span className="grid min-w-0 content-start gap-1 text-caption text-text-secondary">
                      <strong className="break-words text-body-sm text-text-primary">{proposal.name}</strong>
                      <span>
                        {contentTypeLabel[proposal.contentType]} · {proposal.format}
                      </span>
                      <span>{modeBadge[proposal.mode]}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {errors.select === undefined ? null : (
              <p id={`${baseId}-select-error`} className="m-0 text-caption font-bold text-danger">
                {errors.select}
              </p>
            )}
          </fieldset>
        ) : null}
        {state.status === 'ready' ? (
          <p className="m-0 text-caption text-text-subtle">{createCopy.backToProposals}</p>
        ) : null}

        {selected === null ? null : selected.mode === 'own_prompt' ? (
          <Alert tone="warning">
            <span className="grid gap-3">
              <span>{createCopy.ownPromptWarning}</span>
              <label className="flex items-start gap-2 text-body-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>{createCopy.acknowledge}</span>
              </label>
              {errors.acknowledge === undefined ? null : (
                <span className="text-caption font-bold text-danger">{errors.acknowledge}</span>
              )}
            </span>
          </Alert>
        ) : (
          <Alert tone="info">{createCopy.guidedWarning}</Alert>
        )}

        {proposals.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id={`${baseId}-name`}
              label={createCopy.name}
              value={nameValue}
              maxLength={80}
              required
              error={errors.name}
              onChange={(event) => setName(event.target.value)}
            />
            <Select
              id={`${baseId}-content-type`}
              label={createCopy.contentType}
              description={
                selected !== null && contentTypeValue !== null && contentTypeValue !== selected.contentType
                  ? createCopy.contentTypeChanged(contentTypeLabel[selected.contentType])
                  : createCopy.contentTypeHint
              }
              value={contentTypeValue ?? ''}
              disabled={selected === null}
              onChange={(event) => setContentType(DesignContentTypeSchema.parse(event.target.value))}
            >
              {DesignContentTypeSchema.options.map((value) => (
                <option key={value} value={value}>
                  {contentTypeLabel[value]}
                </option>
              ))}
            </Select>
            <Input
              id={`${baseId}-category`}
              label={createCopy.category}
              description={createCopy.categoryHint}
              value={category}
              maxLength={80}
              onChange={(event) => setCategory(event.target.value)}
            />
            <Textarea
              id={`${baseId}-description`}
              label={createCopy.description}
              value={description}
              maxLength={500}
              rows={2}
              wrapperClassName="sm:col-span-2"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        ) : null}
        {failure === null ? null : <ErrorBanner error={failure} title={createCopy.failedTitle} />}
        <ModalFooter onCancel={onClose} cancelDisabled={busy}>
          <Button
            isLoading={busy}
            loadingLabel={createCopy.submitting}
            disabled={proposals.length === 0}
            onClick={() => void submit()}
          >
            {createCopy.submit}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
