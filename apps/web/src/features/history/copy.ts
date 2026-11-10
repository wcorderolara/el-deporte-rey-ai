/**
 * Spanish copy of the export, history and traceability views (PD-06). Contract values that the shared UI or the
 * facts view already name (data modes, fact statuses, fact kinds, evidence, disputes) use their tables.
 *
 * Wording rules (BR-11, BR-12, BR-17, OD-08, OD-21, OD-28, R-219): nothing is published, only local files are
 * written; exports are kept and never deleted; DEMO_DATA is always a demonstration; content using a
 * MANUALLY_APPROVED fact is "atestiguado por el operador", never "verificado".
 */
import type { ElementKind, ExportFileKind, TextFieldName } from '@edr/contracts';

export const historyCopy = {
  intro:
    'Exportación de carruseles con aprobación final a archivos locales, historial de exportaciones y trazabilidad ' +
    'de cada diapositiva exportada.',
  invalidAddress: 'La dirección no identifica un proyecto válido.',
  backToProject: 'Volver al proyecto',
  toReview: 'Ir a la revisión del contenido',
  backToExports: 'Volver a las exportaciones del proyecto',
  loadErrorTitle: 'No se pudieron cargar las exportaciones del proyecto',
  noPublication:
    'La exportación solo escribe archivos en el equipo local (imágenes PNG, caption.txt y manifest.json). La ' +
    'aplicación no publica nada en ninguna red social.',
  projectTitle: 'Proyecto',
  dataMode: 'Modo de datos',
  approvalState: 'Estado de aprobación',
  lastExport: 'Última exportación',
  neverExported: 'Sin exportaciones',
} as const;

export const exportActionCopy = {
  title: 'Exportar un carrusel aprobado',
  loadErrorTitle: 'No se pudo cargar el borrador activo',
  noDraft: 'El proyecto no tiene un borrador activo; no hay ningún carrusel para exportar.',
  noCarousels: 'El borrador activo no tiene carruseles.',
  carousel: (sequence: number, total: number): string => `Carrusel ${sequence} de ${total}`,
  approved: (approvedAt: string): string => `Aprobación final válida desde ${approvedAt}`,
  notApproved:
    'Sin aprobación final válida: apruebe cada diapositiva y el texto de la publicación y dé la aprobación final ' +
    'en la revisión antes de exportar.',
  invalidated:
    'La aprobación final ya no es válida porque el contenido cambió después de aprobarlo. Vuelva a aprobarlo en la ' +
    'revisión antes de exportar.',
  export: (sequence: number): string => `Exportar el carrusel ${sequence}`,
  exporting: 'Exportando…',
  exportErrorTitle: 'No se pudo exportar el carrusel',
  exported: (directory: string): string => `Carrusel exportado en la carpeta ${directory}.`,
  resultTitle: 'Tu carrusel está listo',
  openExport: 'Abrir esta exportación',
  historyLink: 'Ver historial',
} as const;

export const listCopy = {
  title: 'Historial de exportaciones',
  empty: 'Este proyecto todavía no tiene exportaciones.',
  kept: 'Las exportaciones se conservan en el equipo local; la aplicación no las elimina.',
  caption: 'Exportaciones del proyecto, de la más reciente a la más antigua',
  exportedAt: 'Exportado',
  dataMode: 'Modo de datos',
  label: 'Etiqueta',
  demonstration: 'Demostración',
  notDemonstration: '—',
  finalApproval: 'Aprobación final',
  finalApprovalRecorded: 'Registrada',
  files: 'Archivos',
  directory: 'Carpeta',
  open: 'Abrir',
  openLabel: (exportedAt: string): string => `Abrir la exportación del ${exportedAt}`,
  fileCount: (count: number): string => (count === 1 ? '1 archivo' : `${count} archivos`),
} as const;

export const filesCopy = {
  directory: 'Carpeta de la exportación (relativa al directorio de datos)',
  caption: 'Archivos escritos',
  fileName: 'Archivo',
  kind: 'Tipo',
  position: 'Posición',
  sha256: 'SHA-256',
  elementVersion: 'Versión del elemento',
  noElementVersion: 'No aplica',
  scrollRegion: 'Archivos de la exportación',
} as const;

export const exportFileKindLabel: Record<ExportFileKind, string> = {
  slide_image: 'Imagen de diapositiva (PNG)',
  caption_text: 'Texto de la publicación y etiquetas (caption.txt)',
  manifest: 'Manifiesto (manifest.json)',
};

export const detailCopy = {
  title: 'Carrusel exportado',
  invalidAddress: 'La dirección no identifica una exportación válida.',
  loadErrorTitle: 'No se pudo abrir la exportación',
  otherProject: 'Esta exportación no pertenece a este proyecto.',
  exportedAt: 'Exportado',
  dataMode: 'Modo de datos',
  finalApproval: 'Aprobación final',
  carousel: 'Carrusel',
  contentTitle: 'Contenido exportado',
  contentIntro: 'Diapositivas y texto de la publicación exactamente como se exportaron, en el orden del carrusel.',
  noElements: 'La exportación no tiene elementos.',
  slide: (position: number): string => `Diapositiva ${position}`,
  caption: 'Texto de la publicación',
  version: (versionNumber: number): string => `versión ${versionNumber}`,
  imageAlt: (position: number, _versionNumber: number): string => `Imagen exportada de la diapositiva ${position}`,
  noImage: 'No hay imagen registrada para esta versión.',
  trace: (position: number): string => `Ver la trazabilidad de la diapositiva ${position}`,
  filesTitle: 'Archivos',
} as const;

export const attestedCopy = {
  title: 'Contenido atestiguado por el operador',
  body:
    'Este contenido usa datos aprobados manualmente por el operador. La aprobación manual no es una verificación ' +
    'independiente; manifest.json lo indica con operatorAttested.',
} as const;

export const traceCopy = {
  title: (position: number): string => `Trazabilidad de la diapositiva ${position}`,
  titleUnknown: 'Trazabilidad de una diapositiva exportada',
  intro:
    'Datos usados por la diapositiva exportada, con su estado, el motivo, la evidencia de cada fuente (nombre, modo ' +
    'de datos, hora de obtención y versión de importación), la aprobación manual y el registro de disputa.',
  invalidAddress: 'La dirección no identifica una diapositiva exportada válida.',
  loadErrorTitle: 'No se pudo cargar la trazabilidad de la diapositiva',
  backToExport: 'Volver a la exportación',
  dataMode: 'Modo de datos',
  elementVersion: 'Versión del elemento exportado',
  factsTitle: 'Datos de la diapositiva',
  noFacts: 'Esta diapositiva no usa ningún dato.',
  summary: (total: number, verified: number, unverified: number, attested: number): string =>
    `${total === 1 ? '1 dato' : `${total} datos`}: ${verified} verificados, ${unverified} sin verificar, ` +
    `${attested} aprobados manualmente (atestiguados por el operador).`,
  manualApproval: 'Aprobación manual',
  noManualApproval: 'Sin aprobación manual',
  blockReason: 'Bloqueo de publicación indicado por el servidor',
} as const;

export const elementKindLabel: Record<ElementKind, string> = {
  slide: 'Diapositiva',
  caption: 'Texto de la publicación',
};

export const textFieldLabel: Record<TextFieldName, string> = {
  headline: 'Titular',
  description: 'Descripción',
  caption: 'Texto de la publicación',
  hashtags: 'Etiquetas',
  title: 'Título',
  score: 'Marcador',
  team_home: 'Equipo local',
  team_away: 'Equipo visitante',
  kickoff: 'Inicio',
  standings: 'Clasificación',
  footer: 'Pie',
  demo_label: 'Etiqueta de demostración',
  match_status: 'Estado del partido',
  fixtures: 'Partidos',
  score_home: 'Goles local',
  score_away: 'Goles visitante',
  kickoff_time: 'Hora',
};
