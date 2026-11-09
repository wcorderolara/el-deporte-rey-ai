import {
  contractRegExp,
  type BrandAsset,
  type BrandIdentity,
  type VisualTemplateBackgroundInput,
  type VisualTemplateDetail,
  type VisualTemplateLayer,
  type VisualTemplateVersion,
} from '@edr/contracts';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { ApiError } from '../../api/client';
import {
  Alert,
  Badge,
  Button,
  ErrorBanner,
  Input,
  LoadingState,
  Modal,
  ModalFooter,
  Select,
  Textarea,
  formatDateTime,
} from '../../ui';
import type { BrandApi } from '../brand/brandApi';
import { useResource } from '../brand/useResource';
import { contentTypeLabel, formatLabel } from '../design/copy';
import type { DesignApi } from '../design/designApi';
import { editorCopy, previewCopy, templateStatusLabel, templateStatusTone, versionStatusLabel } from './copy';
import { BackgroundDialog, type BackgroundChoice } from './editor/BackgroundDialog';
import { EditorCanvas } from './editor/EditorCanvas';
import { LayerList } from './editor/LayerList';
import { LayerProperties } from './editor/LayerProperties';
import { PreviewPanel, type PreviewSportsApi } from './editor/PreviewPanel';
import { ValidationPanel } from './editor/ValidationPanel';
import { imageAssets, moveLayer, newLayer, officialMark, replaceLayer, type NewLayerRequest } from './layers';
import type { VisualTemplatesApi } from './visualTemplatesApi';

export interface TemplateEditorPageProps {
  api: VisualTemplatesApi;
  brandApi: BrandApi;
  designApi: DesignApi;
  sportsApi: PreviewSportsApi;
}

const LABEL = contractRegExp('Label');
const NOTE = contractRegExp('Note');

/** The version to open: the one in the address, else the draft, else the published one, else the latest. */
function versionToOpen(detail: VisualTemplateDetail, requested: string | null): string | null {
  if (requested !== null && detail.versions.some((version) => version.id === requested)) return requested;
  return detail.template.draftVersionId ?? detail.template.publishedVersion?.id ?? detail.versions.at(-1)?.id ?? null;
}

/**
 * Editor of a structured visual template (PD-ARCH-01G-C) at `/templates/visual/:templateId`: opens the draft version,
 * or the published one read-only (`?version=` opens another one). Everything here is local: nothing calls an AI
 * provider.
 */
export function TemplateEditorPage({ api, brandApi, designApi, sportsApi }: TemplateEditorPageProps) {
  const templateId = useParams().templateId ?? '';
  const [params, setParams] = useSearchParams();
  const load = useCallback((signal: AbortSignal) => api.get(templateId, signal), [api, templateId]);
  const detail = useResource(load);
  const assets = useResource(useCallback((signal: AbortSignal) => brandApi.listAssets(signal), [brandApi]));
  const identity = useResource(useCallback((signal: AbortSignal) => brandApi.getIdentity(signal), [brandApi]));
  const [reloads, setReloads] = useState(0);
  const { update } = detail;
  /** Refreshes the template and its versions without leaving the editor (no loading state). */
  const refresh = useCallback(() => {
    api.get(templateId).then(
      (data) => update(() => data),
      () => undefined,
    );
  }, [api, templateId, update]);

  const open = (versionId: string) => {
    const next = new URLSearchParams(params);
    next.set('version', versionId);
    setParams(next);
  };

  return (
    <section aria-labelledby="template-editor-title" className="grid min-w-0 gap-6">
      <p className="m-0">
        <Link to="/templates/create" className="focus-studio text-body-sm text-text-link underline underline-offset-2">
          {editorCopy.back}
        </Link>
      </p>
      {detail.state.status === 'loading' ? <LoadingState layout="panel" label={editorCopy.loading} /> : null}
      {detail.state.status === 'error' ? (
        <>
          <h1 id="template-editor-title" className="sr-only">
            {editorCopy.loadFailedTitle}
          </h1>
          <ErrorBanner error={detail.state.error} title={editorCopy.loadFailedTitle} onRetry={detail.reload} />
        </>
      ) : null}
      {detail.state.status === 'ready'
        ? (() => {
            const data = detail.state.data;
            const versionId = versionToOpen(data, params.get('version'));
            return versionId === null ? null : (
              <VersionEditor
                key={`${versionId}:${String(reloads)}`}
                api={api}
                brandApi={brandApi}
                designApi={designApi}
                sportsApi={sportsApi}
                detail={data}
                versionId={versionId}
                assets={assets.state.status === 'ready' ? assets.state.data : []}
                identity={identity.state.status === 'ready' ? identity.state.data : null}
                showPreview={params.get('panel') === 'preview'}
                onOpenVersion={open}
                onDetailChanged={refresh}
                onReload={() => {
                  detail.reload();
                  setReloads((value) => value + 1);
                }}
              />
            );
          })()
        : null}
    </section>
  );
}

interface VersionEditorProps extends TemplateEditorPageProps {
  detail: VisualTemplateDetail;
  versionId: string;
  assets: readonly BrandAsset[];
  identity: BrandIdentity | null;
  showPreview: boolean;
  onOpenVersion: (versionId: string) => void;
  onDetailChanged: () => void;
  onReload: () => void;
}

interface Draft {
  background: VisualTemplateBackgroundInput;
  backgroundLabel: string;
  layers: VisualTemplateLayer[];
}

function draftOf(version: VisualTemplateVersion): Draft {
  return {
    background: { source: version.background.source, id: version.background.id },
    backgroundLabel: version.background.label,
    layers: version.layers,
  };
}

function sameContent(draft: Draft, version: VisualTemplateVersion): boolean {
  return (
    draft.background.source === version.background.source &&
    draft.background.id === version.background.id &&
    JSON.stringify(draft.layers) === JSON.stringify(version.layers)
  );
}

function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.problem?.code === 'VERSION_CONFLICT';
}

function VersionEditor({
  api,
  brandApi,
  designApi,
  sportsApi,
  detail,
  versionId,
  assets,
  identity,
  showPreview,
  onOpenVersion,
  onDetailChanged,
  onReload,
}: VersionEditorProps) {
  const baseId = useId();
  const template = detail.template;
  const load = useCallback(
    (signal: AbortSignal) => api.getVersion(template.id, versionId, signal),
    [api, template.id, versionId],
  );
  const loaded = useResource(load);
  const [saved, setSaved] = useState<VisualTemplateVersion | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'publish' | 'version' | 'discard' | 'metadata' | null>(null);
  const [failure, setFailure] = useState<{ title: string; error: unknown } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [dialog, setDialog] = useState<'publish' | 'background' | 'metadata' | 'discard' | null>(null);
  const previewRef = useRef<HTMLElement>(null);

  if (loaded.state.status === 'ready' && saved === null) {
    setSaved(loaded.state.data);
    setDraft(draftOf(loaded.state.data));
  }

  useEffect(() => {
    if (showPreview && saved !== null) previewRef.current?.scrollIntoView?.({ block: 'start' });
  }, [showPreview, saved]);

  const layerNames = useMemo(
    () => new Map((draft?.layers ?? []).map((layer) => [layer.id, layer.name] as const)),
    [draft],
  );

  if (loaded.state.status === 'loading') return <LoadingState layout="panel" label={editorCopy.loading} />;
  if (loaded.state.status === 'error') {
    return <ErrorBanner error={loaded.state.error} title={editorCopy.loadFailedTitle} onRetry={loaded.reload} />;
  }
  if (saved === null || draft === null) return null;

  const archived = template.status === 'archived';
  const readOnly = saved.status === 'published' || archived;
  const dirty = !readOnly && !sameContent(draft, saved);
  const selected = draft.layers.find((layer) => layer.id === selectedId) ?? null;
  const errors = saved.validation.issues.filter((issue) => issue.severity === 'error').length;
  const canPublish = !readOnly && !dirty && saved.validation.publishable && busy === null;
  const backgroundUrl =
    draft.background.source === saved.background.source && draft.background.id === saved.background.id
      ? api.backgroundUrl(template.id, saved.id)
      : draft.background.source === 'design_proposal'
        ? designApi.proposalBackgroundUrl(draft.background.id)
        : brandApi.assetFileUrl(draft.background.id);
  const palette = Object.fromEntries((identity?.palette ?? []).map((entry) => [entry.role, entry.value]));
  const fonts = Object.fromEntries(
    (identity?.typography ?? []).map((entry) => [entry.role, { family: entry.family, weight: entry.weight }]),
  );
  const logo = officialMark(assets, 'brand_logo');
  const mascot = officialMark(assets, 'mascot');
  const firstImage = imageAssets(assets)[0];

  function change(next: Partial<Draft>) {
    setDraft((current) => (current === null ? current : { ...current, ...next }));
  }

  function setLayers(update: (layers: VisualTemplateLayer[]) => VisualTemplateLayer[]) {
    setDraft((current) => (current === null ? current : { ...current, layers: update(current.layers) }));
  }

  function add(request: NewLayerRequest) {
    if (draft === null) return;
    const layer = newLayer(request, draft.layers);
    setLayers((layers) => [...layers, layer]);
    setSelectedId(layer.id);
  }

  function fail(title: string, error: unknown) {
    if (isConflict(error)) {
      setConflict(true);
    } else {
      setFailure({ title, error });
    }
  }

  /** Saves the draft; resolves with the saved version, or null on failure. */
  async function save(): Promise<VisualTemplateVersion | null> {
    if (saved === null || draft === null || readOnly) return saved;
    setBusy('save');
    setFailure(null);
    try {
      const next = await api.saveVersion(template.id, saved.id, {
        revision: saved.revision,
        background: draft.background,
        layers: draft.layers,
      });
      setSaved(next);
      setDraft(draftOf(next));
      setAnnouncement(editorCopy.saved);
      return next;
    } catch (error) {
      fail(editorCopy.saveFailedTitle, error);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function prepare(): Promise<string | null> {
    if (!dirty) return saved?.id ?? null;
    return (await save())?.id ?? null;
  }

  async function publish() {
    if (saved === null || !canPublish) return;
    setBusy('publish');
    setFailure(null);
    try {
      const next = await api.publishVersion(template.id, saved.id, saved.revision);
      setSaved(next);
      setDraft(draftOf(next));
      setDialog(null);
      setAnnouncement(editorCopy.published(next.version));
      onDetailChanged();
    } catch (error) {
      setDialog(null);
      fail(editorCopy.publishFailedTitle, error);
    } finally {
      setBusy(null);
    }
  }

  async function newVersion() {
    if (saved === null) return;
    setBusy('version');
    setFailure(null);
    try {
      const next = await api.createVersion(template.id, { fromVersionId: saved.id });
      onDetailChanged();
      onOpenVersion(next.id);
    } catch (error) {
      fail(editorCopy.actionFailedTitle, error);
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    if (saved === null) return;
    setBusy('discard');
    setFailure(null);
    try {
      await api.deleteVersion(template.id, saved.id);
      setDialog(null);
      onDetailChanged();
      if (template.publishedVersion !== null) onOpenVersion(template.publishedVersion.id);
    } catch (error) {
      setDialog(null);
      fail(editorCopy.actionFailedTitle, error);
    } finally {
      setBusy(null);
    }
  }

  function chooseBackground(choice: BackgroundChoice) {
    change({ background: choice.background, backgroundLabel: choice.label });
    setDialog(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-reading gap-2">
          <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">
            {contentTypeLabel[template.contentType]} · {formatLabel[template.format]}
          </p>
          <h1
            id="template-editor-title"
            className="m-0 font-display text-heading-md font-extrabold tracking-display break-words text-text-primary"
          >
            {template.name}
          </h1>
          <p className="m-0 flex flex-wrap items-center gap-2">
            <Badge tone={templateStatusTone[template.status]}>{templateStatusLabel[template.status]}</Badge>
            <Badge tone={saved.status === 'published' ? 'success' : 'info'}>
              {editorCopy.versionHeading(saved.version, versionStatusLabel[saved.status])}
            </Badge>
            {dirty ? <Badge tone="warning">{editorCopy.unsaved}</Badge> : null}
            {template.category === null ? null : <Badge tone="neutral">{template.category}</Badge>}
          </p>
          {template.description === null ? null : (
            <p className="m-0 text-body-sm text-text-secondary">{template.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {detail.versions.length > 1 ? (
            <Select
              id={`${baseId}-version`}
              label={editorCopy.versionSelect}
              value={saved.id}
              disabled={dirty}
              onChange={(event) => onOpenVersion(event.target.value)}
            >
              {detail.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {editorCopy.versionHeading(version.version, versionStatusLabel[version.status])}
                </option>
              ))}
            </Select>
          ) : null}
          {archived ? null : (
            <Button variant="secondary" disabled={busy !== null} onClick={() => setDialog('metadata')}>
              {editorCopy.editMetadata}
            </Button>
          )}
          {readOnly ? null : (
            <>
              <Button
                variant="secondary"
                isLoading={busy === 'save'}
                loadingLabel={editorCopy.saving}
                disabled={!dirty || busy !== null}
                onClick={() => void save()}
              >
                {editorCopy.save}
              </Button>
              <Button disabled={!canPublish} onClick={() => setDialog('publish')}>
                {editorCopy.publish}
              </Button>
            </>
          )}
          {saved.status === 'published' && !archived && template.draftVersionId === null ? (
            <Button
              isLoading={busy === 'version'}
              loadingLabel={editorCopy.creatingVersion}
              disabled={busy !== null}
              onClick={() => void newVersion()}
            >
              {editorCopy.newVersion}
            </Button>
          ) : null}
          {saved.status === 'draft' && !archived && template.publishedVersion !== null ? (
            <Button variant="danger" disabled={busy !== null} onClick={() => setDialog('discard')}>
              {editorCopy.discardDraft}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {archived ? <Alert tone="info">{editorCopy.readOnlyArchived}</Alert> : null}
      {!archived && saved.status === 'published' ? <Alert tone="info">{editorCopy.readOnlyPublished}</Alert> : null}
      {!readOnly && !canPublish && busy === null ? (
        <p className="m-0 text-caption text-text-subtle">
          {dirty ? editorCopy.publishBlockedDirty : errors > 0 ? editorCopy.publishBlockedErrors : ''}
        </p>
      ) : null}
      {conflict ? (
        <Alert tone="warning" title={editorCopy.saveFailedTitle}>
          <span className="grid gap-2">
            <span>{editorCopy.conflict}</span>
            <span>
              <Button size="sm" variant="secondary" onClick={onReload}>
                {editorCopy.reload}
              </Button>
            </span>
          </span>
        </Alert>
      ) : null}
      {failure === null ? null : <ErrorBanner error={failure.error} title={failure.title} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,1fr)]">
        <div className="grid content-start gap-4">
          <EditorCanvas
            canvasWidth={saved.canvasWidth}
            canvasHeight={saved.canvasHeight}
            backgroundUrl={backgroundUrl}
            layers={draft.layers}
            selectedId={selectedId}
            readOnly={readOnly}
            assetUrl={(assetId) => brandApi.assetFileUrl(assetId)}
            palette={palette}
            fonts={fonts}
            onSelect={setSelectedId}
            onMove={(id, box) => setLayers((layers) => replaceLayer(layers, id, (layer) => ({ ...layer, ...box })))}
          />
          <section aria-labelledby={`${baseId}-validation`} className="grid gap-3">
            <h2 id={`${baseId}-validation`} className="m-0 font-display text-heading-sm font-bold text-text-primary">
              {editorCopy.validation}
            </h2>
            <ValidationPanel
              issues={saved.validation.issues}
              stale={dirty}
              layerNames={layerNames}
              onSelect={setSelectedId}
            />
          </section>
        </div>

        <div className="grid content-start gap-5">
          <section aria-labelledby={`${baseId}-layers`} className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`${baseId}-layers`} className="m-0 font-display text-heading-sm font-bold text-text-primary">
                {editorCopy.layers}
              </h2>
              {readOnly ? null : (
                <Button size="sm" variant="secondary" onClick={() => setDialog('background')}>
                  {editorCopy.changeBackground}
                </Button>
              )}
            </div>
            <p className="m-0 text-caption text-text-secondary">{editorCopy.backgroundSource(draft.backgroundLabel)}</p>
            {readOnly ? null : (
              <div role="group" aria-label={editorCopy.addLayer} className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => add({ type: 'text' })}>
                  ＋ {editorCopy.addText}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => add({ type: 'sports_data' })}>
                  ＋ {editorCopy.addSportsData}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={firstImage === undefined}
                  title={firstImage === undefined ? editorCopy.noImageAsset : undefined}
                  onClick={() => firstImage !== undefined && add({ type: 'image', asset: firstImage })}
                >
                  ＋ {editorCopy.addImage}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={logo === undefined}
                  title={logo === undefined ? editorCopy.noLogo : undefined}
                  onClick={() => logo !== undefined && add({ type: 'brand_asset', asset: logo })}
                >
                  ＋ {editorCopy.addLogo}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mascot === undefined}
                  title={mascot === undefined ? editorCopy.noMascot : undefined}
                  onClick={() => mascot !== undefined && add({ type: 'brand_asset', asset: mascot })}
                >
                  ＋ {editorCopy.addMascot}
                </Button>
              </div>
            )}
            <LayerList
              layers={draft.layers}
              selectedId={selectedId}
              readOnly={readOnly}
              backgroundLabel={draft.backgroundLabel}
              onSelect={setSelectedId}
              onMove={(id, direction) => setLayers((layers) => moveLayer(layers, id, direction))}
              onToggle={(id) =>
                setLayers((layers) => replaceLayer(layers, id, (layer) => ({ ...layer, visible: !layer.visible })))
              }
              onRemove={(id) => {
                setLayers((layers) => layers.filter((layer) => layer.id !== id));
                if (selectedId === id) setSelectedId(null);
              }}
            />
          </section>
          <section aria-labelledby={`${baseId}-properties`} className="grid gap-3">
            <h2 id={`${baseId}-properties`} className="m-0 font-display text-heading-sm font-bold text-text-primary">
              {editorCopy.properties}
            </h2>
            {selected === null ? (
              <p className="m-0 text-body-sm text-text-secondary">{editorCopy.noSelection}</p>
            ) : (
              <LayerProperties
                key={selected.id}
                layer={selected}
                contentType={template.contentType}
                readOnly={readOnly}
                assets={assets}
                identity={identity}
                onChange={(layer) => setLayers((layers) => replaceLayer(layers, layer.id, () => layer))}
              />
            )}
          </section>
        </div>
      </div>

      <section ref={previewRef} aria-labelledby={`${baseId}-preview`} className="grid gap-3">
        <h2 id={`${baseId}-preview`} className="m-0 font-display text-heading-sm font-bold text-text-primary">
          {previewCopy.heading}
        </h2>
        <PreviewPanel
          api={api}
          sportsApi={sportsApi}
          templateId={template.id}
          contentType={template.contentType}
          dirty={dirty}
          prepare={prepare}
          layerNames={layerNames}
          onSelectLayer={setSelectedId}
        />
      </section>

      <p className="m-0 text-caption text-text-subtle">
        {saved.publishedAt === null ? null : <>{formatDateTime(saved.publishedAt)} · </>}
        {formatDateTime(saved.updatedAt)}
      </p>

      {dialog === 'publish' ? (
        <Modal title={editorCopy.publishTitle} onClose={() => setDialog(null)} closeDisabled={busy !== null}>
          <div className="grid gap-4">
            <p className="m-0 text-body-md text-text-primary">{editorCopy.publishQuestion(saved.version)}</p>
            {saved.validation.issues.length > 0 ? (
              <p className="m-0 text-body-sm text-text-secondary">
                {editorCopy.warnings(saved.validation.issues.length)}
              </p>
            ) : null}
            <ModalFooter onCancel={() => setDialog(null)} cancelDisabled={busy !== null}>
              <Button
                isLoading={busy === 'publish'}
                loadingLabel={editorCopy.publishing}
                onClick={() => void publish()}
              >
                {editorCopy.publish}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      ) : null}
      {dialog === 'discard' ? (
        <Modal title={editorCopy.discardDraft} onClose={() => setDialog(null)} closeDisabled={busy !== null}>
          <div className="grid gap-4">
            <p className="m-0 text-body-md text-text-primary">{editorCopy.discardQuestion}</p>
            <ModalFooter onCancel={() => setDialog(null)} cancelDisabled={busy !== null}>
              <Button variant="danger" isLoading={busy === 'discard'} onClick={() => void discard()}>
                {editorCopy.discardDraft}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      ) : null}
      {dialog === 'background' ? (
        <BackgroundDialog
          designApi={designApi}
          brandApi={brandApi}
          assets={assets}
          current={draft.background}
          onChoose={chooseBackground}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'metadata' ? (
        <MetadataDialog
          api={api}
          detail={detail}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onDetailChanged();
          }}
        />
      ) : null}
    </>
  );
}

function MetadataDialog({
  api,
  detail,
  onClose,
  onSaved,
}: {
  api: VisualTemplatesApi;
  detail: VisualTemplateDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const baseId = useId();
  const { template } = detail;
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [category, setCategory] = useState(template.category ?? '');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function submit() {
    const trimmed = name.trim();
    if (trimmed === '' || !LABEL.test(trimmed)) {
      setNameError('Escribe un nombre de hasta 80 caracteres.');
      return;
    }
    setNameError(undefined);
    const text = description.trim();
    const group = category.trim();
    setBusy(true);
    setFailure(null);
    try {
      await api.update(template.id, {
        name: trimmed,
        description: text !== '' && NOTE.test(text) ? text : null,
        category: group !== '' && LABEL.test(group) ? group : null,
      });
      onSaved();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={editorCopy.metadataTitle} onClose={onClose} closeDisabled={busy}>
      <div className="grid gap-4">
        <Input
          id={`${baseId}-name`}
          label="Nombre"
          value={name}
          maxLength={80}
          required
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          id={`${baseId}-category`}
          label="Categoría"
          value={category}
          maxLength={80}
          onChange={(event) => setCategory(event.target.value)}
        />
        <Textarea
          id={`${baseId}-description`}
          label="Descripción"
          value={description}
          maxLength={500}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
        />
        {failure === null ? null : <ErrorBanner error={failure} title={editorCopy.actionFailedTitle} />}
        <ModalFooter onCancel={onClose} cancelDisabled={busy}>
          <Button isLoading={busy} onClick={() => void submit()}>
            {editorCopy.metadataSave}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
