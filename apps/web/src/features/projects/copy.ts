/**
 * Spanish copy of the projects feature (PD-06) and the tables that turn the contract values of projects, runs and the
 * catalogue into operator-facing text. Shared values (data modes, availability, listing provenance, problems) use the
 * tables of `src/ui/copy.ts`. Stage, competition, season and source names are shown as the API gives them; no text
 * assumes a competition format (R-077). Nothing claims real-time data (U-24, R-313).
 */
import type {
  ApprovalState,
  FailureCode,
  Language,
  RunKind,
  RunStatus,
  StageRunStatus,
  StandingsExpectation,
  WorkflowStage,
} from '@edr/contracts';

export const listCopy = {
  title: 'Proyectos',
  intro: 'Proyectos de contenido e historial, del más reciente al más antiguo.',
  newProject: 'Nuevo proyecto',
  loading: 'Cargando proyectos…',
  empty: 'Todavía no hay proyectos.',
  createFirst: 'Crear el primer proyecto',
  loadError: 'No se pudo cargar la lista de proyectos',
  caption: 'Proyectos e historial',
  columns: {
    title: 'Título',
    competition: 'Competición y temporada',
    stage: 'Fase y jornada',
    source: 'Fuente de datos',
    demonstration: 'Demostración',
    language: 'Idioma',
    approval: 'Estado de aprobación',
    lastExport: 'Última exportación',
  },
  demonstration: 'Demostración',
  notDemonstration: 'No',
  neverExported: 'Sin exportaciones',
} as const;

export const createCopy = {
  title: 'Nuevo proyecto',
  intro:
    'Elija la competición, la fuente de datos, la temporada y la fase o jornada. Las opciones vienen de las fuentes configuradas; no se presupone ningún formato de competición.',
  backToList: 'Volver a la lista de proyectos',
  catalogueLoading: 'Cargando el catálogo de competiciones…',
  catalogueError: 'No se pudo cargar el catálogo de competiciones',
  catalogueSources: 'Fuentes de datos del catálogo',
  catalogueEmpty: 'Ninguna fuente configurada ofrece competiciones en este momento.',
  competitionLegend: 'Competición',
  reference: 'Referencia',
  sourcesOf: 'Fuentes',
  notSelectableSource: 'no elegible para proyectos',
  competitionUnavailable: 'No disponible',
  competitionNoSource: 'Ninguna fuente de esta competición se puede elegir para un proyecto.',
  sourceLegend: 'Fuente de datos',
  sourceHint: 'Se preselecciona la primera fuente disponible. La fuente elegida queda registrada en el proyecto.',
  sourceNone: 'Ninguna fuente de esta competición está disponible para crear un proyecto.',
  seasonLabel: 'Temporada',
  seasonPlaceholder: 'Elija una temporada',
  seasonCurrent: 'actual',
  seasonsLoading: 'Cargando temporadas…',
  seasonsError: 'No se pudieron cargar las temporadas',
  seasonsEmpty: 'La fuente no informa temporadas para esta competición.',
  seasonsUnavailable: 'Temporadas no disponibles en esta fuente',
  stageLegend: 'Fase',
  stagesLoading: 'Cargando fases…',
  stagesError: 'No se pudieron cargar las fases',
  stagesEmpty: 'La fuente no informa fases para esta temporada.',
  seasonUnavailable: 'Temporada no disponible en esta fuente',
  stageWhole: 'Se puede elegir completa',
  stageNotWhole: 'Solo por jornada',
  stageNoChoice: 'Esta fase no se puede elegir: no es seleccionable completa y la fuente no informa jornadas.',
  matchdays: (numbers: readonly number[]): string =>
    numbers.length === 0
      ? 'Sin jornadas numeradas'
      : numbers.length === 1
        ? `Jornada ${numbers[0]}`
        : `Jornadas ${numbers.join(', ')}`,
  matchdayLabel: 'Jornada o fase completa',
  matchdayOnlyLabel: 'Jornada',
  matchdayPlaceholder: 'Elija una jornada',
  wholeStage: 'Fase completa',
  matchday: (number: number): string => `Jornada ${number}`,
  languageLabel: 'Idioma del contenido',
  submit: 'Crear proyecto',
  submitting: 'Creando proyecto…',
  missing: (items: readonly string[]): string => `Para crear el proyecto falta elegir: ${items.join(', ')}.`,
  ready: 'La selección está completa.',
  missingItems: {
    competition: 'competición',
    source: 'fuente de datos',
    season: 'temporada',
    stage: 'fase',
    matchday: 'jornada',
  },
  createError: 'No se pudo crear el proyecto',
} as const;

/** StandingsExpectation of a stage (R-077, R-284): standings are never invented when not provided. */
export const standingsExpectationLabel: Record<StandingsExpectation, string> = {
  expected: 'Con clasificación',
  not_expected:
    'Sin clasificación: la fuente no ofrece clasificación para esta fase; el contenido no incluirá diapositivas de clasificación.',
  unknown: 'La fuente no indica si esta fase tiene clasificación.',
};

export const languageLabel: Record<Language, string> = {
  es: 'Español',
  en: 'Inglés',
};

export const approvalStateLabel: Record<ApprovalState, string> = {
  no_draft: 'Sin borrador',
  in_review: 'En revisión',
  final_approved: 'Con aprobación final',
  exported: 'Exportado',
};

export const detailCopy = {
  loading: 'Cargando el proyecto…',
  loadError: 'No se pudo cargar el proyecto',
  notFound: 'La dirección no corresponde a ningún proyecto.',
  backToList: 'Volver a la lista de proyectos',
  selectionTitle: 'Selección',
  competition: 'Competición',
  area: 'Zona',
  season: 'Temporada',
  stage: 'Fase',
  matchday: 'Jornada',
  wholeStage: 'Fase completa',
  source: 'Fuente de datos',
  dataMode: 'Modo de datos',
  createdAt: 'Creado',
  approval: 'Estado de aprobación',
  lastExport: 'Última exportación',
  neverExported: 'Sin exportaciones',
  manualNote:
    'Datos manuales importados por el operador: no cuentan como verificación independiente. Un dato aprobado manualmente se muestra como atestiguado por el operador, nunca como verificado.',
  languageTitle: 'Idioma del contenido',
  languageLabel: 'Idioma',
  languageSave: 'Cambiar idioma',
  languageSaving: 'Cambiando idioma…',
  languageUnchanged: 'Elija un idioma distinto del actual.',
  languageSaved: (language: string): string =>
    `Idioma cambiado a ${language}. Inicie una nueva redacción para generar el contenido en ese idioma.`,
  languageError: 'No se pudo cambiar el idioma',
  sectionsNav: 'Secciones del proyecto',
  facts: (runNumber: number): string => `Datos y verificación (ejecución ${runNumber})`,
  factsUnavailable: 'Datos y verificación: disponibles después de la primera ejecución.',
  review: 'Revisión y aprobación',
  exports: 'Exportaciones e historial',
  imports: 'Importaciones manuales',
} as const;

export const runCopy = {
  title: 'Ejecución',
  none: 'El proyecto todavía no tiene ejecuciones.',
  startFull: 'Iniciar ejecución completa',
  restartFull: 'Reiniciar ejecución completa',
  startRedraft: 'Volver a redactar',
  fullHint:
    'La ejecución completa obtiene los datos, los verifica, redacta, genera las imágenes y hace el control visual.',
  redraftHint:
    'Volver a redactar reutiliza los datos de la última verificación completada (por ejemplo, después de cambiar el idioma).',
  activeHint: 'Hay una ejecución en curso. Espere a que termine para iniciar otra.',
  starting: 'Iniciando la ejecución…',
  started: (runNumber: number): string => `Ejecución ${runNumber} iniciada.`,
  startError: 'No se pudo iniciar la ejecución',
  pollError: 'No se pudo actualizar el estado de la ejecución',
  pollRetry: 'Actualizar estado',
  heading: (runNumber: number, kind: RunKind): string => `Ejecución ${runNumber} (${runKindLabel[kind]})`,
  summary: (runNumber: number, status: RunStatus): string => `Ejecución ${runNumber}: ${runStatusLabel[status]}.`,
  stagesCaption: 'Estado de cada etapa',
  stageColumn: 'Etapa',
  statusColumn: 'Estado',
  timesColumn: 'Inicio y fin',
  reasonColumn: 'Motivo',
  notStarted: 'Sin iniciar',
  noReason: '—',
  failure: 'Motivo del fallo',
  failureSource: (sourceId: string): string => `Fuente: ${sourceId}`,
  failureHttpStatus: (status: number): string => `Código de respuesta: ${status}`,
  restartHint: 'La ejecución falló. Puede iniciar una nueva ejecución completa.',
} as const;

export const runKindLabel: Record<RunKind, string> = {
  full: 'completa',
  redraft: 'nueva redacción',
};

export const runStatusLabel: Record<RunStatus, string> = {
  pending: 'pendiente',
  running: 'en curso',
  completed: 'completada',
  failed: 'fallida',
};

export const workflowStageLabel: Record<WorkflowStage, string> = {
  research: 'Obtención de datos',
  verification: 'Verificación',
  content: 'Redacción del contenido',
  rendering: 'Generación de imágenes',
  visual_qa: 'Control visual',
};

/** Stage status with a symbol, so that the status is never conveyed by colour alone. */
export const stageRunStatusLabel: Record<StageRunStatus, { label: string; symbol: string }> = {
  pending: { label: 'Pendiente', symbol: '○' },
  running: { label: 'En curso', symbol: '…' },
  completed: { label: 'Completada', symbol: '✓' },
  failed: { label: 'Fallida', symbol: '✕' },
  skipped: { label: 'Omitida', symbol: '–' },
};

/** Failure.code of a stage or run (closed list, T10-F10): fixed text only, never a provider message. */
export const failureCodeLabel: Record<FailureCode, string> = {
  unavailable: 'La fuente de datos no está disponible.',
  rate_limited: 'Se alcanzó el límite de solicitudes de la fuente de datos.',
  timeout: 'La fuente de datos no respondió a tiempo.',
  no_data: 'La fuente de datos no devolvió datos para esta selección.',
  invalid: 'La fuente de datos devolvió datos no válidos.',
  access_refused: 'El proveedor rechazó el acceso.',
  not_available: 'La selección no está disponible en la fuente de datos.',
  bad_request: 'La fuente de datos rechazó la solicitud.',
  ai_response_invalid: 'La respuesta del servicio de redacción no es válida.',
  interrupted: 'La ejecución se interrumpió porque el servidor local se detuvo.',
  stage_not_available: 'Esta etapa todavía no está disponible.',
  run_superseded: 'La ejecución fue reemplazada por otra más reciente.',
  internal: 'Ocurrió un error interno en el servidor local.',
};
