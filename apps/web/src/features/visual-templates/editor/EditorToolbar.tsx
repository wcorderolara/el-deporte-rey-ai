import type { VisualTemplateDetail, VisualTemplateIssue, VisualTemplateVersion } from '@edr/contracts';
import { Link } from 'react-router';

import {
  ActionMenu,
  Badge,
  Button,
  Icon,
  Tabs,
  classNames,
  formatDateTime,
  iconButtonClassName,
  type ActionMenuItem,
} from '../../../ui';
import { formatLabel } from '../../design/copy';
import {
  editorCopy,
  templateContentTypeLabel,
  templateStatusLabel,
  templateStatusTone,
  versionStatusLabel,
} from '../copy';
import { ValidationIndicator } from './ValidationPanel';

export type EditorMode = 'design' | 'preview';

export interface EditorToolbarProps {
  /** ID of the mode tabs; the panels are `tabPanelId(modeTabsId, mode)`. */
  modeTabsId: string;
  detail: VisualTemplateDetail;
  saved: VisualTemplateVersion;
  dirty: boolean;
  readOnly: boolean;
  busy: 'save' | 'publish' | 'version' | 'discard' | 'metadata' | null;
  canPublish: boolean;
  /** Why publishing is not possible now, or null. */
  publishBlocked: string | null;
  mode: EditorMode;
  issues: readonly VisualTemplateIssue[];
  layerNames: ReadonlyMap<string, string>;
  onMode: (mode: EditorMode) => void;
  onOpenVersion: (versionId: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onNewVersion: () => void;
  onDiscard: () => void;
  onMetadata: () => void;
  onSelectLayer: (layerId: string) => void;
}

const VERSION_SELECT = classNames(
  'focus-studio m-0 min-h-9 cursor-pointer rounded-control border border-solid border-border-subtle bg-surface-card',
  'px-2 py-1 font-sans text-caption font-bold text-text-primary disabled:cursor-not-allowed disabled:opacity-60',
);

/**
 * The editor toolbar: back to Plantillas; the content type, format and full name of the template (a tooltip shows a
 * long name; the pencil edits the name and data); the template status, the open version and whether the changes are
 * saved; the Diseño / Vista previa tabs; the validation indicator; and the actions: save the draft and publish (one
 * publication action), or create a new version from a published one. Undo and redo do not exist and are not shown.
 */
export function EditorToolbar({
  modeTabsId,
  detail,
  saved,
  dirty,
  readOnly,
  busy,
  canPublish,
  publishBlocked,
  mode,
  issues,
  layerNames,
  onMode,
  onOpenVersion,
  onSave,
  onPublish,
  onNewVersion,
  onDiscard,
  onMetadata,
  onSelectLayer,
}: EditorToolbarProps) {
  const { template } = detail;
  const archived = template.status === 'archived';
  const more: ActionMenuItem[] =
    saved.status === 'draft' && !archived && template.publishedVersion !== null
      ? [{ label: editorCopy.discardDraft, icon: 'trash', tone: 'danger', onSelect: onDiscard }]
      : [];
  const blockedId = `${modeTabsId}-publish-blocked`;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2">
      <div className="flex min-w-0 flex-[1_1_18rem] items-center gap-3">
        <Link
          to="/templates/create"
          aria-label={editorCopy.back}
          title={editorCopy.back}
          className={iconButtonClassName()}
        >
          <span aria-hidden="true" className="inline-flex">
            <Icon name="arrow-left" />
          </span>
        </Link>
        <div className="grid min-w-0 flex-1">
          <p className="m-0 truncate text-caption font-bold tracking-label text-brand-gold uppercase">
            {templateContentTypeLabel[template.contentType]} · {formatLabel[template.format]}
          </p>
          <div className="flex min-w-0 items-center gap-1">
            <h1
              id="template-editor-title"
              title={template.name}
              className="m-0 min-w-0 truncate font-display text-heading-sm font-extrabold tracking-display text-text-primary"
            >
              {template.name}
            </h1>
            {archived ? null : (
              <button
                type="button"
                aria-label={editorCopy.editMetadata}
                title={editorCopy.editMetadata}
                disabled={busy !== null}
                className="focus-studio m-0 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:cursor-not-allowed"
                onClick={onMetadata}
              >
                <Icon name="pencil" size={16} />
              </button>
            )}
          </div>
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
            <Badge tone={templateStatusTone[template.status]}>{templateStatusLabel[template.status]}</Badge>
            {detail.versions.length > 1 ? (
              <select
                aria-label={editorCopy.versionSelect}
                title={dirty ? editorCopy.versionSelectDirty : undefined}
                className={VERSION_SELECT}
                value={saved.id}
                disabled={dirty}
                onChange={(event) => onOpenVersion(event.target.value)}
              >
                {detail.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {editorCopy.versionHeading(version.version, versionStatusLabel[version.status])}
                  </option>
                ))}
              </select>
            ) : (
              <Badge tone={saved.status === 'published' ? 'success' : 'info'}>
                {editorCopy.versionHeading(saved.version, versionStatusLabel[saved.status])}
              </Badge>
            )}
            {readOnly ? (
              <span className="inline-flex items-center gap-1 text-text-secondary">
                <Icon name="lock" size={14} />
                {editorCopy.readOnlyShort}
              </span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-warning">
                <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
                {editorCopy.unsaved}
              </span>
            ) : (
              <span className="text-text-secondary">{editorCopy.savedAt(formatDateTime(saved.updatedAt))}</span>
            )}
          </p>
        </div>
      </div>

      <Tabs<EditorMode>
        id={modeTabsId}
        label={editorCopy.modes}
        options={[
          { value: 'design', label: editorCopy.designMode },
          { value: 'preview', label: editorCopy.previewMode },
        ]}
        value={mode}
        onChange={onMode}
      />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ValidationIndicator issues={issues} stale={dirty} layerNames={layerNames} onSelect={onSelectLayer} />
        {readOnly ? null : (
          <>
            <Button
              variant="secondary"
              size="sm"
              isLoading={busy === 'save'}
              loadingLabel={editorCopy.saving}
              disabled={!dirty || busy !== null}
              onClick={onSave}
            >
              {editorCopy.save}
            </Button>
            <Button
              size="sm"
              disabled={!canPublish}
              title={publishBlocked ?? undefined}
              aria-describedby={publishBlocked === null ? undefined : blockedId}
              onClick={onPublish}
            >
              {editorCopy.publish}
            </Button>
            {publishBlocked === null ? null : (
              <span id={blockedId} className="sr-only">
                {publishBlocked}
              </span>
            )}
          </>
        )}
        {saved.status === 'published' && !archived && template.draftVersionId === null ? (
          <Button
            size="sm"
            isLoading={busy === 'version'}
            loadingLabel={editorCopy.creatingVersion}
            disabled={busy !== null}
            onClick={onNewVersion}
          >
            {editorCopy.newVersion}
          </Button>
        ) : null}
        {more.length === 0 ? null : <ActionMenu label={editorCopy.moreActions} items={more} />}
      </div>
    </header>
  );
}
