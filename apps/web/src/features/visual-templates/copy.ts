/** Spanish copy of the structured visual templates (PD-ARCH-01G-C). */
import type {
  VisualTemplateBadgeBinding,
  VisualTemplateBinding,
  VisualTemplateContentType,
  VisualTemplateFixtureRowPart,
  VisualTemplateImageFit,
  VisualTemplateIssueCode,
  VisualTemplateLayerType,
  VisualTemplateStatus,
  VisualTemplateTextEffect,
  VisualTemplateTextStyle,
  VisualTemplateVersionStatus,
} from '@edr/contracts';

import type { BadgeVariant } from '../../ui';

/**
 * What a template draws: the names of the engine templates of the same slide type (decision 01G-D-3), in the order
 * of a carousel. A design proposal keeps its own labels (`features/design/copy.ts`).
 */
export const templateContentTypeLabel: Record<VisualTemplateContentType, string> = {
  cover: 'Portada',
  match_result: 'Resultado de partido',
  round_overview: 'Calendario de jornada',
  fixture: 'Partido programado',
  match_preview: 'Previa de partido',
  closing: 'Cierre',
};

export const templateStatusLabel: Record<VisualTemplateStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  archived: 'Archivada',
};

export const templateStatusTone: Record<VisualTemplateStatus, BadgeVariant> = {
  draft: 'info',
  published: 'success',
  archived: 'neutral',
};

export const versionStatusLabel: Record<VisualTemplateVersionStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
};

/** Labels of the closed binding catalogue (contract `VisualTemplateBinding`). */
export const bindingLabel: Record<VisualTemplateBinding, string> = {
  'competition.name': 'Competición',
  'season.label': 'Temporada',
  'stage.name': 'Fase',
  'round.name': 'Jornada',
  'match.homeTeam.name': 'Equipo local',
  'match.awayTeam.name': 'Equipo visitante',
  'match.kickoffDate': 'Fecha del partido',
  'match.kickoffTime': 'Hora del partido',
  'match.status': 'Estado del partido',
  'match.score': 'Marcador',
  'match.homeScore': 'Goles del local',
  'match.awayScore': 'Goles del visitante',
  'round.fixtures': 'Partidos de la jornada',
};

/** The badge bindings of the team badge layers (PD-ARCH-01G-D). */
export const badgeBindingLabel: Record<VisualTemplateBadgeBinding, string> = {
  'match.homeTeam.badge': 'local',
  'match.awayTeam.badge': 'visitante',
};

export const layerTypeLabel: Record<VisualTemplateLayerType, string> = {
  text: 'Texto',
  sports_data: 'Dato deportivo',
  image: 'Imagen de Mi marca',
  brand_asset: 'Recurso oficial',
  team_badge: 'Escudo de equipo',
  fixture_list: 'Lista de partidos',
};

/** The parts of a match-list row (contract `VISUAL_TEMPLATE_FIXTURE_ROW_PARTS`, PD-ARCH-01G-E.2). */
export const fixtureRowPartLabel: Record<VisualTemplateFixtureRowPart, string> = {
  homeBadge: 'Escudo local',
  homeName: 'Nombre local',
  kickoffDate: 'Fecha',
  kickoffTime: 'Hora',
  status: 'Estado',
  awayName: 'Nombre visitante',
  awayBadge: 'Escudo visitante',
};

export const fitLabel: Record<VisualTemplateImageFit, string> = {
  contain: 'Contener (sin recortar)',
  cover: 'Cubrir (recorta, sin deformar)',
  fill: 'Rellenar (deforma)',
};

export const alignLabel: Record<VisualTemplateTextStyle['align'], string> = {
  left: 'Izquierda',
  center: 'Centro',
  right: 'Derecha',
};

export const verticalAlignLabel: Record<VisualTemplateTextStyle['verticalAlign'], string> = {
  top: 'Arriba',
  middle: 'Centro',
  bottom: 'Abajo',
};

export const overflowLabel: Record<VisualTemplateTextStyle['overflow'], string> = {
  shrink: 'Reducir hasta el tamaño mínimo',
  fixed: 'Tamaño fijo',
};

/** The text effects of the closed palette (decision 01G-C-2). */
export const effectLabel: Record<VisualTemplateTextEffect, string> = {
  none: 'Ninguno',
  soft_shadow: 'Sombra suave',
  strong_shadow: 'Sombra intensa',
  glow_gold: 'Brillo dorado',
  glow_purple: 'Brillo morado',
  outline_dark: 'Contorno oscuro',
  scoreboard_gold: 'Marcador dorado',
};

export const sectionCopy = {
  heading: 'Plantillas visuales',
  intro:
    'Plantillas reutilizables hechas a partir de una propuesta visual aprobada: un fondo, recursos oficiales y textos con datos deportivos. Reutilizarlas no llama a OpenAI.',
  create: 'Crear plantilla',
  loading: 'Cargando las plantillas visuales…',
  loadFailedTitle: 'No se pudieron cargar las plantillas visuales',
  empty: 'Todavía no hay plantillas visuales.',
  emptyDescription: 'Crea una a partir de una propuesta visual aprobada.',
  noResults: 'Ninguna plantilla coincide con la búsqueda o los filtros.',
  search: 'Buscar por nombre o categoría',
  filterStatus: 'Estado',
  filterType: 'Tipo de contenido',
  filterFormat: 'Formato',
  all: 'Todos',
  count: (shown: number, total: number): string =>
    shown === total ? `${total} ${total === 1 ? 'plantilla' : 'plantillas'}` : `${shown} de ${total} plantillas`,
  tableCaption: 'Plantillas visuales',
  listLabel: 'Plantillas visuales',
  columns: {
    preview: 'Vista previa',
    name: 'Nombre',
    type: 'Tipo',
    format: 'Formato',
    status: 'Estado',
    published: 'Versión publicada',
    draft: 'Borrador',
    updated: 'Actualizada',
    actions: 'Acciones',
  },
  publishedVersion: (version: number): string => `Versión ${version}`,
  none: 'Ninguna',
  hasDraft: 'En edición',
  noDraft: '—',
  thumbnailAlt: (name: string): string => `Fondo de la plantilla «${name}»`,
  thumbnailFailed: 'Sin vista previa',
  viewTemplate: (name: string): string => `Ver «${name}»`,
  editTemplate: (name: string): string => `Editar «${name}»`,
  moreActions: (name: string): string => `Más acciones de «${name}»`,
  deleteAction: 'Eliminar',
  preview: 'Previsualizar',
  publish: 'Publicar',
  newVersion: 'Crear nueva versión',
  archive: 'Archivar',
  restore: 'Restaurar',
  actionFailedTitle: 'No se pudo completar la acción',
  deleteTitle: 'Eliminar plantilla',
  deleteQuestion: (name: string): string => `¿Eliminar la plantilla «${name}»?`,
  deleteNote:
    'Se pueden eliminar las plantillas archivadas y las que nunca se publicaron; una plantilla publicada se archiva antes. La plantilla deja de aparecer; los proyectos que ya la usaron conservan su versión, y los recursos de marca y la propuesta de origen no cambian.',
  deleteConfirm: 'Eliminar',
  deleting: 'Eliminando…',
  deleted: (name: string): string => `Plantilla «${name}» eliminada.`,
  archived: (name: string): string => `Plantilla «${name}» archivada.`,
  restored: (name: string): string => `Plantilla «${name}» restaurada.`,
} as const;

export const createCopy = {
  title: 'Crear plantilla desde una propuesta aprobada',
  intro:
    'La plantilla usa el fondo de la propuesta y empieza como borrador. Es una operación local: no se llama a OpenAI ni se cobra nada.',
  proposals: 'Propuesta aprobada',
  loading: 'Cargando las propuestas aprobadas…',
  loadFailedTitle: 'No se pudieron cargar las propuestas',
  empty: 'No hay propuestas aprobadas.',
  emptyDescription: 'Aprueba una propuesta en «Propuestas visuales con IA» para usarla como base de una plantilla.',
  backToProposals:
    'Si ninguna propuesta sirve como fondo, cierra este diálogo y crea una nueva o solicita una variante en la pestaña «Propuestas visuales con IA» de esta página.',
  proposalAlt: (name: string): string => `Propuesta «${name}»`,
  proposalFailed: 'No se pudo cargar la imagen.',
  name: 'Nombre de la plantilla',
  nameRequired: 'Escribe un nombre de hasta 80 caracteres.',
  description: 'Descripción (opcional)',
  contentType: 'Tipo de contenido de la plantilla',
  contentTypeHint:
    'Es la diapositiva que dibuja, con los mismos tipos que las plantillas del motor. Define qué datos deportivos puede mostrar (por ejemplo, el marcador solo en «Resultado de partido»; la portada y el cierre, los datos de la competición). No se puede cambiar después.',
  contentTypeChanged: (original: string): string =>
    `La propuesta se diseñó como «${original}»: revisa que el fondo tenga espacio para los datos de este tipo. No se puede cambiar después.`,
  category: 'Categoría (opcional)',
  categoryHint: 'Por ejemplo «Previas» o «Resultados»; sirve para buscar y agrupar.',
  guidedWarning:
    'El fondo viene de una propuesta guiada. El modelo pudo no dejar vacías todas las zonas de datos: revisa que no haya textos, logos o personas generados antes de publicar.',
  ownPromptWarning:
    'Esta propuesta se hizo con un prompt propio. Su imagen puede contener textos, personas, logos o una Ketsi generados por la IA, que se repetirían en cada pieza. Ketsi y el logotipo de la plantilla deben ser los archivos oficiales.',
  acknowledge: 'Entiendo que el fondo puede contener elementos generados y lo revisaré antes de publicar.',
  acknowledgeRequired: 'Confirma que revisarás el fondo para continuar.',
  selectRequired: 'Elige una propuesta aprobada.',
  submit: 'Crear borrador',
  submitting: 'Creando…',
  failedTitle: 'No se pudo crear la plantilla',
} as const;

export const editorCopy = {
  back: 'Volver a Plantillas',
  loading: 'Cargando la plantilla…',
  loadFailedTitle: 'No se pudo cargar la plantilla',
  versionHeading: (version: number, status: string): string => `Versión ${version} · ${status}`,
  versionSelect: 'Versión',
  readOnlyPublished:
    'Esta versión está publicada y no se puede modificar. Para cambiarla, crea una nueva versión: la publicada no se altera.',
  readOnlyArchived:
    'La plantilla está archivada: no se puede editar. Restáurala desde la lista para volver a editarla.',
  newVersion: 'Crear nueva versión',
  creatingVersion: 'Creando…',
  discardDraft: 'Descartar borrador',
  discardQuestion: '¿Descartar este borrador? La versión publicada no cambia.',
  editMetadata: 'Editar el nombre y los datos de la plantilla',
  metadataTitle: 'Datos de la plantilla',
  metadataSave: 'Guardar datos',
  save: 'Guardar borrador',
  saving: 'Guardando…',
  saved: 'Borrador guardado.',
  saveFailedTitle: 'No se pudo guardar el borrador',
  conflict:
    'La plantilla cambió en otra pestaña o ventana. Recarga para ver la versión guardada; tus cambios sin guardar se perderán.',
  reload: 'Recargar',
  unsaved: 'Cambios sin guardar',
  savedAt: (date: string): string => `Guardado · ${date}`,
  readOnlyShort: 'Solo lectura',
  versionSelectDirty: 'Guarda los cambios para abrir otra versión.',
  moreActions: 'Más acciones de la plantilla',
  modes: 'Modo del editor',
  designMode: 'Diseño',
  previewMode: 'Vista previa',
  publish: 'Publicar plantilla',
  publishing: 'Publicando…',
  publishTitle: 'Publicar plantilla',
  publishQuestion: (version: number): string =>
    `¿Publicar la versión ${version}? Quedará inmutable: los cambios posteriores se harán en una nueva versión.`,
  publishBlockedErrors: 'No se puede publicar: corrige los errores de validación.',
  publishBlockedDirty: 'Guarda los cambios antes de publicar.',
  published: (version: number): string => `Versión ${version} publicada.`,
  publishFailedTitle: 'No se pudo publicar',
  actionFailedTitle: 'No se pudo completar la acción',
  canvas: 'Lienzo de la plantilla',
  canvasHint:
    'Arrastra una capa para moverla o usa las flechas del teclado (Mayús para pasos grandes). El lienzo es una guía de posición; la vista previa del servidor es la referencia final.',
  canvasHintShort:
    'Arrastra para mover · flechas para ajustar (Mayús: pasos grandes) · la vista previa es la referencia final',
  workspace: 'Área de trabajo',
  zoomToolbar: 'Zoom y guías del lienzo',
  zoomOut: 'Alejar',
  zoomIn: 'Acercar',
  zoomLevel: 'Zoom',
  zoomFit: 'Ajustar',
  zoomActual: '100 %',
  guides: 'Guías',
  pixels: (width: number, height: number): string => `${width} × ${height} px`,
  layersAndResources: 'Capas y recursos',
  resources: 'Recursos',
  collapseLeft: 'Ocultar capas y recursos',
  expandLeft: 'Mostrar capas y recursos',
  collapseRight: 'Ocultar propiedades',
  expandRight: 'Mostrar propiedades',
  backgroundAlt: 'Fondo de la plantilla',
  backgroundFailed: 'No se pudo cargar el fondo.',
  layers: 'Capas',
  layersHint: 'La primera capa de la lista queda delante de las demás; el fondo queda siempre detrás.',
  noLayers: 'La plantilla no tiene capas. Agrega textos, datos deportivos o recursos de marca.',
  addLayer: 'Agregar capa',
  addText: 'Texto',
  addSportsData: 'Dato deportivo',
  addImage: 'Imagen de Mi marca',
  addLogo: 'Logotipo oficial',
  addMascot: 'Ketsi',
  addHomeBadge: 'Escudo local',
  addAwayBadge: 'Escudo visitante',
  addFixtureList: 'Lista de partidos',
  badgeBinding: 'Escudo',
  teamBadgeNote:
    'Se dibuja el escudo del equipo, proporcional, desde su archivo original. Si el equipo no tiene escudo, la capa queda vacía y se avisa.',
  badgePlaceholder: (label: string): string => `Escudo ${label}`,
  noImageAsset: 'No hay elementos gráficos activos en Mi marca.',
  noLogo: 'No hay un logotipo activo en Mi marca.',
  noMascot: 'No hay una mascota activa en Mi marca.',
  moveUp: 'Traer adelante',
  moveDown: 'Enviar atrás',
  removeLayer: 'Eliminar capa',
  layerActions: (name: string): string => `Más acciones de la capa «${name}»`,
  hide: (name: string): string => `Ocultar «${name}»`,
  show: (name: string): string => `Mostrar «${name}»`,
  lock: (name: string): string => `Bloquear «${name}»`,
  unlock: (name: string): string => `Desbloquear «${name}»`,
  lockHint: 'Bloquear: evita moverla o editarla por error. Solo dura esta sesión; no se guarda en la plantilla.',
  unlockShort: 'Desbloquear',
  lockedNote: 'Capa bloqueada en esta sesión: desbloquéala para moverla o editarla. El bloqueo no se guarda.',
  hidden: 'Oculta',
  locked: 'Bloqueada',
  boundTo: (field: string): string => `Dato: ${field}`,
  selectLayer: (name: string): string => `Capa «${name}»`,
  properties: 'Propiedades',
  noSelection: 'Selecciona una capa en el lienzo o en la lista para editar sus propiedades.',
  layerName: 'Nombre de la capa',
  position: 'Posición y tamaño',
  content: 'Contenido',
  typography: 'Tipografía',
  behaviour: 'Comportamiento',
  resource: 'Recurso',
  fitSection: 'Ajuste y proporción',
  badgeSection: 'Escudo',
  boxPixels: (width: number, height: number): string => `Caja de ${width} × ${height} px en el lienzo.`,
  fixedTag: 'Texto fijo',
  boundTag: 'Dato vinculado',
  bindingField: 'Campo',
  bindingValue: 'Valor',
  bindingState: 'Estado',
  bindingStateNone: 'Sin campo: elige el dato',
  bindingStateNoPreview: 'Sin vista previa todavía',
  bindingStateChanged: 'Cambió tras la última vista previa',
  bindingStateMissing: 'Sin dato en la selección',
  bindingStateResolved: 'Resuelto con datos locales',
  bindingNote:
    'El valor es el de la última vista previa con datos de Competiciones (con sus correcciones manuales). Previsualizar no cambia ningún dato deportivo.',
  badgeStateFound: 'En la última vista previa, el equipo tiene escudo.',
  badgeStateMissing: 'En la última vista previa, el equipo no tiene escudo: la capa queda vacía.',
  assetRatio: 'Recurso',
  boxRatio: 'Caja',
  matchAssetRatio: 'Ajustar la caja a la proporción del recurso',
  x: 'X (%)',
  y: 'Y (%)',
  width: 'Ancho (%)',
  height: 'Alto (%)',
  rowGap: 'Espacio entre filas (%)',
  partX: 'X (% de la fila)',
  partY: 'Y (% de la fila)',
  partWidth: 'Ancho (% de la fila)',
  partHeight: 'Alto (% de la fila)',
  visible: 'Visible',
  text: 'Texto fijo',
  binding: 'Dato deportivo',
  noBinding: 'Elige un dato',
  required: 'Obligatorio (si falta el dato, la vista previa lo marca como error)',
  fontRole: 'Familia',
  fontRoleOption: (label: string, family: string, weight: number): string => `${label} · ${family} ${weight}`,
  maxFontSize: 'Tamaño máximo (px)',
  minFontSize: 'Tamaño mínimo (px)',
  maxLines: 'Líneas máximas',
  color: 'Color de la paleta',
  align: 'Alineación',
  verticalAlign: 'Alineación vertical',
  overflow: 'Si el texto no cabe',
  overflowNote: 'El texto nunca se corta: lo que no cabe se informa como error.',
  effect: 'Efecto',
  effectNote:
    'Sombras, brillos y contornos en los colores de la marca, dibujados por el motor final. Con una sombra o un contorno oscuro el texto se lee sobre cualquier fondo.',
  uppercase: 'Mostrar en mayúsculas',
  uppercaseNote:
    'Solo cambia cómo se dibuja: el valor guardado no cambia y el nombre oficial de un equipo se conserva tal cual.',
  asset: 'Recurso',
  fit: 'Ajuste en el recuadro',
  brandAssetNote:
    'Se dibuja el archivo original, sin modificar ni enviar a la IA, escalado proporcionalmente dentro del recuadro.',
  protectedFitNote: 'Un recurso protegido solo se escala proporcionalmente («Contener»).',
  background: 'Fondo',
  backgroundImage: 'Imagen',
  backgroundOrigin: 'Origen',
  backgroundFromProposal: 'Propuesta visual aprobada',
  backgroundFromBrand: 'Fondo de Mi marca',
  backgroundCover: 'El fondo cubre todo el lienzo; si tiene otra proporción, se recorta.',
  canvasSection: 'Lienzo',
  contentType: 'Tipo',
  format: 'Formato',
  dimensions: 'Tamaño',
  canvasFixed: 'El tipo y el formato de una plantilla no cambian después de crearla.',
  resourcesIntro:
    'Recursos activos de Mi marca. Se colocan sin modificar y sin enviarse a la IA; los logotipos y la mascota, como recurso oficial.',
  resourceLogos: 'Logotipos',
  resourceMascots: 'Mascota',
  resourceImages: 'Elementos gráficos',
  resourceBackgrounds: 'Fondos',
  resourceAdd: 'Agregar',
  resourceUseBackground: 'Usar',
  resourceCurrentBackground: 'Fondo actual',
  resourceBadgesNote:
    'Los escudos no son un recurso de Mi marca: agrega una capa «Escudo local» o «Escudo visitante» y se dibuja el escudo del equipo del partido.',
  changeBackground: 'Cambiar fondo',
  backgroundTitle: 'Cambiar el fondo',
  backgroundProposals: 'Propuestas aprobadas',
  backgroundAssets: 'Fondos de Mi marca',
  backgroundNone: 'No hay otros fondos disponibles.',
  backgroundApply: 'Usar este fondo',
  validation: 'Validación',
  validationStale: 'Hay cambios sin guardar: guarda para actualizar la validación.',
  validationOk: 'Sin errores ni advertencias.',
  validationOkShort: 'Sin errores',
  validationButton: (summary: string, stale: boolean): string =>
    `Validación: ${summary}${stale ? ' (hay cambios sin guardar)' : ''}`,
  errors: (count: number): string => `${count} ${count === 1 ? 'error' : 'errores'}`,
  warnings: (count: number): string => `${count} ${count === 1 ? 'advertencia' : 'advertencias'}`,
  errorTag: 'Error',
  warningTag: 'Advertencia',
  validationNote:
    'Los errores impiden publicar; las advertencias son para que las revises. La validación no garantiza un resultado perfecto: la aprobación final es tuya.',
} as const;

/**
 * The recommended action of each validation issue (the server message says what is wrong; this says what to do).
 * The codes are those of the contract `VisualTemplateIssueCode`.
 */
export const issueActionCopy: Partial<Record<VisualTemplateIssueCode, string>> = {
  OUT_OF_CANVAS: 'Mueve o reduce la capa hasta que quede dentro del lienzo.',
  TOO_SMALL: 'Agranda la capa en «Posición y tamaño».',
  FONT_SIZE_INVALID: 'Haz que el tamaño mínimo sea menor o igual que el máximo.',
  OVERLAP: 'Separa las capas, o déjalo si el solapamiento es intencionado.',
  PROTECTED_OVERLAP: 'Mueve la capa para no tapar el logotipo o la mascota.',
  BINDING_MISSING: 'Elige el dato deportivo en «Contenido».',
  BINDING_NOT_ALLOWED: 'Elige un dato disponible para este tipo de plantilla.',
  REQUIRED_BINDING_MISSING: 'Agrega una capa de dato deportivo con ese dato.',
  ASSET_MISSING: 'Elige otro recurso de Mi marca.',
  ASSET_INACTIVE: 'Elige otro recurso o actívalo en Mi marca.',
  ASSET_DELETED: 'Elige otro recurso de Mi marca.',
  ASSET_NOT_ALLOWED: 'Elige un recurso compatible con esta capa.',
  TEXT_TOO_LONG: 'Acorta el texto, agranda la caja o permite más líneas.',
  TEXT_MAY_NOT_FIT: 'Agranda la caja, permite más líneas o baja el tamaño mínimo.',
  LOW_CONTRAST: 'Cambia el color o agrega un efecto de sombra o contorno.',
  HIDDEN_LAYER: 'Muéstrala, o elimínala si no la necesitas.',
  NO_LAYERS: 'Agrega una capa con «Agregar capa».',
  BACKGROUND_UNAVAILABLE: 'Cambia el fondo.',
  BACKGROUND_SOURCE_DELETED: 'Cambia el fondo.',
  BACKGROUND_ASPECT: 'Revisa el recorte o usa un fondo con la proporción del lienzo.',
  BACKGROUND_REVIEW: 'Revisa el fondo antes de publicar.',
  BACKGROUND_OWN_PROMPT: 'Revisa el fondo antes de publicar.',
  BACKGROUND_GENERATED_BRAND: 'Coloca el logotipo y Ketsi con capas de recurso oficial.',
  VALUE_MISSING: 'Prueba con otros datos o completa el dato en Competiciones.',
  TEXT_OVERFLOW: 'Agranda la caja, permite más líneas o baja el tamaño mínimo.',
};

export const previewCopy = {
  heading: 'Vista previa con datos locales',
  context: 'Contexto deportivo',
  localData: 'Datos deportivos locales',
  update: 'Actualizar vista previa',
  imageRegion: 'Imagen de la vista previa',
  empty: 'Elige los datos deportivos y pulsa «Previsualizar» para ver la plantilla dibujada por el motor final.',
  updated: (width: number, height: number): string => `Vista previa actualizada · ${width} × ${height} px`,
  download: 'Descargar muestra',
  details: 'Datos vinculados y observaciones',
  detailsEmpty: 'Aquí aparecerán los valores resueltos y las observaciones de la vista previa.',
  valuesNote:
    'Valores de Competiciones, con sus correcciones manuales. La vista previa no modifica ningún dato deportivo.',
  intro:
    'Elige datos existentes de Competiciones. La imagen la dibuja el mismo motor que las piezas finales, sin llamar a OpenAI.',
  competition: 'Competición',
  season: 'Temporada',
  round: 'Jornada',
  match: 'Partido',
  language: 'Idioma',
  choose: 'Elige…',
  anyRound: 'Todas las jornadas',
  noRound: 'Sin jornada',
  loadFailedTitle: 'No se pudieron cargar los datos deportivos',
  needMatch: 'Elige un partido.',
  needRound: 'Elige una jornada.',
  submit: 'Previsualizar',
  running: 'Generando vista previa…',
  savesFirst: 'Se guardará el borrador antes de previsualizar.',
  failedTitle: 'No se pudo generar la vista previa',
  imageAlt: 'Vista previa de la plantilla con los datos seleccionados',
  imageFailed: 'No se pudo cargar la imagen de la vista previa.',
  values: 'Valores resueltos',
  noValue: 'Sin dato',
  badge: (side: string): string => `Escudo ${side}`,
  hasBadge: 'Escudo del equipo',
  noBadge: 'Sin escudo (la capa queda vacía)',
  issues: 'Observaciones de esta vista previa',
  noIssues: 'Todos los datos se resolvieron y el texto cabe.',
  matchOption: (home: string, away: string, round: string | null): string =>
    `${home} vs ${away}${round === null ? '' : ` · ${round}`}`,
} as const;
