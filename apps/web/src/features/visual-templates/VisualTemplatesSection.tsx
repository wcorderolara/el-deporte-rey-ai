import {
  DesignFormatSchema,
  VisualTemplateContentTypeSchema,
  VisualTemplateStatusSchema,
  type DesignFormat,
  type VisualTemplate,
  type VisualTemplateContentType,
  type VisualTemplateStatus,
} from '@edr/contracts';
import { useCallback, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ActionMenu,
  type ActionMenuItem,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Icon,
  IconButton,
  Input,
  LoadingState,
  Modal,
  ModalFooter,
  Select,
  ViewModeToggle,
  formatDateTime,
} from '../../ui';
import { PreviewImage } from '../brand/PreviewImage';
import { useResource } from '../brand/useResource';
import { formatLabel } from '../design/copy';
import { sectionCopy, templateContentTypeLabel, templateStatusLabel, templateStatusTone } from './copy';
import type { VisualTemplatesApi } from './visualTemplatesApi';

export interface VisualTemplatesSectionProps {
  api: VisualTemplatesApi;
  /** Opens the dialog that creates a template from an approved proposal. */
  onCreate: () => void;
}

/** Address of the editor of a template (optionally a version or the preview panel). */
export function editorPath(templateId: string, options: { version?: string; preview?: boolean } = {}): string {
  const query = new URLSearchParams();
  if (options.version !== undefined) query.set('version', options.version);
  if (options.preview === true) query.set('panel', 'preview');
  const search = query.toString();
  return `/templates/visual/${encodeURIComponent(templateId)}${search === '' ? '' : `?${search}`}`;
}

/** The version whose background represents the template: the published one, else the draft. */
function thumbnailVersion(template: VisualTemplate): string | null {
  return template.publishedVersion?.id ?? template.draftVersionId;
}

function Thumbnail({ api, template, size }: { api: VisualTemplatesApi; template: VisualTemplate; size: 'sm' | 'lg' }) {
  const versionId = thumbnailVersion(template);
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas ${size === 'sm' ? 'h-16 w-14' : 'aspect-[4/5] w-full'}`}
    >
      {versionId === null ? null : (
        <PreviewImage
          key={versionId}
          // Saving a draft updates the template, so a changed background gets another address.
          src={api.backgroundUrl(template.id, versionId, template.updatedAt)}
          alt={sectionCopy.thumbnailAlt(template.name)}
          failedText={sectionCopy.thumbnailFailed}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
    </span>
  );
}

function matches(template: VisualTemplate, search: string): boolean {
  const term = search.trim().toLocaleLowerCase('es');
  if (term === '') return true;
  return [template.name, template.category ?? ''].some((value) => value.toLocaleLowerCase('es').includes(term));
}

/**
 * Structured visual templates in Plantillas (PD-ARCH-01G-C): table by default, cards, search, filters by status,
 * content type and format, and the contextual actions of each template. Editing, preview and publication happen in
 * the editor; nothing here calls an AI provider.
 */
export function VisualTemplatesSection({ api, onCreate }: VisualTemplatesSectionProps) {
  const headingId = useId();
  const navigate = useNavigate();
  const load = useCallback((signal: AbortSignal) => api.list(signal), [api]);
  const { state, reload, update } = useResource(load);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VisualTemplateStatus | ''>('');
  const [type, setType] = useState<VisualTemplateContentType | ''>('');
  const [format, setFormat] = useState<DesignFormat | ''>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [deleting, setDeleting] = useState<VisualTemplate | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<unknown>(null);
  const [announcement, setAnnouncement] = useState('');

  const all = state.status === 'ready' ? state.data : [];
  const shown = all.filter(
    (template) =>
      matches(template, search) &&
      (status === '' || template.status === status) &&
      (type === '' || template.contentType === type) &&
      (format === '' || template.format === format),
  );

  function replace(template: VisualTemplate) {
    update((current) => current.map((item) => (item.id === template.id ? template : item)));
  }

  async function act(template: VisualTemplate, action: 'archive' | 'restore' | 'version') {
    if (busy !== null) return;
    setBusy(template.id);
    setFailure(null);
    try {
      if (action === 'version') {
        const version = await api.createVersion(template.id, {});
        void navigate(editorPath(template.id, { version: version.id }));
        return;
      }
      const changed = action === 'archive' ? await api.archive(template.id) : await api.restore(template.id);
      replace(changed);
      setAnnouncement(action === 'archive' ? sectionCopy.archived(template.name) : sectionCopy.restored(template.name));
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (deleting === null || busy !== null) return;
    setBusy(deleting.id);
    setDeleteFailure(null);
    try {
      await api.remove(deleting.id);
      update((current) => current.filter((item) => item.id !== deleting.id));
      setAnnouncement(sectionCopy.deleted(deleting.name));
      setDeleting(null);
    } catch (error) {
      setDeleteFailure(error);
    } finally {
      setBusy(null);
    }
  }

  /** One icon to open the template (edit its draft, or view it) and a menu with every other action of its state. */
  function actions(template: VisualTemplate) {
    const archived = template.status === 'archived';
    const editable = template.draftVersionId !== null && !archived;
    const disabled = busy !== null;
    const items: ActionMenuItem[] = [
      { label: sectionCopy.preview, onSelect: () => void navigate(editorPath(template.id, { preview: true })) },
    ];
    if (editable) {
      items.push({ label: sectionCopy.publish, onSelect: () => void navigate(editorPath(template.id)) });
    }
    if (template.publishedVersion !== null && template.draftVersionId === null && !archived) {
      items.push({ label: sectionCopy.newVersion, disabled, onSelect: () => void act(template, 'version') });
    }
    if (template.publishedVersion !== null) {
      items.push({
        label: archived ? sectionCopy.restore : sectionCopy.archive,
        disabled,
        onSelect: () => void act(template, archived ? 'restore' : 'archive'),
      });
    }
    if (template.publishedVersion === null || archived) {
      items.push({
        label: sectionCopy.deleteAction,
        tone: 'danger',
        disabled,
        onSelect: () => {
          setDeleteFailure(null);
          setDeleting(template);
        },
      });
    }
    return (
      <span className="inline-flex justify-end gap-2">
        <IconButton
          label={editable ? sectionCopy.editTemplate(template.name) : sectionCopy.viewTemplate(template.name)}
          onClick={() => void navigate(editorPath(template.id))}
        >
          <Icon name={editable ? 'pencil' : 'eye'} />
        </IconButton>
        <ActionMenu label={sectionCopy.moreActions(template.name)} items={items} />
      </span>
    );
  }

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid max-w-reading gap-2">
          <h2 id={headingId} className="m-0 font-display text-heading-sm font-extrabold text-text-primary">
            {sectionCopy.heading}
          </h2>
          <p className="m-0 text-body-sm text-text-secondary">{sectionCopy.intro}</p>
        </div>
        <Button onClick={onCreate}>
          <span aria-hidden="true">＋</span>
          {sectionCopy.create}
        </Button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {failure === null ? null : <ErrorBanner error={failure} title={sectionCopy.actionFailedTitle} />}

      {state.status === 'loading' ? <LoadingState layout="panel" label={sectionCopy.loading} /> : null}
      {state.status === 'error' ? (
        <ErrorBanner error={state.error} title={sectionCopy.loadFailedTitle} onRetry={reload} />
      ) : null}
      {state.status === 'ready' && all.length === 0 ? (
        <EmptyState headingLevel={3} title={sectionCopy.empty} description={sectionCopy.emptyDescription} icon="▦" />
      ) : null}
      {state.status === 'ready' && all.length > 0 ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Input
              id={`${headingId}-search`}
              type="search"
              label={sectionCopy.search}
              value={search}
              wrapperClassName="min-w-60"
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              id={`${headingId}-status`}
              label={sectionCopy.filterStatus}
              value={status}
              wrapperClassName="min-w-40"
              onChange={(event) => setStatus(event.target.value as VisualTemplateStatus | '')}
            >
              <option value="">{sectionCopy.all}</option>
              {VisualTemplateStatusSchema.options.map((value) => (
                <option key={value} value={value}>
                  {templateStatusLabel[value]}
                </option>
              ))}
            </Select>
            <Select
              id={`${headingId}-type`}
              label={sectionCopy.filterType}
              value={type}
              wrapperClassName="min-w-48"
              onChange={(event) => setType(event.target.value as VisualTemplateContentType | '')}
            >
              <option value="">{sectionCopy.all}</option>
              {VisualTemplateContentTypeSchema.options.map((value) => (
                <option key={value} value={value}>
                  {templateContentTypeLabel[value]}
                </option>
              ))}
            </Select>
            <Select
              id={`${headingId}-format`}
              label={sectionCopy.filterFormat}
              value={format}
              wrapperClassName="min-w-48"
              onChange={(event) => setFormat(event.target.value as DesignFormat | '')}
            >
              <option value="">{sectionCopy.all}</option>
              {DesignFormatSchema.options.map((value) => (
                <option key={value} value={value}>
                  {formatLabel[value]}
                </option>
              ))}
            </Select>
            <ViewModeToggle value={view} onChange={setView} />
          </div>
          <p className="m-0 text-body-sm text-text-secondary" aria-live="polite">
            {sectionCopy.count(shown.length, all.length)}
          </p>
          {shown.length === 0 ? <p className="m-0 text-body-sm text-text-secondary">{sectionCopy.noResults}</p> : null}
          {shown.length > 0 && view === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">{sectionCopy.tableCaption}</caption>
                <thead>
                  <tr className="border-b border-border-subtle text-caption text-text-secondary">
                    {[
                      sectionCopy.columns.preview,
                      sectionCopy.columns.name,
                      sectionCopy.columns.type,
                      sectionCopy.columns.format,
                      sectionCopy.columns.status,
                      sectionCopy.columns.published,
                      sectionCopy.columns.draft,
                      sectionCopy.columns.updated,
                    ].map((column) => (
                      <th key={column} scope="col" className="px-3 py-3">
                        {column}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-right">
                      {sectionCopy.columns.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((template) => (
                    <tr key={template.id} className="border-b border-border-subtle align-middle last:border-0">
                      <td className="px-3 py-3">
                        <Thumbnail api={api} template={template} size="sm" />
                      </td>
                      <th scope="row" className="px-3 py-3 text-body-sm font-bold text-text-primary">
                        {template.name}
                        {template.category === null ? null : (
                          <small className="block font-normal text-text-secondary">{template.category}</small>
                        )}
                      </th>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {templateContentTypeLabel[template.contentType]}
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">{template.format}</td>
                      <td className="px-3 py-3">
                        <Badge tone={templateStatusTone[template.status]}>{templateStatusLabel[template.status]}</Badge>
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {template.publishedVersion === null
                          ? sectionCopy.none
                          : sectionCopy.publishedVersion(template.publishedVersion.version)}
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {template.draftVersionId === null ? sectionCopy.noDraft : sectionCopy.hasDraft}
                      </td>
                      <td className="px-3 py-3 text-body-sm text-text-secondary">
                        {formatDateTime(template.updatedAt)}
                      </td>
                      <td className="px-3 py-3 text-right">{actions(template)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {shown.length > 0 && view === 'cards' ? (
            <ul
              aria-label={sectionCopy.listLabel}
              className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3"
            >
              {shown.map((template) => (
                <li key={template.id} className="min-w-0">
                  <Card as="article" aria-label={template.name} className="flex h-full min-w-0 flex-col gap-3">
                    <Thumbnail api={api} template={template} size="lg" />
                    <div className="grid gap-1">
                      <p className="m-0 text-caption font-bold tracking-label text-info uppercase">
                        {templateContentTypeLabel[template.contentType]} · {template.format}
                      </p>
                      <h3 className="m-0 break-words text-body-lg font-bold text-text-primary">{template.name}</h3>
                      <p className="m-0 text-caption text-text-secondary">
                        {template.category === null ? '' : `${template.category} · `}
                        {formatDateTime(template.updatedAt)}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={templateStatusTone[template.status]}>{templateStatusLabel[template.status]}</Badge>
                      {template.publishedVersion === null ? null : (
                        <Badge tone="neutral">{sectionCopy.publishedVersion(template.publishedVersion.version)}</Badge>
                      )}
                      {template.draftVersionId === null ? null : <Badge tone="info">{sectionCopy.hasDraft}</Badge>}
                    </span>
                    <div className="mt-auto pt-1">{actions(template)}</div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {deleting === null ? null : (
        <Modal title={sectionCopy.deleteTitle} onClose={() => setDeleting(null)} closeDisabled={busy !== null}>
          <div className="grid gap-4">
            <p className="m-0 text-body-md text-text-primary">{sectionCopy.deleteQuestion(deleting.name)}</p>
            <p className="m-0 text-body-sm text-text-secondary">{sectionCopy.deleteNote}</p>
            {deleteFailure === null ? null : (
              <ErrorBanner error={deleteFailure} title={sectionCopy.actionFailedTitle} />
            )}
            <ModalFooter onCancel={() => setDeleting(null)} cancelDisabled={busy !== null}>
              <Button
                variant="danger"
                isLoading={busy !== null}
                loadingLabel={sectionCopy.deleting}
                onClick={() => void confirmDelete()}
              >
                {sectionCopy.deleteConfirm}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      )}
    </section>
  );
}
