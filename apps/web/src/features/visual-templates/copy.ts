/** Spanish copy of the structured visual templates (PD-ARCH-01G-C). */
import type {
  VisualTemplateBinding,
  VisualTemplateImageFit,
  VisualTemplateLayerType,
  VisualTemplateStatus,
  VisualTemplateTextEffect,
  VisualTemplateTextStyle,
  VisualTemplateVersionStatus,
} from '@edr/contracts';

import type { BadgeVariant } from '../../ui';

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

export const layerTypeLabel: Record<VisualTemplateLayerType, string> = {
  text: 'Texto',
  sports_data: 'Dato deportivo',
  image: 'Imagen de Mi marca',
  brand_asset: 'Recurso oficial',
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
  open: (name: string): string => `Abrir «${name}» en el editor`,
  edit: 'Editar borrador',
  view: 'Ver',
  preview: 'Previsualizar',
  publish: 'Publicar',
  newVersion: 'Crear nueva versión',
  archive: 'Archivar',
  restore: 'Restaurar',
  delete: (name: string): string => `Eliminar «${name}»`,
  actionFailedTitle: 'No se pudo completar la acción',
  deleteTitle: 'Eliminar plantilla',
  deleteQuestion: (name: string): string => `¿Eliminar la plantilla «${name}»?`,
  deleteNote:
    'Solo se pueden eliminar las plantillas que nunca se publicaron. La plantilla deja de aparecer; los recursos de marca y la propuesta de origen no cambian.',
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
    'Si ninguna propuesta sirve como fondo, cierra este diálogo y crea una nueva o solicita una variante en «Propuestas visuales con IA», en esta misma página.',
  proposalAlt: (name: string): string => `Propuesta «${name}»`,
  proposalFailed: 'No se pudo cargar la imagen.',
  name: 'Nombre de la plantilla',
  nameRequired: 'Escribe un nombre de hasta 80 caracteres.',
  description: 'Descripción (opcional)',
  contentType: 'Tipo de contenido de la plantilla',
  contentTypeHint:
    'Define qué datos deportivos puede mostrar (por ejemplo, el marcador solo en Resultados). No se puede cambiar después.',
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
  editMetadata: 'Editar datos',
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
  publish: 'Publicar versión',
  publishing: 'Publicando…',
  publishTitle: 'Publicar versión',
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
  backgroundAlt: 'Fondo de la plantilla',
  backgroundFailed: 'No se pudo cargar el fondo.',
  layers: 'Capas',
  layersHint: 'La primera capa de la lista queda al fondo y la última encima.',
  noLayers: 'La plantilla no tiene capas. Agrega textos, datos deportivos o recursos de marca.',
  addLayer: 'Agregar capa',
  addText: 'Texto',
  addSportsData: 'Dato deportivo',
  addImage: 'Imagen de Mi marca',
  addLogo: 'Logotipo oficial',
  addMascot: 'Ketsi',
  noImageAsset: 'No hay elementos gráficos ni fondos activos en Mi marca.',
  noLogo: 'No hay un logotipo activo en Mi marca.',
  noMascot: 'No hay una mascota activa en Mi marca.',
  moveUp: (name: string): string => `Subir «${name}»`,
  moveDown: (name: string): string => `Bajar «${name}»`,
  hide: (name: string): string => `Ocultar «${name}»`,
  show: (name: string): string => `Mostrar «${name}»`,
  remove: (name: string): string => `Eliminar la capa «${name}»`,
  hidden: 'Oculta',
  selectLayer: (name: string): string => `Capa «${name}»`,
  properties: 'Propiedades',
  noSelection: 'Selecciona una capa para editar sus propiedades.',
  layerName: 'Nombre de la capa',
  position: 'Posición y tamaño (% del lienzo)',
  x: 'X (%)',
  y: 'Y (%)',
  width: 'Ancho (%)',
  height: 'Alto (%)',
  visible: 'Visible',
  text: 'Texto fijo',
  binding: 'Dato deportivo',
  noBinding: 'Elige un dato',
  required: 'Obligatorio (si falta el dato, la vista previa lo marca como error)',
  fontRole: 'Tipografía',
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
  backgroundSource: (label: string): string => `Fondo actual: ${label}`,
  changeBackground: 'Cambiar fondo',
  backgroundTitle: 'Cambiar el fondo',
  backgroundProposals: 'Propuestas aprobadas',
  backgroundAssets: 'Fondos de Mi marca',
  backgroundNone: 'No hay otros fondos disponibles.',
  backgroundApply: 'Usar este fondo',
  validation: 'Validación',
  validationStale: 'Hay cambios sin guardar: guarda para actualizar la validación.',
  validationOk: 'Sin errores ni advertencias.',
  errors: (count: number): string => `${count} ${count === 1 ? 'error' : 'errores'}`,
  warnings: (count: number): string => `${count} ${count === 1 ? 'advertencia' : 'advertencias'}`,
  errorTag: 'Error',
  warningTag: 'Advertencia',
  validationNote:
    'Los errores impiden publicar; las advertencias son para que las revises. La validación no garantiza un resultado perfecto: la aprobación final es tuya.',
} as const;

export const previewCopy = {
  heading: 'Vista previa con datos locales',
  intro:
    'Elige datos existentes de Competiciones. La imagen la dibuja el mismo motor que las piezas finales, sin llamar a OpenAI.',
  competition: 'Competición',
  season: 'Temporada',
  round: 'Jornada',
  match: 'Partido',
  language: 'Idioma',
  choose: 'Elige…',
  anyRound: 'Todas las jornadas',
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
  issues: 'Observaciones de esta vista previa',
  noIssues: 'Todos los datos se resolvieron y el texto cabe.',
  matchOption: (home: string, away: string, round: string | null): string =>
    `${home} vs ${away}${round === null ? '' : ` · ${round}`}`,
} as const;
