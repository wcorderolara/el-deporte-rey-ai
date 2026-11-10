import {
  contractRegExp,
  type BrandAsset,
  type BrandIdentity,
  type VisualTemplateBackgroundInput,
  type VisualTemplateDetail,
  type VisualTemplateLayer,
  type VisualTemplatePreview,
  type VisualTemplateVersion,
} from '@edr/contracts';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { ApiError } from '../../api/client';
import {
  ActionMenu,
  Alert,
  Button,
  ErrorBanner,
  Icon,
  Input,
  LoadingState,
  Modal,
  ModalFooter,
  Tabs,
  Textarea,
  tabPanelId,
  type ActionMenuItem,
} from '../../ui';
import type { BrandApi } from '../brand/brandApi';
import { useResource } from '../brand/useResource';
import { formatLabel } from '../design/copy';
import type { DesignApi } from '../design/designApi';
import { editorCopy } from './copy';
import { BackgroundDialog, type BackgroundChoice } from './editor/BackgroundDialog';
import { CanvasProperties } from './editor/CanvasProperties';
import { EditorCanvas } from './editor/EditorCanvas';
import { EditorToolbar, type EditorMode } from './editor/EditorToolbar';
import { LayerList } from './editor/LayerList';
import { LayerProperties } from './editor/LayerProperties';
import { PreviewPanel, type PreviewSportsApi } from './editor/PreviewPanel';
import { ResourcesPanel } from './editor/ResourcesPanel';
import { useFillHeight, wideEnough } from './editor/layout';
import { Workspace } from './editor/Workspace';
import {
  hasTeamBadges,
  imageAssets,
  moveLayer,
  newLayer,
  officialMark,
  replaceLayer,
  type NewLayerRequest,
} from './layers';
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

  /** The mode is in the address (`?panel=preview`), so the list can open a template in the preview directly. */
  const setMode = (mode: EditorMode) => {
    const next = new URLSearchParams(params);
    if (mode === 'preview') next.set('panel', 'preview');
    else next.delete('panel');
    setParams(next, { replace: true });
  };

  return (
    <section aria-labelledby="template-editor-title" className="grid min-w-0 gap-3">
      {detail.state.status === 'ready' ? null : (
        <p className="m-0">
          <Link
            to="/templates/create"
            className="focus-studio text-body-sm text-text-link underline underline-offset-2"
          >
            {editorCopy.back}
          </Link>
        </p>
      )}
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
                mode={params.get('panel') === 'preview' ? 'preview' : 'design'}
                onMode={setMode}
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
  mode: EditorMode;
  onMode: (mode: EditorMode) => void;
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
  mode,
  onMode,
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
  /** Layers locked in this editing session: an aid against moving them by mistake, not saved in the template. */
  const [locked, setLocked] = useState<ReadonlySet<string>>(() => new Set());
  const [sidebarTab, setSidebarTab] = useState<'layers' | 'resources'>('layers');
  const [leftOpen, setLeftOpen] = useState(() => wideEnough(1280));
  const [rightOpen, setRightOpen] = useState(true);
  /** The last preview with local data: the design mode shows the value of a bound layer from it. */
  const [preview, setPreview] = useState<VisualTemplatePreview | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const height = useFillHeight(rootRef, saved !== null);

  if (loaded.state.status === 'ready' && saved === null) {
    setSaved(loaded.state.data);
    setDraft(draftOf(loaded.state.data));
  }

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
      ? api.backgroundUrl(template.id, saved.id, saved.background.sha256)
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

  function toggleLock(id: string) {
    setLocked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const addItems: ActionMenuItem[] = [
    { label: editorCopy.addText, icon: 'text', onSelect: () => add({ type: 'text' }) },
    { label: editorCopy.addSportsData, icon: 'data', onSelect: () => add({ type: 'sports_data' }) },
    {
      label: editorCopy.addImage,
      icon: 'image',
      disabled: firstImage === undefined,
      hint: firstImage === undefined ? editorCopy.noImageAsset : undefined,
      onSelect: () => firstImage !== undefined && add({ type: 'image', asset: firstImage }),
    },
    {
      label: editorCopy.addLogo,
      icon: 'mark',
      disabled: logo === undefined,
      hint: logo === undefined ? editorCopy.noLogo : undefined,
      onSelect: () => logo !== undefined && add({ type: 'brand_asset', asset: logo }),
    },
    {
      label: editorCopy.addMascot,
      icon: 'mark',
      disabled: mascot === undefined,
      hint: mascot === undefined ? editorCopy.noMascot : undefined,
      onSelect: () => mascot !== undefined && add({ type: 'brand_asset', asset: mascot }),
    },
    ...(hasTeamBadges(template.contentType)
      ? ([
          {
            label: editorCopy.addHomeBadge,
            icon: 'shield',
            onSelect: () => add({ type: 'team_badge', binding: 'match.homeTeam.badge' }),
          },
          {
            label: editorCopy.addAwayBadge,
            icon: 'shield',
            onSelect: () => add({ type: 'team_badge', binding: 'match.awayTeam.badge' }),
          },
        ] satisfies ActionMenuItem[])
      : []),
  ];
  const publishBlocked =
    readOnly || canPublish || busy !== null
      ? null
      : dirty
        ? editorCopy.publishBlockedDirty
        : errors > 0
          ? editorCopy.publishBlockedErrors
          : null;
  const format = formatLabel[template.format];
  const columns = [leftOpen ? '17.5rem' : '3rem', 'minmax(0,1fr)', rightOpen ? 'clamp(18rem,26vw,21rem)' : '3rem'];
  const modeTabsId = `${baseId}-mode`;
  const sidebarTabsId = `${baseId}-sidebar`;

  return (
    <div ref={rootRef} className="flex min-h-0 min-w-0 flex-col gap-3" style={height === null ? undefined : { height }}>
      <EditorToolbar
        modeTabsId={modeTabsId}
        detail={detail}
        saved={saved}
        dirty={dirty}
        readOnly={readOnly}
        busy={busy}
        canPublish={canPublish}
        publishBlocked={publishBlocked}
        mode={mode}
        issues={saved.validation.issues}
        layerNames={layerNames}
        onMode={onMode}
        onOpenVersion={onOpenVersion}
        onSave={() => void save()}
        onPublish={() => setDialog('publish')}
        onNewVersion={() => void newVersion()}
        onDiscard={() => setDialog('discard')}
        onMetadata={() => setDialog('metadata')}
        onSelectLayer={(layerId) => {
          setSelectedId(layerId);
          onMode('design');
        }}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {readOnly ? (
        <p className="m-0 flex items-center gap-2 rounded-control border border-info/30 bg-info-surface px-3 py-1.5 text-caption text-info">
          <Icon name="lock" size={14} />
          {archived ? editorCopy.readOnlyArchived : editorCopy.readOnlyPublished}
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

      {mode === 'design' ? (
        <div
          id={tabPanelId(modeTabsId, 'design')}
          role="tabpanel"
          aria-labelledby={`${modeTabsId}-tab-design`}
          className="grid min-h-0 flex-1 gap-3"
          style={{ gridTemplateColumns: columns.join(' '), gridTemplateRows: 'minmax(0, 1fr)' }}
        >
          {leftOpen ? (
            <aside
              aria-label={editorCopy.layersAndResources}
              className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-3"
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Tabs<'layers' | 'resources'>
                    id={sidebarTabsId}
                    label={editorCopy.layersAndResources}
                    options={[
                      { value: 'layers', label: editorCopy.layers },
                      { value: 'resources', label: editorCopy.resources },
                    ]}
                    value={sidebarTab}
                    onChange={setSidebarTab}
                  />
                </div>
                <PanelToggle label={editorCopy.collapseLeft} icon="chevron-left" onClick={() => setLeftOpen(false)} />
              </div>
              <div
                id={tabPanelId(sidebarTabsId, sidebarTab)}
                role="tabpanel"
                aria-labelledby={`${sidebarTabsId}-tab-${sidebarTab}`}
                className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1"
              >
                {sidebarTab === 'layers' ? (
                  <>
                    {readOnly ? null : (
                      <ActionMenu
                        label={editorCopy.addLayer}
                        trigger={{ text: editorCopy.addLayer, icon: 'plus' }}
                        align="start"
                        items={addItems}
                      />
                    )}
                    <LayerList
                      layers={draft.layers}
                      selectedId={selectedId}
                      locked={locked}
                      readOnly={readOnly}
                      backgroundLabel={draft.backgroundLabel}
                      onSelect={setSelectedId}
                      onMove={(id, direction) => setLayers((layers) => moveLayer(layers, id, direction))}
                      onToggle={(id) =>
                        setLayers((layers) =>
                          replaceLayer(layers, id, (layer) => ({ ...layer, visible: !layer.visible })),
                        )
                      }
                      onLock={toggleLock}
                      onRemove={(id) => {
                        setLayers((layers) => layers.filter((layer) => layer.id !== id));
                        if (selectedId === id) setSelectedId(null);
                      }}
                    />
                  </>
                ) : (
                  <ResourcesPanel
                    assets={assets}
                    contentType={template.contentType}
                    readOnly={readOnly}
                    background={draft.background}
                    assetUrl={(assetId) => brandApi.assetFileUrl(assetId)}
                    onAddImage={(asset) => add({ type: 'image', asset })}
                    onAddMark={(asset) => add({ type: 'brand_asset', asset })}
                    onUseBackground={(asset) =>
                      chooseBackground({ background: { source: 'brand_asset', id: asset.id }, label: asset.label })
                    }
                    onMoreBackgrounds={() => setDialog('background')}
                  />
                )}
              </div>
            </aside>
          ) : (
            <Rail label={editorCopy.expandLeft} icon="chevron-right" onClick={() => setLeftOpen(true)} />
          )}

          <Workspace canvasWidth={saved.canvasWidth} canvasHeight={saved.canvasHeight} formatLabel={format}>
            {(width, guides) => (
              <EditorCanvas
                canvasWidth={saved.canvasWidth}
                canvasHeight={saved.canvasHeight}
                backgroundUrl={backgroundUrl}
                layers={draft.layers}
                selectedId={selectedId}
                readOnly={readOnly}
                locked={locked}
                width={width}
                guides={guides}
                assetUrl={(assetId) => brandApi.assetFileUrl(assetId)}
                palette={palette}
                fonts={fonts}
                onSelect={setSelectedId}
                onMove={(id, box) => setLayers((layers) => replaceLayer(layers, id, (layer) => ({ ...layer, ...box })))}
              />
            )}
          </Workspace>

          {rightOpen ? (
            <aside
              aria-labelledby={`${baseId}-properties`}
              className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
                <h2 id={`${baseId}-properties`} className="m-0 font-display text-body-md font-bold text-text-primary">
                  {editorCopy.properties}
                </h2>
                <PanelToggle
                  label={editorCopy.collapseRight}
                  icon="chevron-right"
                  onClick={() => setRightOpen(false)}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {selected === null ? (
                  <CanvasProperties
                    contentType={template.contentType}
                    formatLabel={format}
                    canvasWidth={saved.canvasWidth}
                    canvasHeight={saved.canvasHeight}
                    background={draft.background}
                    backgroundLabel={draft.backgroundLabel}
                    readOnly={readOnly}
                    onChangeBackground={() => setDialog('background')}
                  />
                ) : (
                  <LayerProperties
                    key={selected.id}
                    layer={selected}
                    contentType={template.contentType}
                    readOnly={readOnly}
                    locked={locked.has(selected.id)}
                    assets={assets}
                    identity={identity}
                    canvasWidth={saved.canvasWidth}
                    canvasHeight={saved.canvasHeight}
                    preview={preview}
                    onChange={(layer) => setLayers((layers) => replaceLayer(layers, layer.id, () => layer))}
                    onUnlock={() => toggleLock(selected.id)}
                  />
                )}
              </div>
            </aside>
          ) : (
            <Rail label={editorCopy.expandRight} icon="chevron-left" onClick={() => setRightOpen(true)} />
          )}
        </div>
      ) : null}

      {/* Kept mounted in the design mode, so the chosen sports data and the last image survive a change of mode. */}
      <div
        id={tabPanelId(modeTabsId, 'preview')}
        role="tabpanel"
        aria-labelledby={`${modeTabsId}-tab-preview`}
        className={mode === 'preview' ? 'min-h-0 flex-1' : 'hidden'}
      >
        <PreviewPanel
          api={api}
          sportsApi={sportsApi}
          templateId={template.id}
          contentType={template.contentType}
          dirty={dirty}
          prepare={prepare}
          layerNames={layerNames}
          onResult={setPreview}
          onSelectLayer={(layerId) => {
            setSelectedId(layerId);
            onMode('design');
          }}
        />
      </div>

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
    </div>
  );
}

const PANEL_TOGGLE =
  'focus-studio m-0 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-text-secondary hover:bg-surface-overlay hover:text-text-primary';

/** Collapses a side panel, to give the canvas more room. */
function PanelToggle({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: 'chevron-left' | 'chevron-right';
  onClick: () => void;
}) {
  return (
    <button type="button" aria-label={label} title={label} className={PANEL_TOGGLE} onClick={onClick}>
      <Icon name={icon} size={18} />
    </button>
  );
}

/** A collapsed side panel: a narrow rail with the button that opens it again. */
function Rail({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: 'chevron-left' | 'chevron-right';
  onClick: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col items-center rounded-xl border border-border-subtle bg-surface-raised py-2">
      <PanelToggle label={label} icon={icon} onClick={onClick} />
    </div>
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
