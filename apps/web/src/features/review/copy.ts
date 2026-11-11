/**
 * Spanish copy of the review feature (PD-06) and the tables that turn the contract values of drafts, elements, QA
 * results, content flags, block reasons and final-approval refusals into operator-facing text. Shared values (data
 * modes, fact statuses, provenance, problems) use the tables of `src/ui/copy.ts`.
 *
 * Wording rules (as in `src/ui/copy.ts`): MANUALLY_APPROVED is "aprobado manualmente" and "atestiguado por el
 * operador", never "verificado" (BR-12, BR-17, OD-28); DEMO_DATA is always a demonstration (OD-21); no text assumes a
 * competition format or claims real-time data.
 */
import type {
  BlockReason,
  ContentFlag,
  ElementVersionState,
  FactKind,
  FinalApprovalRefusalReason,
  QaCheck,
  SlideType,
  TextFieldName,
} from '@edr/contracts';

export const reviewCopy = {
  title: 'Revisión del contenido',
  carouselPosition: (sequence: number, total: number): string => `Carrusel ${sequence} de ${total}`,
  slideProgress: (approved: number, total: number): string => `${approved} de ${total} diapositivas aprobadas`,
  carouselPicker: 'Elegir carrusel para revisar',
  loading: 'Cargando el borrador…',
  loadError: 'No se pudo cargar el borrador',
  notFound: 'La dirección no corresponde a ningún proyecto.',
  noDraft: 'Este proyecto todavía no tiene un borrador activo. Inicie una ejecución desde la página del proyecto.',
  backToProject: 'Volver al proyecto',
  backToList: 'Volver a la lista de proyectos',
  refreshing: 'Actualizando la vista…',
  refresh: 'Actualizar la vista',
  refreshError: 'No se pudo actualizar la vista',
  noCarousels: 'El borrador no tiene carruseles.',
} as const;

export const carouselCopy = {
  title: (sequence: number, total: number): string => (total > 1 ? `Carrusel ${sequence} de ${total}` : 'Carrusel'),
  slideNavigation: 'Diapositivas del carrusel',
  slidesHeading: (count: number): string => `${count} ${count === 1 ? 'diapositiva' : 'diapositivas'}`,
  slideButton: (position: number, type: SlideType | null, state: ElementVersionState): string =>
    `${elementCopy.slide(position, type)}, ${versionStateLabel[state]}`,
  slidePosition: (position: number, total: number): string => `Diapositiva ${position} de ${total}`,
  previous: 'Anterior',
  next: 'Siguiente',
  noSlides: 'Este carrusel todavía no tiene diapositivas para revisar.',
  approvalSummary: (approved: number, total: number, pending: number, blocked: number) =>
    `${approved} de ${total} diapositivas aprobadas; ${pending} pendientes${blocked > 0 ? `, ${blocked} requieren atención` : ''}.`,
  approveAll: 'Aprobar todas',
  approveAllTitle: '¿Aprobar todas las diapositivas?',
  bulkCount: (count: number, label: string) => `${count} ${label}`,
  eligible: 'listas para aprobar',
  alreadyApproved: 'ya aprobadas',
  warningSlides: 'Advertencias sin confirmar',
  blockedSlides: 'Diapositivas bloqueadas o pendientes',
  confirmBulk: (count: number) => `Aprobar ${count} ${count === 1 ? 'diapositiva' : 'diapositivas'}`,
  cancel: 'Cancelar',
  noEligible: 'No hay diapositivas listas para aprobar. Revise las advertencias y los elementos pendientes.',
  bulkRunning: 'Aprobando diapositivas…',
  bulkResult: (approved: number, failed: number, refreshed: boolean) =>
    failed === 0 && refreshed
      ? `${approved} ${approved === 1 ? 'diapositiva aprobada' : 'diapositivas aprobadas'}.`
      : failed === 0
        ? `${approved} aprobaciones aplicadas; falta confirmar el estado actualizado.`
        : `${approved} ${approved === 1 ? 'aprobada' : 'aprobadas'}; ${failed} ${failed === 1 ? 'requiere' : 'requieren'} atención. No se completó toda la aprobación.`,
  bulkFailure: (position: number) =>
    `No se pudo aprobar la diapositiva ${position}. Actualice el estado antes de volver a intentarlo.`,
  retryRemaining: 'Revisar e intentar de nuevo las pendientes',
  refreshState: 'Actualizar el estado',
  dismiss: 'Listo',
  allSlidesApproved: 'Todas las diapositivas están aprobadas. Revise el copy o continúe con la aprobación final.',
  noNextPending: 'No quedan diapositivas pendientes. Revise el copy o continúe con la aprobación final.',
  movedToNext: (approved: string, next: string): string => `${approved} aprobada. Ahora: ${next}.`,
  bulkReasons: 'Ver motivos',
  bulkDialogLabel: 'Confirmar aprobación de diapositivas',
  finalAction: 'Aprobar carrusel completo',
} as const;

/** The review workspace (UX-REVIEW-01): header, indicators, modes, slide workspace and downloads. */
export const workspaceCopy = {
  modesLabel: 'Modo de revisión',
  designTab: 'Diseño visual',
  copyTab: 'Copy editorial',
  pending: (count: number): string => (count === 1 ? '1 pendiente' : `${count} pendientes`),
  approved: 'Aprobado',
  notGenerated: 'Sin generar',
  unsaved: 'Sin guardar',
  indicatorsLabel: 'Estado de la revisión',
  slidesIndicator: 'Diapositivas',
  slidesValue: (approved: number, total: number): string => `${approved}/${total} aprobadas`,
  copyIndicator: 'Copy',
  copyValue: (approved: number, total: number): string => `${approved}/${total} aprobados`,
  copyNotGenerated: 'editorial sin generar',
  blockingIndicator: 'Bloqueos',
  blockingValue: (count: number): string => (count === 0 ? 'ninguno' : String(count)),
  warningsIndicator: 'Advertencias',
  format: (width: number, height: number): string => `${width} × ${height} px`,
  demoNote: 'Datos sintéticos: no se consideran verificados ni listos para publicación.',
  railCollapse: 'Contraer la lista de diapositivas',
  railExpand: 'Mostrar la lista de diapositivas',
  bulkTitle: 'Aprobación masiva',
  bulkEligible: (count: number): string =>
    count === 1 ? '1 diapositiva lista para aprobar' : `${count} diapositivas listas para aprobar`,
  bulkHeld: (count: number): string =>
    count === 1 ? '1 no se puede aprobar todavía' : `${count} no se pueden aprobar todavía`,
  bulkNone: 'Ninguna diapositiva está lista para la aprobación masiva.',
  bulkCopyNote: 'No aprueba el copy editorial ni el texto del carrusel.',
  approveAllCount: (count: number): string => `Aprobar todas (${count})`,
  previewLabel: (name: string): string => `Vista previa: ${name}`,
  previewPosition: (position: number, total: number): string =>
    `Diapositiva ${String(position).padStart(2, '0')} de ${String(total).padStart(2, '0')}`,
  previous: 'Anterior',
  next: 'Siguiente',
  zoomOut: 'Alejar',
  zoomIn: 'Acercar',
  zoomFit: 'Ajustar al espacio',
  zoomFitted: 'Ajustada',
  zoomLevel: (percent: number): string => `${percent} %`,
  fullscreen: 'Pantalla completa',
  exitFullscreen: 'Salir de pantalla completa',
  previewTools: 'Navegación y zoom de la vista previa',
} as const;

/** The final approval of the selected carousel (UX-REVIEW-01): a header action and a confirmation dialog. */
export const finalDialogCopy = {
  title: 'Aprobar carrusel completo',
  intro:
    'Registra la aprobación final de las versiones que ves ahora. Si después cambias una diapositiva o el texto del carrusel, la aprobación deja de ser válida.',
  slides: 'Diapositivas aprobadas',
  slidesValue: (approved: number, total: number): string => `${approved} de ${total}`,
  caption: 'Texto del carrusel',
  captionApproved: 'Aprobado: se incluye en la descarga (caption.txt).',
  captionPending: 'Sin aprobar: la descarga tendrá solo las diapositivas.',
  captionMissing: 'Este carrusel no tiene texto de publicación.',
  editorial: 'Copy editorial',
  editorialValue: (approved: number, total: number): string =>
    `${approved} de ${total} textos aprobados. No forma parte del carrusel: se descarga aparte (.txt).`,
  editorialNone: 'Sin generar. No forma parte del carrusel: se descarga aparte (.txt).',
  editorialUnknown: 'No se pudo leer su estado. No forma parte del carrusel.',
  blocking: 'Errores bloqueantes',
  blockingNone: 'Ninguno',
  notReadyAnymore:
    'El carrusel cambió y ya no está listo para la aprobación final. Revisa los elementos pendientes antes de confirmar.',
  confirm: 'Confirmar aprobación final',
  cancel: 'Cancelar',
  notReadyReason: (pending: number): string =>
    pending === 1
      ? 'Falta 1 diapositiva por aprobar o corregir.'
      : `Faltan ${pending} diapositivas por aprobar o corregir.`,
} as const;

/** The protection of unsaved edits of the editorial copy (UX-REVIEW-01). */
export const unsavedCopy = {
  title: 'Cambios sin guardar',
  body: 'Tienes cambios sin guardar en el copy editorial. Si sales de la revisión ahora, se pierden.',
  leave: 'Salir sin guardar',
} as const;

/** Downloads offered from the review once the carousel has a valid final approval (UX-REVIEW-01). */
export const downloadCopy = {
  more: 'Más opciones',
  slide: (position: number): string => `Descargar diapositiva ${position} (PNG)`,
  slideUnavailable: 'La diapositiva seleccionada no tiene imagen',
  editorialFile: 'Descargar copy editorial (.txt)',
  editorialCopy: 'Copiar copy editorial',
  editorialUnavailable: 'Todavía no hay copy editorial',
  slideStarted: (position: number): string => `Descarga de la diapositiva ${position} iniciada.`,
  editorialDownloaded: 'Copy editorial descargado.',
  copied: 'Copy editorial copiado al portapapeles.',
  copyFailed: 'No se pudo copiar. Abre el copy editorial y cópialo desde allí.',
} as const;

export const slideTypeLabel: Record<SlideType, string> = {
  cover: 'Portada',
  match_result: 'Resultado',
  standings: 'Clasificación',
  closing: 'Cierre',
  round_overview: 'Resumen de jornada',
  fixture: 'Partido programado',
  match_preview: 'Información del encuentro',
};

export const elementCopy = {
  slide: (position: number, type: SlideType | null): string =>
    type === null ? `Diapositiva ${position}` : `Diapositiva ${position}: ${slideTypeLabel[type]}`,
  caption: 'Texto de publicación y hashtags',
  slideEyebrow: 'Inspector de revisión',
  captionEyebrow: 'Texto del carrusel',
  captionReadable: 'Texto de publicación y hashtags',
  captionIntro:
    'Acompaña la descarga del carrusel (caption.txt) solo si está aprobado cuando das la aprobación final. Aprobarlo o retirar su aprobación después invalida la aprobación final.',
  approveSlide: 'Aprobar diapositiva',
  approveAndNextHint: 'Al aprobar pasa a la siguiente diapositiva pendiente.',
  approveCaption: 'Aprobar texto del carrusel',
  approvedStatus: 'Aprobada',
  statusBlocked: 'Bloqueada por datos',
  statusRegenerate: 'Requiere regenerar',
  statusWarning: 'Advertencia por confirmar',
  statusPendingQa: 'Pendiente del control visual',
  statusSuperseded: 'Reemplazada',
  statusReady: 'Lista para aprobar',
  needsAttention: 'Requiere atención antes de aprobar',
  noIssues: 'Sin problemas detectados',
  warningSummary: (count: number): string =>
    count === 1 ? 'Hay una advertencia del control visual.' : `Hay ${count} advertencias del control visual.`,
  regenerateLabel: (kind: 'slide' | 'caption'): string =>
    kind === 'slide' ? 'Regenerar diapositiva' : 'Regenerar texto del carrusel',
  regenerateHint: 'Crea una versión nueva: pasa otra vez por el control visual y necesita una aprobación nueva.',
  nextPending: 'Siguiente pendiente',
  copyField: (label: string): string => `Copiar ${label}`,
  validationsTitle: 'Validaciones',
  detailsTitle: 'Detalles de la versión',
  versionLine: (version: number): string => `Versión ${version}`,
  versionLabel: 'Versión',
  sizeLabel: 'Tamaño',
  templateLabel: 'Plantilla',
  copy: 'Copiar',
  copyAll: 'Copiar texto',
  copied: 'Copiado al portapapeles.',
  copyFailed: 'No se pudo copiar. Selecciona el texto y cópialo a mano.',
  createdAt: 'Creada',
  textTitle: 'Texto de la diapositiva',
  imageAlt: (name: string, version: number): string => `Imagen de ${name}, versión ${version}`,
  noImage: 'Imagen todavía no disponible.',
  dimensions: (width: number, height: number): string => `${width} × ${height} px`,
  noText: 'Sin texto.',
  blocked: 'Bloqueada',
  validationSummary: (blocking: number, warnings: number, pending: boolean): string =>
    blocking === 0 && warnings === 0
      ? pending
        ? 'Control visual en curso'
        : 'Sin errores'
      : [
          blocking === 0 ? '' : blocking === 1 ? '1 bloqueo' : `${blocking} bloqueos`,
          warnings === 0 ? '' : warnings === 1 ? '1 advertencia' : `${warnings} advertencias`,
        ]
          .filter((part) => part !== '')
          .join(' · '),
  severityBlocking: 'Bloqueo',
  blockedAction:
    'Corrección: confirma o corrige el dato en la página del proyecto, o excluye el partido en «Datos y trazabilidad del borrador».',
  flagsAction: 'Corrección: regenera el elemento hasta que una versión nueva no tenga observaciones.',
  affects: (name: string): string => `Elemento afectado: ${name}.`,
  qaPassed: (count: number): string =>
    count === 1 ? '1 control visual superado' : `${count} controles visuales superados`,
  blockedTitle: 'Datos que bloquean la aprobación',
  blockedIntro: 'No se puede aprobar mientras estos datos no sean publicables:',
  flagsTitle: 'Observaciones del contenido',
  flagField: 'Campo',
  flagExcerpt: 'Fragmento',
  qaTitle: 'Control visual',
  qaIntro:
    'El control visual revisa la imagen y el texto generados. Confirma cada advertencia para poder aprobar; un fallo bloqueante se resuelve regenerando.',
  qaNone: 'Sin resultados del control visual para esta versión.',
  actionsTitle: 'Acciones',
  reviewPanel: 'Estado y acciones',
  approve: 'Aprobar esta versión',
  approving: 'Aprobando…',
  withdraw: 'Retirar la aprobación',
  withdrawing: 'Retirando la aprobación…',
  regenerate: 'Regenerar este elemento',
  regenerating: 'Regenerando… puede tardar unos segundos.',
  approved: (version: number): string => `Versión ${version} aprobada.`,
  withdrawn: 'Aprobación retirada.',
  regenerated: (version: number): string =>
    `Se creó la versión ${version}. Pasa de nuevo por el control visual y necesita una aprobación nueva.`,
  acknowledged: 'Advertencia confirmada.',
  cannotApprove: 'Todavía no se puede aprobar:',
  approveError: 'No se pudo aprobar',
  withdrawError: 'No se pudo retirar la aprobación',
  regenerateError: 'No se pudo regenerar',
  acknowledgeError: 'No se pudo confirmar la advertencia',
  refusedFacts: 'El servidor rechazó la aprobación por estos datos:',
} as const;

export const versionStateLabel: Record<ElementVersionState, string> = {
  pending_qa: 'Pendiente del control visual',
  qa_failed: 'Control visual fallido',
  ready: 'Lista para aprobar',
  approved: 'Aprobada',
  superseded: 'Reemplazada por una versión nueva',
};

/** Why an element cannot be approved yet, derived from the shown version (the server decides). */
export type ApprovalObstacle = 'blocked' | 'flagged' | 'qa_failed' | 'qa_ack_required' | 'pending_qa' | 'superseded';

export const approvalObstacleLabel: Record<ApprovalObstacle, string> = {
  blocked: 'usa datos que no son publicables',
  flagged: 'tiene observaciones del contenido; regenere el elemento',
  qa_failed: 'el control visual falló; regenere el elemento hasta que una versión nueva lo pase',
  qa_ack_required: 'hay advertencias del control visual sin confirmar',
  pending_qa: 'el control visual todavía no terminó',
  superseded: 'la versión fue reemplazada; actualice la vista',
};

export const textFieldLabel: Record<TextFieldName, string> = {
  headline: 'Titular',
  description: 'Descripción',
  caption: 'Texto de publicación',
  hashtags: 'Hashtags',
  title: 'Título',
  score: 'Marcador',
  team_home: 'Equipo local',
  team_away: 'Equipo visitante',
  kickoff: 'Fecha y hora',
  standings: 'Clasificación',
  footer: 'Pie',
  demo_label: 'Etiqueta de demostración',
  match_status: 'Estado del partido',
  fixtures: 'Partidos',
  score_home: 'Goles local',
  score_away: 'Goles visitante',
  kickoff_time: 'Hora',
};

export const contentFlagLabel: Record<ContentFlag['code'], string> = {
  UNKNOWN_FACT_REFERENCE: 'Referencia a un dato desconocido',
  UNVERIFIED_NUMBER: 'Número o cantidad que no viene de un dato',
  NON_OFFICIAL_TEAM_NAME: 'Nombre de equipo no oficial',
  FORBIDDEN_CONTENT: 'Contenido no permitido',
  UNPLAYED_RESULT_CLAIM: 'Presenta como jugado un partido que aún no se ha jugado',
};

export const factKindLabel: Record<FactKind, string> = {
  match_teams: 'Equipos del partido',
  match_kickoff: 'Fecha del partido',
  match_status: 'Estado del partido',
  match_score: 'Marcador',
  standing_row: 'Fila de la clasificación',
  matchday_info: 'Jornada o fase',
  context_item: 'Dato de contexto',
  team_official_name: 'Nombre oficial del equipo',
};

/** BlockReason (R-026, R-206, R-271, R-272, R-078) in clear text. */
export const blockReasonLabel: Record<BlockReason, string> = {
  not_verified: 'Dato sin verificar: pendiente de verificación independiente.',
  manually_approved_not_publishable:
    'Aprobación manual no publicable con la política actual: solo se admite en competiciones configuradas sin fuente pública aceptada.',
  publication_permission_unconfirmed: 'Permiso de republicación no confirmado.',
};

export const blockingFactCopy = {
  noDisplay: 'Sin valor',
  reasonUnknown: 'No publicable.',
  status: 'Estado',
  reason: 'Motivo del bloqueo',
} as const;

export const qaCheckLabel: Record<QaCheck, string> = {
  data_match: 'Coincidencia con los datos',
  team_names: 'Nombres de equipos',
  text_fit: 'Ajuste del texto',
  style_consistency: 'Coherencia visual',
  dimensions: 'Dimensiones',
  capitalized_tokens: 'Palabras con mayúscula no reconocidas',
};

export const qaCopy = {
  pass: 'Correcto',
  fail: 'Falló',
  blocking: 'bloqueante',
  warning: 'advertencia',
  acknowledgedAt: 'Confirmada',
  acknowledge: (check: string): string => `Confirmar la advertencia: ${check}`,
  acknowledging: 'Confirmando…',
  mismatch: (expected: string, actual: string): string => `esperado «${expected}», obtenido «${actual}»`,
  overflowing: 'Textos que no caben',
  colors: 'Colores fuera de la paleta',
  fonts: 'Fuentes fuera del conjunto',
  templates: 'Versiones de plantilla',
  tokens: 'Palabras señaladas',
  tokensHint: 'Compruebe que no sean nombres de personas ni datos no verificados.',
  dimensions: (expectedWidth: number, expectedHeight: number, actualWidth: number, actualHeight: number): string =>
    `esperado ${expectedWidth} × ${expectedHeight} px, obtenido ${actualWidth} × ${actualHeight} px`,
  none: 'ninguno',
  blockingHint: 'Un fallo bloqueante solo se resuelve regenerando el elemento.',
} as const;

export const finalCopy = {
  pendingDetails: 'Ver elementos pendientes y motivos',
  approve: carouselCopy.finalAction,
  approving: 'Registrando la aprobación final…',
  approvedAt: 'Aprobación final registrada',
  valid: 'La aprobación final es válida. El carrusel se puede exportar.',
  invalid:
    'La aprobación final anterior ya no es válida porque el contenido cambió. Revise los elementos y vuelva a dar la aprobación final.',
  ready: 'Todas las diapositivas están aprobadas y ninguna está bloqueada.',
  notReady: 'La aprobación final no está disponible todavía:',
  notReadyUnknown: 'El carrusel todavía no está listo para la aprobación final. Actualice la vista.',
  exportNeedsApproval: 'La exportación necesita una aprobación final válida.',
  error: 'No se pudo dar la aprobación final',
  refusedItems: 'Elementos que impiden la aprobación final:',
  recorded: 'Aprobación final registrada.',
  unknownElement: 'Elemento desconocido',
} as const;

/** FinalApprovalRefusalReason (Problem.items of FINAL_APPROVAL_REFUSED; R-240). */
export const finalRefusalLabel: Record<FinalApprovalRefusalReason, string> = {
  not_approved: 'no aprobado',
  blocked: 'bloqueado por datos no publicables',
  flagged: 'con observaciones del contenido',
  qa_failed: 'con el control visual fallido',
  qa_ack_required: 'con advertencias del control visual sin confirmar',
};
