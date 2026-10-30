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
  Language,
  LeftOutMatch,
  MatchStatus,
  QaCheck,
  SlideType,
  TextFieldName,
} from '@edr/contracts';

export const reviewCopy = {
  title: 'Revisión del contenido',
  eyebrow: 'REVISA Y APRUEBA',
  intro: 'Revisa las diapositivas, confirma el texto y aprueba el carrusel para preparar la descarga.',
  progressLabel: 'Progreso del carrusel seleccionado',
  carouselPosition: (sequence: number, total: number): string => `Carrusel ${sequence} de ${total}`,
  slideProgress: (approved: number, total: number): string => `${approved} de ${total} diapositivas aprobadas`,
  captionApproved: 'Copy aprobado',
  captionPending: 'Copy pendiente de aprobación',
  carouselPicker: 'Elegir carrusel para revisar',
  draftDetails: 'Datos y trazabilidad del borrador',
  loading: 'Cargando el borrador…',
  loadError: 'No se pudo cargar el borrador',
  notFound: 'La dirección no corresponde a ningún proyecto.',
  noDraft: 'Este proyecto todavía no tiene un borrador activo. Inicie una ejecución desde la página del proyecto.',
  backToProject: 'Volver al proyecto',
  backToList: 'Volver a la lista de proyectos',
  refreshing: 'Actualizando la vista…',
  refresh: 'Actualizar la vista',
  refreshError: 'No se pudo actualizar la vista',
  summaryTitle: 'Borrador',
  dataMode: 'Modo de datos',
  language: 'Idioma del contenido',
  createdAt: 'Creado',
  carousels: 'Carruseles',
  carouselCount: (count: number): string => (count === 1 ? '1 carrusel' : `${count} carruseles`),
  noCarousels: 'El borrador no tiene carruseles.',
  attestedNote:
    'Este borrador usa datos aprobados manualmente (atestiguados por el operador). No son datos verificados.',
  noStandings:
    'Este borrador no incluye diapositivas de clasificación porque la selección no tiene clasificación. La clasificación no se calcula a partir de los resultados.',
  provenanceIntro:
    'Cada fragmento de texto indica su procedencia: dato (con el estado actual del dato), comentario o texto de plantilla.',
} as const;

export const languageLabel: Record<Language, string> = {
  es: 'Español',
  en: 'Inglés',
};

export const leftOutCopy = {
  title: 'Partidos que no están en el borrador',
  none: 'Todos los partidos de la selección están en el borrador.',
  caption: 'Partidos fuera del borrador',
  match: 'Partido',
  status: 'Estado del partido',
  reason: 'Motivo',
  unknownStatus: 'Estado no informado',
} as const;

export const matchStatusLabel: Record<MatchStatus, string> = {
  scheduled: 'Programado',
  in_play: 'En juego',
  finished: 'Finalizado',
  postponed: 'Aplazado',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
  abandoned: 'Abandonado',
  awarded: 'Resultado administrativo',
};

export const leftOutReasonLabel: Record<LeftOutMatch['reason'], string> = {
  not_finished: 'El partido no ha finalizado.',
  not_verified: 'Los datos del partido no tienen un valor utilizable.',
  excluded_by_operator: 'Excluido por el operador.',
};

export const exclusionsCopy = {
  title: 'Exclusión de partidos',
  open: 'Editar partidos excluidos',
  close: 'Cerrar la edición de exclusiones',
  intro:
    'Marque los partidos que no deben aparecer en el contenido. Al guardar se crea un borrador nuevo: las aprobaciones actuales no se conservan.',
  loading: 'Cargando los partidos…',
  loadError: 'No se pudieron cargar los partidos',
  legend: 'Partidos de la selección',
  exclude: (label: string): string => `Excluir ${label}`,
  empty: 'No hay partidos que se puedan excluir.',
  tooMany: (max: number): string => `Se pueden excluir como máximo ${max} partidos.`,
  unchanged: 'No hay cambios que guardar.',
  submit: 'Guardar exclusiones y crear un borrador nuevo',
  submitting: 'Guardando exclusiones…',
  submitError: 'No se pudieron guardar las exclusiones',
  started: (runNumber: number): string =>
    `Se inició un borrador nuevo (ejecución ${runNumber}). Cuando termine, actualice esta vista para revisarlo.`,
  followRun: 'Ver el progreso en la página del proyecto',
  count: (count: number): string =>
    count === 0 ? 'Ningún partido excluido.' : count === 1 ? '1 partido excluido.' : `${count} partidos excluidos.`,
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
  captionEyebrow: 'TEXTO DE PUBLICACIÓN',
} as const;

export const slideTypeLabel: Record<SlideType, string> = {
  cover: 'Portada',
  match_result: 'Resultado',
  standings: 'Clasificación',
  closing: 'Cierre',
};

export const elementCopy = {
  slide: (position: number, type: SlideType | null): string =>
    type === null ? `Diapositiva ${position}` : `Diapositiva ${position}: ${slideTypeLabel[type]}`,
  caption: 'Texto de publicación y hashtags',
  slideEyebrow: 'DIAPOSITIVA DEL CARRUSEL',
  captionEyebrow: 'COPY PARA PUBLICACIÓN',
  captionReadable: 'Texto de publicación y hashtags',
  technicalDetails: 'Detalles y verificaciones',
  approveSlide: 'Aprobar diapositiva',
  approveAndNext: 'Aprobar y siguiente',
  approveCaption: 'Aprobar copy',
  approvedStatus: 'Aprobada',
  needsAttention: 'Requiere atención antes de aprobar',
  noIssues: 'Sin problemas detectados',
  warningSummary: (count: number): string =>
    count === 1 ? 'Hay una advertencia del control visual.' : `Hay ${count} advertencias del control visual.`,
  regenerateLabel: (kind: 'slide' | 'caption'): string =>
    kind === 'slide' ? 'Regenerar diapositiva' : 'Regenerar copy',
  version: (number: number): string => `Versión ${number}`,
  createdAt: 'creada',
  imageAlt: (name: string, version: number): string => `Imagen de ${name}, versión ${version}`,
  noImage: 'Imagen todavía no disponible.',
  dimensions: (width: number, height: number): string => `${width} × ${height} px`,
  textTitle: 'Texto',
  noText: 'Sin texto.',
  blocked: 'Bloqueada',
  blockedTitle: 'Datos que bloquean la aprobación',
  blockedIntro: 'No se puede aprobar mientras estos datos no sean publicables:',
  flagsTitle: 'Observaciones del contenido',
  flagField: 'Campo',
  flagExcerpt: 'Fragmento',
  qaTitle: 'Control visual',
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
  regenerateHint:
    'Regenerar crea una versión nueva solo de este elemento; los demás conservan su versión y aprobación.',
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
};

export const contentFlagLabel: Record<ContentFlag['code'], string> = {
  UNKNOWN_FACT_REFERENCE: 'Referencia a un dato desconocido',
  UNVERIFIED_NUMBER: 'Número o cantidad que no viene de un dato',
  NON_OFFICIAL_TEAM_NAME: 'Nombre de equipo no oficial',
  FORBIDDEN_CONTENT: 'Contenido no permitido',
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
  title: 'Aprobación final',
  slideProgress: (approved: number, total: number): string => `${approved} de ${total} diapositivas aprobadas`,
  captionApproved: 'Copy aprobado',
  captionPending: 'Copy pendiente de aprobación',
  pendingDetails: 'Ver elementos pendientes y motivos',
  approve: 'Dar la aprobación final',
  approving: 'Registrando la aprobación final…',
  approvedAt: 'Aprobación final registrada',
  valid: 'La aprobación final es válida. El carrusel se puede exportar.',
  goToExports: 'Ir a exportaciones',
  invalid:
    'La aprobación final anterior ya no es válida porque el contenido cambió. Revise los elementos y vuelva a dar la aprobación final.',
  ready: 'Todos los elementos están aprobados y ninguno está bloqueado.',
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
