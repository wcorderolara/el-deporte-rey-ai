/**
 * The badge of a team in its edit dialog (PD-ARCH-01G-D, PD-28): the current badge with its source, origin, size and
 * date; uploading a new one (PNG or JPEG up to 5 MiB, with its source and the confirmed authorization to use it) that
 * replaces the current one; and retiring it after a confirmation. The file is sent as is to the server, which checks
 * it again; nothing is downloaded from a provider or a URL.
 */
import type { ManagedTeam } from '@edr/contracts';
import { contractRegExp } from '@edr/contracts';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { Alert, Button, ErrorBanner, Input, formatDateTime } from '../../ui';
import type { CompetitionsApi } from './api';
import { TeamBadge } from './TeamBadge';

/** Largest badge file (the server's upload limit). */
export const MAX_BADGE_BYTES = 5 * 1024 * 1024;
const LABEL = contractRegExp('Label');
const TYPES = ['image/png', 'image/jpeg'];

export const badgeCopy = {
  heading: 'Escudo',
  none: 'Este equipo no tiene escudo. Las plantillas muestran solo el nombre.',
  source: 'Fuente',
  origin: 'Origen',
  manual: 'Subido a mano',
  provider: 'Proveedor',
  size: 'Tamaño',
  uploaded: 'Subido',
  upload: 'Subir escudo',
  replace: 'Sustituir escudo',
  retire: 'Retirar escudo',
  file: 'Archivo del escudo',
  fileHint: 'PNG o JPEG, hasta 5 MB. Recomendado: PNG con fondo transparente.',
  sourceLabel: 'Fuente del escudo',
  sourceHint: 'De dónde obtuviste la imagen, por ejemplo «Sitio oficial del club».',
  authorize: 'Confirmo que tengo autorización para usar este escudo.',
  fileRequired: 'Elige un archivo PNG o JPEG.',
  fileType: 'El escudo debe ser PNG o JPEG.',
  fileTooLarge: 'El archivo supera 5 MB.',
  sourceRequired: 'Escribe la fuente (hasta 80 caracteres, sin caracteres de control).',
  authorizeRequired: 'Confirma la autorización para subir el escudo.',
  previewAlt: 'Vista previa del escudo elegido',
  saving: 'Subiendo…',
  retireQuestion: (name: string): string =>
    `¿Retirar el escudo de ${name}? Dejará de mostrarse; los proyectos ya generados lo conservan.`,
  retireConfirm: 'Sí, retirar',
  retiring: 'Retirando…',
  cancel: 'Cancelar',
  failedTitle: 'No se pudo guardar el escudo',
} as const;

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file === null) {
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export interface TeamBadgeManagerProps {
  team: ManagedTeam;
  api: Pick<CompetitionsApi, 'uploadTeamBadge' | 'deleteTeamBadge'>;
  /** The team as the server answers after a change. */
  onChanged: (team: ManagedTeam) => void;
}

export function TeamBadgeManager({ team, api, onChanged }: TeamBadgeManagerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [errors, setErrors] = useState<{ file?: string; source?: string; authorize?: string }>({});
  const [busy, setBusy] = useState<'upload' | 'retire' | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const preview = useObjectUrl(file);
  const badge = team.badge;

  function reset() {
    setOpen(false);
    setFile(null);
    setSource('');
    setAuthorized(false);
    setErrors({});
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const text = source.trim();
    const next: typeof errors = {};
    if (file === null) next.file = badgeCopy.fileRequired;
    else if (!TYPES.includes(file.type)) next.file = badgeCopy.fileType;
    else if (file.size === 0 || file.size > MAX_BADGE_BYTES) next.file = badgeCopy.fileTooLarge;
    if (text === '' || !LABEL.test(text)) next.source = badgeCopy.sourceRequired;
    if (!authorized) next.authorize = badgeCopy.authorizeRequired;
    setErrors(next);
    if (file === null || Object.keys(next).length > 0 || busy !== null) return;
    setBusy('upload');
    setFailure(null);
    try {
      onChanged(await api.uploadTeamBadge(team.id, { file, source: text }));
      reset();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(null);
    }
  }

  async function retire() {
    if (busy !== null) return;
    setBusy('retire');
    setFailure(null);
    try {
      onChanged(await api.deleteTeamBadge(team.id));
      setConfirmRetire(false);
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="grid min-w-0 gap-3 rounded-xl border border-border-subtle p-4">
      <h3 id={`${id}-title`} className="m-0 text-body-md font-bold text-text-primary">
        {badgeCopy.heading}
      </h3>
      <div className="flex flex-wrap items-start gap-4">
        <span className="rounded-lg border border-border-subtle bg-surface-canvas p-2">
          <TeamBadge team={team} size="lg" decorative={false} />
        </span>
        {badge === null ? (
          <p className="m-0 max-w-sm text-body-sm text-text-secondary">{badgeCopy.none}</p>
        ) : (
          <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-sm">
            <dt className="font-bold text-text-secondary">{badgeCopy.source}</dt>
            <dd className="m-0 break-words text-text-primary">{badge.source}</dd>
            <dt className="font-bold text-text-secondary">{badgeCopy.origin}</dt>
            <dd className="m-0 text-text-primary">
              {badge.origin === 'manual' ? badgeCopy.manual : badgeCopy.provider}
            </dd>
            <dt className="font-bold text-text-secondary">{badgeCopy.size}</dt>
            <dd className="m-0 text-text-primary">
              {badge.width} × {badge.height} px · {badge.mime === 'image/png' ? 'PNG' : 'JPEG'}
            </dd>
            <dt className="font-bold text-text-secondary">{badgeCopy.uploaded}</dt>
            <dd className="m-0 text-text-primary">{formatDateTime(badge.uploadedAt)}</dd>
          </dl>
        )}
      </div>

      {failure === null ? null : <ErrorBanner error={failure} title={badgeCopy.failedTitle} />}

      {open ? (
        <form className="grid min-w-0 gap-3" noValidate onSubmit={(event) => void upload(event)}>
          <label className="grid gap-1 text-body-sm text-text-primary" htmlFor={`${id}-file`}>
            <span className="font-bold">{badgeCopy.file}</span>
            <input
              id={`${id}-file`}
              type="file"
              accept="image/png,image/jpeg"
              aria-describedby={`${id}-file-hint`}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <small id={`${id}-file-hint`} className="text-caption text-text-secondary">
              {badgeCopy.fileHint}
            </small>
            {errors.file === undefined ? null : (
              <span className="text-caption font-bold text-danger">{errors.file}</span>
            )}
          </label>
          {preview === null ? null : (
            <img
              src={preview}
              alt={badgeCopy.previewAlt}
              className="h-24 w-24 rounded-lg border border-border-subtle bg-surface-canvas object-contain p-1"
            />
          )}
          <Input
            id={`${id}-source`}
            label={badgeCopy.sourceLabel}
            description={badgeCopy.sourceHint}
            maxLength={80}
            value={source}
            {...(errors.source === undefined ? {} : { error: errors.source })}
            onChange={(event) => setSource(event.target.value)}
          />
          <label className="flex items-start gap-2 text-body-sm text-text-primary">
            <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
            <span>{badgeCopy.authorize}</span>
          </label>
          {errors.authorize === undefined ? null : (
            <span className="text-caption font-bold text-danger">{errors.authorize}</span>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" isLoading={busy === 'upload'} loadingLabel={badgeCopy.saving}>
              {badge === null ? badgeCopy.upload : badgeCopy.replace}
            </Button>
            <Button type="button" variant="secondary" disabled={busy !== null} onClick={reset}>
              {badgeCopy.cancel}
            </Button>
          </div>
        </form>
      ) : confirmRetire ? (
        <Alert tone="warning" title={badgeCopy.retire}>
          <p className="m-0">{badgeCopy.retireQuestion(team.name)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              isLoading={busy === 'retire'}
              loadingLabel={badgeCopy.retiring}
              onClick={() => void retire()}
            >
              {badgeCopy.retireConfirm}
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={() => setConfirmRetire(false)}>
              {badgeCopy.cancel}
            </Button>
          </div>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {badge === null ? badgeCopy.upload : badgeCopy.replace}
          </Button>
          {badge === null ? null : (
            <Button variant="danger" onClick={() => setConfirmRetire(true)}>
              {badgeCopy.retire}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
