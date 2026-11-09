/** Spanish copy of the AI design proposals (PD-ARCH-01G-B). */
import type {
  BrandAssetUsagePolicy,
  DesignContentType,
  DesignMode,
  DesignFormat,
  DesignGenerationStatus,
  DesignProposalStatus,
  DesignReferenceRole,
} from '@edr/contracts';

import type { BadgeVariant } from '../../ui';

export const contentTypeLabel: Record<DesignContentType, string> = {
  match_preview: 'Previa individual',
  round_overview: 'Calendario',
  fixture: 'Próximos partidos',
  match_result: 'Resultados',
};

export const formatLabel: Record<DesignFormat, string> = {
  '1:1': '1:1 · Cuadrado',
  '4:5': '4:5 · Vertical (feed)',
  '9:16': '9:16 · Historia o reel',
};

export const qualityLabel: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  xhigh: 'Muy alta',
  max: 'Máxima',
  auto: 'Automática',
};

export const roleLabel: Record<DesignReferenceRole, string> = {
  style_reference: 'Inspiración de estilo (se envía a la IA)',
  transform_base: 'Base para transformar (se envía a la IA)',
  reserved_placement: 'Colocar el original en el diseño',
};

export const roleDescription: Record<DesignReferenceRole, string> = {
  style_reference:
    'La IA solo toma colores, luz y composición. Nunca copia personas, logos ni textos de la imagen, aunque aparezcan en ella.',
  transform_base: 'La imagen es el punto de partida del diseño; el original no cambia.',
  reserved_placement:
    'El archivo original se coloca sin modificar sobre el diseño, en su zona: el logotipo arriba al centro, la mascota abajo a la derecha. La IA no lo recibe ni lo dibuja.',
};

/** Labels of the roles in the own-prompt mode, where the operator's prompt says how each image is used. */
export const ownRoleLabel: Record<DesignReferenceRole, string> = {
  style_reference: 'Enviar como imagen (se usa según tu prompt)',
  transform_base: 'Enviar como imagen base',
  reserved_placement: 'Colocar el original en el diseño',
};

export const ownRoleDescription: Record<DesignReferenceRole, string> = {
  style_reference: 'La imagen se envía a la IA, que la usa como indique tu prompt (por ejemplo, para dibujar a Ketsi).',
  transform_base: 'La imagen se envía como punto de partida del diseño; el original no cambia.',
  reserved_placement:
    'El archivo original se coloca sin modificar encima del resultado, en su zona (logotipo arriba al centro, mascota abajo a la derecha). La IA no lo recibe.',
};

export const modeLabel: Record<DesignMode, string> = {
  guided: 'Diseño de plantilla (guiado)',
  own_prompt: 'Prompt propio (inspiración)',
};

export const modeBadge: Record<DesignMode, string> = {
  guided: 'Guiado · base de plantilla',
  own_prompt: 'Prompt propio · inspiración',
};

export interface ModeGuide {
  readonly forWhat: string;
  readonly aiDoes: string;
  readonly systemDoes: string;
  readonly notAllowed: string;
  readonly yourText: string;
  readonly ketsi: string;
  readonly result: string;
}

/** The comparison shown in "¿Qué modo uso?" and in the creation dialog. */
export const modeGuide: Record<DesignMode, ModeGuide> = {
  guided: {
    forWhat: 'Crear el fondo de una plantilla reutilizable para generar contenido con datos reales.',
    aiDoes: 'Solo el fondo: estadio, luces, colores, marcos y espacios vacíos.',
    systemDoes:
      'Coloca el logo y Ketsi originales; más adelante (01G-C) insertará nombres, escudos, fecha y marcador reales.',
    notAllowed: 'Textos, cifras, marcadores, personas, logos o escudos dibujados por la IA.',
    yourText: 'Describe ambiente, colores y composición. Se agregan las reglas de la marca automáticamente.',
    ketsi: 'Se coloca el original, sin cambios, abajo a la derecha.',
    result: 'Una propuesta que puede convertirse en plantilla.',
  },
  own_prompt: {
    forWhat:
      'Probar ideas libres (miniaturas, pósters, composiciones completas) o editar una imagen de referencia tuya, enviada como imagen base.',
    aiDoes: 'La imagen completa según tu prompt, con textos, personajes y poses si los pides.',
    systemDoes:
      'Envía tu prompt tal cual. Solo agrega qué es cada imagen enviada y, si eliges «Colocar el original», deja libre su zona y lo coloca encima.',
    notAllowed: 'Enviar recursos «Protegidos»: el logo y el Ketsi oficial nunca se envían a la IA.',
    yourText: 'Pega tu prompt completo (hasta 12.000 caracteres), con sus secciones y saltos de línea.',
    ketsi:
      'Para que la IA dibuje a Ketsi en otra pose, sube en Mi marca una copia de Ketsi con uso «Transformable» y envíala como imagen.',
    result:
      'Una imagen plana. Si deja vacías las zonas de datos (escudos, nombres, marcador), podrá usarse como base de plantilla en la siguiente fase (01G-C).',
  },
};

export const guideCopy = {
  title: '¿Qué modo uso?',
  rows: {
    forWhat: 'Para qué sirve',
    aiDoes: 'Qué hace la IA',
    systemDoes: 'Qué hace el sistema',
    notAllowed: 'Qué no permite',
    yourText: 'Qué escribes',
    ketsi: 'Ketsi',
    result: 'Resultado',
  } as Record<keyof ModeGuide, string>,
} as const;

export const policyLabel: Record<BrandAssetUsagePolicy, string> = {
  protected: 'Protegido',
  reference_only: 'Solo referencia',
  reusable: 'Reutilizable',
  transformable: 'Transformable',
};

export const generationStatusLabel: Record<DesignGenerationStatus, string> = {
  queued: 'Pendiente',
  preparing_references: 'Preparando referencias',
  sending_request: 'Enviando solicitud',
  generating: 'Generando',
  saving: 'Guardando resultado',
  completed: 'Completada',
  failed: 'Fallida',
};

export const proposalStatusLabel: Record<DesignProposalStatus, string> = {
  pending_review: 'Pendiente de revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  changes_requested: 'Cambios solicitados',
};

export const proposalStatusTone: Record<DesignProposalStatus, BadgeVariant> = {
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  changes_requested: 'info',
};

export const STYLE_SUGGESTIONS = [
  'Cinematográfico',
  'Deportivo',
  'Editorial',
  'Minimalista',
  'Dinámico',
  'Épico',
] as const;

export const designCopy = {
  heading: 'Propuestas visuales con IA',
  intro:
    'Genera composiciones visuales con la identidad de Mi marca. Una propuesta es una imagen para revisar: no es una plantilla y no se usa para generar contenido.',
  separation:
    'Los nombres de equipos, escudos, fechas, marcadores, la competición, el logo oficial y Ketsi original no se generan: el motor local los inserta después.',
  create: 'Crear diseño con IA',
  statusDisabled: 'La generación de imágenes no está configurada en el servidor.',
  statusMissingKey:
    'Falta la clave de la API de imágenes en el servidor (EDR_IMAGE_API_KEY). Configúrala en .env.local y reinicia el servidor.',
  checkAccess: 'Comprobar acceso al modelo',
  checking: 'Comprobando…',
  access: {
    available: 'La cuenta puede usar el modelo.',
    unavailable: 'El modelo no está disponible para esta cuenta.',
    not_authorized:
      'La cuenta no está autorizada para el modelo. Revisa la clave y la verificación de la organización.',
    missing_api_key: 'Falta la clave de la API en el servidor.',
    disabled: 'La generación no está configurada.',
    error: 'No se pudo comprobar el acceso.',
  } as Record<string, string>,
  usage: (used: number, max: number): string => `${String(used)} de ${String(max)} imágenes hoy`,
  spent: (amount: number): string => `Gasto calculado este mes: ${usd(amount)}`,
  loading: 'Cargando las propuestas…',
  loadFailedTitle: 'No se pudieron cargar las propuestas',
  capabilitiesFailedTitle: 'No se pudo consultar la generación de imágenes',
  empty: 'Todavía no hay propuestas visuales.',
  emptyDescription: 'Crea un diseño con IA para ver aquí las propuestas y revisarlas.',
  listLabel: 'Propuestas visuales',
  tableCaption: 'Propuestas visuales generadas con IA',
  filterStatus: 'Estado',
  allStatuses: 'Todos los estados',
  count: (shown: number, total: number): string =>
    shown === total ? `${String(total)} propuestas` : `${String(shown)} de ${String(total)} propuestas`,
  columns: {
    preview: 'Vista previa',
    name: 'Nombre',
    type: 'Tipo',
    format: 'Formato',
    date: 'Fecha',
    status: 'Estado',
    model: 'Modelo',
    references: 'Recursos de marca',
    actions: 'Acciones',
  },
  noReferences: 'Ninguno',
  open: (name: string): string => `Ver detalle de ${name}`,
  select: (name: string): string => `Seleccionar ${name} para comparar`,
  compare: (count: number): string => `Comparar (${String(count)})`,
  compareTitle: 'Comparar propuestas',
  compareHint: 'Selecciona de 2 a 4 propuestas para compararlas.',
  previewAlt: (name: string): string => `Propuesta «${name}»`,
  previewFailed: 'No se pudo cargar la imagen.',
  variantOf: 'Variante',
  filterMode: 'Modo',
  allModes: 'Todos los modos',
  delete: (name: string): string => `Eliminar ${name}`,
  deleteTitle: 'Eliminar propuesta',
  deleteQuestion: (name: string): string => `¿Eliminar «${name}» de la biblioteca?`,
  deleteNote:
    'Deja de aparecer y no se puede revisar ni usar para variantes. El registro se conserva para la trazabilidad.',
  deleteConfirm: 'Eliminar',
  deleting: 'Eliminando…',
  deleted: (name: string): string => `Propuesta «${name}» eliminada.`,
  deleteFailedTitle: 'No se pudo eliminar la propuesta',
} as const;

export const createCopy = {
  title: 'Crear diseño con IA',
  variantTitle: 'Solicitar variante',
  variantNote:
    'Se generará una imagen nueva a partir de esta propuesta, con las instrucciones actuales. La propuesta original no cambia.',
  contentType: 'Tipo de contenido',
  format: 'Formato',
  model: 'Modelo',
  quality: 'Calidad',
  qualityHint: 'Más calidad puede aumentar el costo y el tiempo de generación.',
  count: 'Cantidad de propuestas',
  countHint: (max: number): string => `Entre 1 y ${String(max)} por solicitud.`,
  style: 'Estilo',
  styleHint: 'Elige una sugerencia o escribe tu propio estilo.',
  instructions: 'Instrucciones',
  mode: 'Modo de generación',
  ownPrompt: 'Tu prompt (se envía tal cual)',
  ownPromptRequired: 'Escribe tu prompt: en este modo es obligatorio.',
  ownPromptHint:
    'Pega aquí tu prompt completo, con sus secciones y saltos de línea. No se corta ni se le agregan reglas; solo se añade qué es cada imagen enviada y las zonas de los originales que coloques.',
  characters: (count: number, max: number): string =>
    `${count.toLocaleString('es-GT')} de ${max.toLocaleString('es-GT')} caracteres`,
  protectedNote:
    'Los recursos «Protegidos» (como el logo y el Ketsi oficial) nunca se envían a la IA: solo se pueden colocar como original. Para que la IA dibuje a Ketsi, sube en Mi marca una copia con uso «Transformable».',
  ownReview:
    'Se envía tu prompt tal cual. Al final solo se agrega qué es cada imagen enviada y las zonas de los originales que se colocan.',
  guidedReview:
    'Tu texto va dentro de las instrucciones de la marca, con sus reglas: sin textos, sin personas, solo fondo.',
  variantMode: (mode: string): string => `Esta variante usa el mismo modo que su propuesta de origen: ${mode}.`,
  changesHeading: 'CAMBIOS SOLICITADOS:',
  startFrom: 'Punto de partida',
  startPrevious: 'Editar la imagen anterior',
  startPreviousHint:
    'Se envía la imagen anterior junto con tu prompt. Útil para cambios puntuales: la IA conserva casi todo lo demás.',
  startScratch: 'Generar desde cero con este prompt',
  startScratchHint: 'No se envía la imagen anterior. Útil para cambiar la composición, las poses o la distribución.',
  ownChanges: 'Cambios para la imagen anterior (se envían tal cual)',
  ownVariantNote:
    'Escribe solo lo que debe cambiar: la imagen anterior ya contiene tu prompt original, y repetirlo contradice los cambios. Se envía tal cual, junto con la imagen anterior; lo demás se conserva.',
  ownScratchNote:
    'Abajo está tu prompt completo y, al final, los cambios que pediste. Intégralos en el prompt y quita lo que los contradiga: se genera una imagen nueva sin partir de la anterior. La propuesta original no cambia.',
  instructionsHint:
    'Describe la composición, el ambiente y los colores. La IA no dibuja personas, logos ni textos. Para incluir el logo o Ketsi, elige «Colocar el original en el diseño» en Recursos de marca.',
  newInstructions: 'Nuevas instrucciones',
  inherited: 'Instrucciones originales (se conservan)',
  references: 'Recursos de marca',
  referencesHint: (max: number): string =>
    `Elige hasta ${String(max)} recursos activos y cómo participa cada uno. Nada se envía automáticamente.`,
  noAssets: 'No hay recursos activos en Mi marca.',
  role: (label: string): string => `Uso de «${label}»`,
  notUsed: 'No usar',
  onePerZone: 'Solo se puede colocar un original por zona: un logotipo, una mascota y un elemento gráfico.',
  placed: 'Se colocan sin IA, tal como están en Mi marca',
  sentList: 'Se envían a la IA',
  nothingPlaced: 'Ningún original de Mi marca se colocará en el diseño.',
  review: 'Revisar alcance y costo',
  reviewing: 'Calculando…',
  back: 'Volver a editar',
  scope: 'Alcance de la generación',
  provider: 'Proveedor',
  size: 'Tamaño solicitado',
  output: 'Tamaño de la propuesta',
  adaptation: 'Adaptación local',
  adaptationNone: 'Ninguna',
  adaptationCrop: 'Recorte centrado, sin deformar',
  sent: 'Se envía',
  notSent: 'No se envía',
  prompt: 'Instrucciones efectivas para la IA',
  cost: 'Costo estimado',
  costEstimated: (total: number, per: number): string => `${usd(total)} (${usd(per)} por imagen)`,
  costBasis:
    'Estimación con el costo publicado de salida para un tamaño estándar. Las imágenes de referencia, el texto y el tamaño exacto pueden cambiar el costo real.',
  costUnavailable:
    'No hay una estimación confiable para este modelo y calidad. El costo real se calcula después con el uso que informa el proveedor.',
  pricing: (source: string, date: string): string => `Precios configurados: ${source} (revisados el ${date}).`,
  limits: (used: number, max: number): string => `Llevas ${String(used)} de ${String(max)} imágenes hoy.`,
  confirm:
    'Entiendo que esta generación usa la API de OpenAI con la clave del servidor y puede generar costos en esa cuenta.',
  generate: (count: number): string => (count === 1 ? 'Generar 1 propuesta' : `Generar ${String(count)} propuestas`),
  generating: 'Enviando…',
  failedTitle: 'No se pudo preparar la generación',
  textInvalid: 'Usa solo texto imprimible.',
  tooLong: (max: number): string => `Admite como máximo ${String(max)} caracteres.`,
} as const;

export const progressCopy = {
  title: 'Generación en curso',
  done: 'Generación completada',
  failed: 'La generación falló',
  image: (index: number, total: number): string => `Imagen ${String(index)} de ${String(total)}`,
  saved: (count: number, total: number): string => `${String(count)} de ${String(total)} propuestas guardadas`,
  confirmed: 'Estados confirmados por el servidor; no se muestran porcentajes estimados.',
  retryAfter: (seconds: number): string => `El proveedor pide esperar ${String(seconds)} segundos.`,
  dismiss: 'Cerrar aviso',
  cost: (amount: number): string => `Costo calculado: ${usd(amount)}`,
} as const;

export const detailCopy = {
  /** PD-ARCH-01G-C: an approved proposal can become the base of a structured template. */
  createTemplate: 'Crear plantilla',
  title: (name: string): string => `Propuesta: ${name}`,
  data: 'Datos de la propuesta',
  type: 'Tipo de contenido',
  format: 'Formato',
  size: 'Dimensiones',
  model: 'Modelo y calidad',
  created: 'Creada',
  status: 'Estado',
  references: 'Recursos de marca usados',
  layers: 'Originales colocados sin IA',
  showComposed: 'Ver con los originales',
  showBackground: 'Ver solo el fondo generado',
  promptTitle: 'Instrucciones enviadas a la IA',
  promptVersion: (version: string): string => `Generada con las instrucciones ${version}.`,
  outdated: (version: string, current: string): string =>
    `Esta propuesta se generó con una versión anterior de las instrucciones (${version}); las actuales son ${current}. Las imágenes ya generadas no cambian: genera una variante para aplicar las reglas actuales.`,
  style: 'Estilo',
  instructions: 'Instrucciones',
  inherited: 'Instrucciones originales',
  usage: 'Uso informado',
  tokens: (total: number): string => `${String(total)} tokens`,
  cost: 'Costo calculado',
  costUnknown: 'No se pudo calcular',
  decisions: 'Historial de revisión',
  noDecisions: 'Sin decisiones todavía.',
  variants: (count: number): string => (count === 1 ? '1 variante' : `${String(count)} variantes`),
  approve: 'Aprobar',
  reject: 'Rechazar',
  requestChanges: 'Solicitar cambios y generar variante',
  note: 'Qué debe cambiar',
  noteHint:
    'Obligatorio al solicitar cambios. Describe solo lo que cambia (por ejemplo: «Ketsi de pie a la derecha»), en hasta 1.200 caracteres. En el paso siguiente revisas el texto que se envía, el alcance y el costo antes de generar.',
  noteCharacters: (count: number, max: number): string =>
    `${count.toLocaleString('es-GT')} de ${max.toLocaleString('es-GT')} caracteres`,
  noteTooLong: (max: number): string =>
    `Admite como máximo ${max.toLocaleString('es-GT')} caracteres: describe solo lo que cambia.`,
  noteRequired: 'Indica qué cambios necesita la propuesta.',
  variant: 'Solicitar variante',
  decided: (status: string): string => `Propuesta marcada como: ${status}.`,
  failedTitle: 'No se pudo guardar la decisión',
  loadFailedTitle: 'No se pudo cargar la propuesta',
  approvalNote: 'Aprobar una propuesta no crea ni cambia ninguna plantilla.',
  ownPromptNote:
    'Generada con tu prompt propio. Si deja vacías las zonas de datos (escudos, nombres, marcador), podrá usarse como base de plantilla en la siguiente fase (01G-C). Las variantes se generan también con prompt propio.',
} as const;

export function usd(amount: number): string {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(
    amount,
  );
}
