/**
 * Spanish user-interface copy (PD-06: Spanish by default) and the copy tables that turn closed contract values into
 * operator-facing text. Every visible string of the shared UI comes from here; features add their own strings next
 * to their components and reuse these tables for contract values.
 *
 * Wording rules:
 * - MANUALLY_APPROVED is "aprobado manualmente" and "atestiguado por el operador"; it never uses the word
 *   "verificado" (BR-12, BR-17, OD-17);
 * - DEMO_DATA is always called a demonstration (OD-21, R-269);
 * - no text claims real-time data (U-24, R-313).
 */
import type {
  AvailabilityReason,
  DataMode,
  FactStatus,
  ImportErrorProblem,
  ProblemCode,
  RefusalReason,
  SegmentProvenance,
  StandingsAvailabilityReason,
  UnverifiedReason,
} from '../api/types';

export const appCopy = {
  name: 'El Deporte Rey GT',
  tagline: 'Contenido deportivo verificado para revisión manual',
  skipToContent: 'Saltar al contenido principal',
  mainNavigation: 'Navegación principal',
  loading: 'Cargando…',
  localNotice: 'Aplicación local de un solo operador. No hay publicación automática.',
} as const;

export const navCopy = {
  projects: 'Proyectos',
  imports: 'Importaciones manuales',
  brand: 'Mi marca',
  templates: 'Plantillas',
} as const;

export const featureCopy = {
  projects: 'Proyectos',
  facts: 'Datos y verificación',
  review: 'Revisión y aprobación',
  history: 'Exportaciones e historial',
  brand: 'Mi marca',
  templates: 'Plantillas',
  imports: 'Importaciones manuales',
  pending: 'Esta sección todavía no está disponible.',
} as const;

export const pageCopy = {
  notFoundTitle: 'Página no encontrada',
  notFoundBody: 'La dirección no corresponde a ninguna sección de la aplicación.',
  routeErrorTitle: 'No se pudo mostrar esta sección',
  routeErrorBody: 'Ocurrió un error inesperado al cargar la sección. Vuelva a intentarlo.',
  backToProjects: 'Volver a la lista de proyectos',
} as const;

/** DataMode (PD-13). */
export const dataModeLabel: Record<DataMode, string> = {
  LIVE_DATA: 'Datos en vivo',
  MANUAL_DATA: 'Datos manuales',
  DEMO_DATA: 'Datos de demostración',
};

export const dataModeDescription: Record<DataMode, string> = {
  LIVE_DATA: 'Datos obtenidos de un proveedor externo configurado.',
  MANUAL_DATA: 'Datos importados por el operador.',
  DEMO_DATA: 'Datos sintéticos de demostración; no son datos reales.',
};

/** FactStatus (OD-17, BR-12). */
export const factStatusLabel: Record<FactStatus, string> = {
  verified: 'Verificado',
  unverified: 'Sin verificar',
  manually_approved: 'Aprobado manualmente',
};

/** Qualifier always shown with MANUALLY_APPROVED (PD-17, R-320). */
export const operatorAttestedLabel = 'atestiguado por el operador';

/** UnverifiedReason (OD-17). */
export const unverifiedReasonLabel: Record<UnverifiedReason, string> = {
  awaiting_independent_verification: 'pendiente de verificación independiente',
  disputed: 'en disputa entre fuentes',
  no_accepted_source: 'sin fuente aceptada',
  team_identity_unmatched: 'identidad del equipo sin confirmar',
};

/** Provenance of a text segment (OD-01, R-208). A fact segment shows its fact's current status instead. */
export const provenanceLabel: Record<SegmentProvenance, string> = {
  fact: 'Dato',
  commentary: 'Comentario',
  template_text: 'Texto de plantilla',
};

/** Availability.reason (R-075, R-286). */
export const availabilityReasonLabel: Record<AvailabilityReason, string> = {
  subscription_restricted: 'No disponible con la suscripción actual de la fuente.',
  not_found: 'La fuente no lo encuentra.',
  access_refused: 'La fuente rechazó el acceso.',
  not_provided: 'La fuente no ofrece este dato.',
  source_unavailable: 'La fuente no está disponible en este momento.',
  rate_limited: 'Se alcanzó el límite de solicitudes de la fuente.',
};

export const availabilityCopy = {
  unavailable: 'No disponible',
  unknownReason: 'No disponible por un motivo no indicado.',
  standingsUnavailable: 'Clasificación no disponible',
} as const;

/** StandingsAvailability.reason (R-077, R-254, R-284). */
export const standingsReasonLabel: Record<StandingsAvailabilityReason, string> = {
  not_provided_for_stage: 'Esta fase no tiene clasificación.',
  not_provided_by_source: 'La fuente no proporciona la clasificación.',
  not_available_with_subscription: 'La clasificación no está disponible con la suscripción actual de la fuente.',
};

/** ListingMeta (R-141, R-291). */
export const listingCopy = {
  retrievedAt: 'Obtenido',
  neverRetrieved: 'Sin fecha de obtención',
  fromCache: 'desde la caché',
  fresh: 'consulta directa a la fuente',
  stale: 'Datos en caché posiblemente desactualizados: se alcanzó el límite de solicitudes de la fuente.',
  retryAfter: (seconds: number): string =>
    seconds === 1 ? 'Nueva consulta posible en 1 segundo.' : `Nueva consulta posible en ${seconds} segundos.`,
} as const;

export const demoBannerCopy = {
  title: 'Contenido de demostración',
  body: 'Este contenido usa datos sintéticos de demostración. No son datos reales y no deben publicarse.',
} as const;

export const referenceCopy = {
  label: 'Referencia',
  empty: 'Sin referencia',
} as const;

/** Problem.code (contract `Problem`). */
export const problemCodeMessage: Record<ProblemCode, string> = {
  VALIDATION_FAILED: 'Los datos enviados no son válidos.',
  NOT_FOUND: 'El elemento solicitado no existe.',
  FORBIDDEN_ORIGIN:
    'La protección de acceso local rechazó la solicitud. Abra la aplicación desde su dirección local (127.0.0.1).',
  MISDIRECTED_HOST:
    'La solicitud llegó con una dirección no permitida. Abra la aplicación desde su dirección local (127.0.0.1).',
  UNSUPPORTED_MEDIA_TYPE: 'El tipo de contenido enviado no es compatible.',
  PAYLOAD_TOO_LARGE: 'El contenido enviado es demasiado grande.',
  RUN_IN_PROGRESS: 'Ya hay una ejecución en curso para este proyecto. Espere a que termine.',
  NO_VERIFIED_RUN: 'El proyecto todavía no tiene una ejecución con datos verificados.',
  VERSION_CONFLICT: 'El contenido cambió mientras tanto. Actualice la vista y vuelva a intentarlo.',
  APPROVAL_BLOCKED: 'No se puede aprobar: hay datos que bloquean la aprobación.',
  CONTENT_FLAGGED: 'No se puede aprobar: el contenido tiene observaciones pendientes.',
  QA_FAILED: 'No se puede aprobar: el control visual falló.',
  QA_ACK_REQUIRED: 'Antes de aprobar, confirme las advertencias del control visual.',
  FINAL_APPROVAL_REFUSED: 'No se puede dar la aprobación final: hay elementos pendientes.',
  FINAL_APPROVAL_REQUIRED: 'Se necesita la aprobación final antes de exportar.',
  EXPORT_FILES_MISSING: 'Los archivos de esta exportación ya no están disponibles.',
  EXPORT_FILES_CORRUPT: 'No se pudo verificar los archivos de esta exportación.',
  DUPLICATE_ASSET: 'Este archivo ya está registrado.',
  DUPLICATE_SEASON: 'Ya existe una temporada con ese nombre en esta competición.',
  DUPLICATE_TEAM: 'Ya existe un equipo con el mismo nombre y zona. Selecciónalo del catálogo local.',
  DUPLICATE_PARTICIPANT: 'Este equipo ya participa en la temporada.',
  DUPLICATE_COMPETITION_TEAM: 'Este equipo ya está asociado a la competición.',
  COMPETITION_TEAM_IN_USE: 'No puedes quitar este equipo porque participa en una o más temporadas de la competición.',
  TEAM_NOT_IN_COMPETITION: 'Asocia primero este equipo a la competición.',
  DUPLICATE_STAGE: 'Ya existe una fase con ese nombre en esta temporada.',
  DUPLICATE_ROUND: 'Ya existe una jornada o ronda con ese nombre en este contexto.',
  DUPLICATE_MATCH: 'Ya existe ese encuentro en el mismo contexto y horario.',
  ROUND_HAS_MATCHES: 'No se puede eliminar una jornada que tiene partidos o historial asociado.',
  TEAM_IN_USE: 'No puedes desvincular este equipo mientras tenga partidos en el calendario de la temporada.',
  PROVIDER_FAILED: 'La fuente de datos no respondió correctamente.',
  PROVIDER_BINDING_EXISTS: 'Esta competición ya tiene un proveedor vinculado. Confirma el reemplazo para continuar.',
  PROVIDER_AMBIGUOUS: 'El proveedor tiene más de una configuración activa. Contacta al administrador.',
  PROVIDER_UNAVAILABLE: 'El proveedor no está configurado en el servidor. Solicita su configuración al administrador.',
  IMPORT_PREVIEW_EXPIRED: 'La vista previa expiró. Consulta nuevamente los datos del proveedor.',
  CONTENT_BATCH_NOT_GENERATABLE:
    'Ninguna pieza de la selección se puede generar con los datos locales. Revisa los partidos y los tipos elegidos.',
  REQUEST_KEY_REUSED: 'Esta confirmación ya se usó para otra selección. Revisa la propuesta y confirma de nuevo.',
  ASSET_IN_USE:
    'El recurso aparece en diapositivas ya generadas o en plantillas visuales, así que no se puede eliminar. Puedes desactivarlo para que no se use en contenido nuevo.',
  IMAGE_PROVIDER_UNAVAILABLE: 'La generación de imágenes no está disponible en el servidor.',
  DESIGN_REFERENCE_REFUSED: 'Un recurso de marca seleccionado no se puede usar de esa forma.',
  GENERATION_LIMIT_REACHED: 'Se alcanzó un límite de generación de imágenes.',
  TEMPLATE_SOURCE_REFUSED:
    'No se puede usar ese origen para la plantilla: la propuesta debe estar aprobada y el fondo debe ser válido.',
  TEMPLATE_VERSION_PUBLISHED: 'Esta versión ya está publicada y no se puede modificar. Crea una nueva versión.',
  TEMPLATE_NOT_PUBLISHABLE: 'La versión tiene errores de validación. Corrígelos antes de publicar.',
  TEMPLATE_IN_USE: 'La plantilla tiene versiones publicadas, así que no se puede eliminar. Puedes archivarla.',
  PROPOSAL_IN_USE: 'Una plantilla visual usa esta propuesta, así que no se puede eliminar.',
  PROVIDER_RATE_LIMITED: 'Se alcanzó el límite de solicitudes de la fuente de datos.',
  SELECTION_UNAVAILABLE: 'La selección no está disponible en la fuente elegida.',
  IMPORT_REJECTED: 'La importación fue rechazada. No se guardó ningún dato.',
  MANUAL_APPROVAL_REFUSED: 'No se puede aprobar manualmente este dato.',
  INTERNAL: 'Ocurrió un error interno en el servidor local.',
};

/** Problem.refusalReason (MANUAL_APPROVAL_REFUSED, SELECTION_UNAVAILABLE). */
export const refusalReasonLabel: Record<RefusalReason, string> = {
  not_manual_data: 'Solo los datos manuales pueden aprobarse manualmente.',
  verified: 'El dato ya está verificado.',
  disputed: 'El dato está en disputa entre fuentes.',
  team_identity_unmatched: 'La identidad del equipo no está confirmada.',
  accepted_source_disagrees: 'Una fuente aceptada no coincide con el dato.',
  not_latest_run: 'El dato no pertenece a la ejecución más reciente.',
  already_approved: 'El dato ya fue aprobado manualmente.',
  not_approved: 'El dato no tiene aprobación manual.',
  competition_unavailable: 'La competición no está disponible.',
  season_unavailable: 'La temporada no está disponible.',
  stage_unavailable: 'La fase no está disponible.',
  source_not_selectable: 'La fuente no se puede elegir para esta competición.',
};

/** ImportError.problem (R-061, R-274). */
export const importProblemLabel: Record<ImportErrorProblem, string> = {
  parse_error: 'Formato no válido',
  encoding_invalid: 'Codificación no válida (se requiere UTF-8)',
  too_large: 'Archivo demasiado grande',
  too_many_rows: 'Demasiadas filas',
  header_invalid: 'Encabezado no válido',
  column_unknown: 'Columna desconocida',
  person_field: 'Campo con datos de personas (no permitido)',
  required_missing: 'Falta un valor obligatorio',
  type_invalid: 'Tipo de valor no válido',
  value_out_of_range: 'Valor fuera de rango',
  value_inconsistent: 'Valor incoherente',
  duplicate_match: 'Partido duplicado',
  unknown_team: 'Equipo desconocido',
  metadata_missing: 'Faltan metadatos',
  metadata_conflict: 'Metadatos en conflicto',
  finished_without_score: 'Partido finalizado sin marcador',
  score_not_allowed: 'Marcador no permitido para este estado',
};

export const errorCopy = {
  title: 'Error',
  network:
    'No se pudo conectar con el servidor local. Compruebe que la aplicación esté en ejecución y vuelva a intentarlo.',
  invalidResponse: 'El servidor local devolvió una respuesta inesperada.',
  aborted: 'La solicitud se canceló.',
  http: (status: number | null): string =>
    status === null ? 'La solicitud falló.' : `La solicitud falló (código ${status}).`,
  accessRefused: 'Abra la aplicación desde su dirección local (127.0.0.1). La aplicación no usa inicio de sesión.',
  retry: 'Reintentar',
  retryAfter: (seconds: number): string =>
    seconds === 1 ? 'Puede reintentar en 1 segundo.' : `Puede reintentar en ${seconds} segundos.`,
  validationTitle: 'Campos con errores',
  importErrorsTitle: (count: number): string =>
    count === 1 ? '1 error en la importación' : `${count} errores en la importación`,
  importErrorRecord: 'Registro',
  importErrorField: 'Campo',
  importErrorProblem: 'Problema',
  importErrorMessage: 'Detalle',
  importErrorLocation: { file: 'Archivo', form: 'Formulario' } as Record<'file' | 'form', string>,
} as const;
