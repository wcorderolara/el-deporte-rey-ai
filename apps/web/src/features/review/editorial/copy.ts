import type {
  EditorialDeliverable,
  EditorialFieldName,
  EditorialFlag,
  EditorialVersionOrigin,
  EditorialVersionState,
  EditorialWriter,
} from '@edr/contracts';

/** Texts of the editorial copy of the review (PD-ARCH-01H). */
export const editorialCopy = {
  title: 'Copy editorial',
  intro:
    'Textos para cada red social escritos a partir de los datos deportivos confirmados del proyecto. Las fuentes se ' +
    'muestran aparte y nunca dentro del texto publicable.',
  loading: 'Cargando el copy editorial…',
  loadError: 'No se pudo cargar el copy editorial.',
  actionError: 'No se pudo completar la acción sobre el copy editorial.',
  noDraft: 'El proyecto todavía no tiene un borrador: el copy editorial se genera a partir de él.',
  noConfirmedFacts:
    'Ningún partido del borrador tiene datos confirmados. Sin hechos confirmados no se genera copy editorial.',
  empty: 'Todavía no hay copy editorial para este borrador.',
  generateAll: 'Generar copy editorial',
  regenerateAll: 'Regenerar los cinco textos',
  generating: 'Generando…',
  tabsLabel: 'Entregables del copy editorial',
  researchLocal: 'Generado con contexto local',
  researchVerified: 'Enriquecido con investigación verificada',
  roundIncomplete: (finished: number, total: number | null) =>
    total === null
      ? 'Jornada sin terminar: el copy no la presenta como cerrada.'
      : `Jornada sin terminar: ${String(finished)} de ${String(total)} partidos finalizados. El copy no la presenta como cerrada.`,
  costTitle: 'Costo de la generación',
  costEstimate: (total: number | null) =>
    total === null ? 'No se puede estimar el costo.' : `Costo estimado: hasta US$ ${total.toFixed(4)} por generación.`,
  costUsage: (writer: EditorialWriter) =>
    `Gasto del mes: US$ ${(writer.spentThisMonth ?? 0).toFixed(4)} de US$ ${(writer.monthlySpendLimit ?? 0).toFixed(2)}. ` +
    `Generaciones hoy: ${String(writer.generationsToday)} de ${String(writer.maxGenerationsPerDay)}.`,
  costConfirm: 'Confirmo el costo estimado de esta generación',
  missingKey: 'Falta la clave del proveedor de IA de texto (EDR_AI_API_KEY). No se puede generar.',
  version: (number: number) => `Versión ${String(number)}`,
  instructionsUsed: (text: string) => `Instrucción: «${text}»`,
  copy: 'Copiar',
  copyAll: 'Copiar texto',
  download: 'Descargar copys (.txt)',
  downloaded: 'Copys descargados.',
  copied: 'Copiado al portapapeles.',
  copyFailed: 'No se pudo copiar. Selecciona el texto y cópialo a mano.',
  approve: 'Aprobar copy',
  withdraw: 'Retirar aprobación',
  edit: 'Editar texto',
  save: 'Guardar cambios',
  cancel: 'Descartar cambios',
  saving: 'Guardando…',
  regenerate: 'Regenerar',
  regenerateWith: (writer: Pick<EditorialWriter, 'kind'>): string =>
    writer.kind === 'test' ? 'Regenerar texto de prueba' : 'Regenerar con IA',
  approvalTitle: 'Aprobación editorial',
  approvalScope: 'Cada texto se aprueba por separado. El copy editorial no forma parte de la descarga del carrusel.',
  editingHold: 'Guarda o descarta los cambios antes de aprobar o regenerar este texto.',
  editingStale:
    'El texto cambió en el servidor desde que empezaste a editar: al guardar se rechazará. Descarta tus cambios para ver la versión actual.',
  anyEditingHold: 'Guarda o descarta los cambios abiertos antes de regenerar los cinco textos.',
  noFlags: 'Sin avisos.',
  validationsTitle: 'Validaciones',
  flagCount: (count: number) => (count === 1 ? '1 aviso' : `${String(count)} avisos`),
  regenerateTitle: 'Regenerar',
  packageTitle: 'Paquete editorial',
  actionsLabel: (title: string) => `Acciones del copy: ${title}`,
  words: (count: number) => (count === 1 ? '1 palabra' : `${String(count)} palabras`),
  characters: (count: number) => (count === 1 ? '1 carácter' : `${String(count)} caracteres`),
  hashtagCount: (count: number) => (count === 1 ? '1 hashtag' : `${String(count)} hashtags`),
  socialTab: 'Copy para redes',
  captionTab: 'Texto del carrusel',
  tabApproved: 'Aprobado',
  tabNotGenerated: 'Sin generar',
  tabFlagged: 'Con avisos',
  tabUnsaved: 'Sin guardar',
  tabBlocked: 'Bloqueo',
  tabWarning: 'Advertencia',
  instructionsLabel: 'Instrucciones para regenerar (opcional)',
  instructionsHint:
    'Por ejemplo: «Hazlo más polémico», «Reduce el sarcasmo» o «Enfócate en la derrota del líder». No cambian los datos confirmados.',
  flagsTitle: 'Avisos: corrige o regenera antes de aprobar',
  noVersion: 'Este entregable todavía no tiene texto.',
  researchTitle: 'Investigación y fuentes',
  researchLocalNote:
    'No se consultaron fuentes externas: el texto se apoya solo en los datos deportivos locales confirmados.',
  keyEvents: 'Acontecimientos',
  noKeyEvents: 'Ningún acontecimiento destacado en los datos confirmados.',
  sources: 'Fuentes',
  retrievedAt: 'Fecha de consulta',
  unverified: 'Información no verificada (no se usa en el copy)',
  conflicts: 'Discrepancias (no se usan en el copy)',
  none: 'Ninguna.',
  lastFailure: 'La última generación falló',
} as const;

export const deliverableLabel: Readonly<Record<EditorialDeliverable, string>> = {
  facebook_instagram: 'Facebook / Instagram',
  tiktok_reels: 'TikTok / Reels',
  viral_headlines: 'Titulares virales',
  youtube: 'YouTube',
  debate_question: 'Pregunta de debate',
};

/** The order of the deliverable tabs in the review (UX-REVIEW-01). */
export const DELIVERABLE_TAB_ORDER: readonly EditorialDeliverable[] = [
  'facebook_instagram',
  'tiktok_reels',
  'youtube',
  'viral_headlines',
  'debate_question',
];

export const deliverableTitle: Readonly<Record<EditorialDeliverable, string>> = {
  facebook_instagram: 'Facebook e Instagram',
  tiktok_reels: 'TikTok y Reels',
  viral_headlines: 'Tres titulares virales',
  youtube: 'YouTube',
  debate_question: 'Pregunta de debate',
};

export const fieldLabel: Readonly<Record<EditorialFieldName, string>> = {
  headline: 'Gancho',
  body: 'Desarrollo',
  question: 'Pregunta',
  hashtags: 'Hashtags',
  copy: 'Texto',
  headline_1: 'Titular 1',
  headline_2: 'Titular 2',
  headline_3: 'Titular 3',
  title: 'Título SEO',
  description: 'Descripción',
};

export const stateLabel: Readonly<Record<EditorialVersionState, string>> = {
  ready: 'Listo para aprobar',
  flagged: 'Con avisos',
  approved: 'Aprobado',
  superseded: 'Reemplazado',
};

export const originLabel: Readonly<Record<EditorialVersionOrigin, string>> = {
  generated: 'generado',
  regenerated: 'regenerado',
  edited: 'editado a mano',
};

/** The label of who wrote the text: never "AI" for the stub. */
export function writerLabel(writer: Pick<EditorialWriter, 'kind' | 'model'>): string {
  switch (writer.kind) {
    case 'test':
      return 'Texto de prueba (sin IA)';
    case 'hosted_ai':
      return `Escrito por IA (${writer.model ?? 'modelo configurado'})`;
    case 'local_ai':
      return `Escrito por IA local (${writer.model ?? 'modelo configurado'})`;
  }
}

const FLAG_TEXT: Readonly<Record<EditorialFlag['code'], string>> = {
  UNKNOWN_FACT_REFERENCE: 'Referencia a un dato que no existe',
  UNVERIFIED_NUMBER: 'Número que no es un dato confirmado',
  NON_OFFICIAL_TEAM_NAME: 'Nombre de equipo distinto del oficial',
  FORBIDDEN_CONTENT: 'Contenido no permitido (enlaces, menciones, marcas o caracteres ocultos)',
  UNPLAYED_RESULT_CLAIM: 'Afirma o predice el resultado de un partido no jugado',
  LENGTH_OUT_OF_RANGE: 'Longitud fuera del rango',
  FORMAT_RULE: 'Regla de formato',
  UNKNOWN_EVENT_REFERENCE: 'Acontecimiento que no está en los datos',
  UNKNOWN_EVIDENCE_REFERENCE: 'Fuente que no está en los datos',
  INCOMPLETE_ROUND_CLAIM: 'Presenta como terminada una jornada sin terminar',
  STANDINGS_CLAIM_WITHOUT_DATA: 'Habla de la clasificación sin datos de clasificación',
};

export function flagText(flag: EditorialFlag): string {
  return `${FLAG_TEXT[flag.code]}: «${flag.excerpt}»`;
}
