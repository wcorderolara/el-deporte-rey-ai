/**
 * Spanish copy of the manual import pages (PD-06: Spanish by default). Shared error text, the import-error table and
 * the labels of the import problems come from `src/ui/copy.ts`; this module holds only the feature's own strings and
 * the labels of the import contract values.
 *
 * Wording rules: MANUAL_DATA is never called verified (BR-12, OD-17); an import is applied or rejected as a whole
 * (OD-19); nothing is deleted (OD-08); there are no person-level fields (PD-04, R-119); missing scores or standings
 * are never filled in (BR-14).
 */
import type { ImportChannel, MatchStatus } from '@edr/contracts';

export const importsCopy = {
  intro:
    'Importe datos manuales (MANUAL_DATA) de competiciones sin fuente pública: un archivo JSON o CSV, o el formulario. El servidor valida cada importación completa: si un registro tiene un error, se rechaza toda la importación, se informan todos los errores y no se guarda nada.',
  noPersons:
    'Solo se importan datos de equipos y de competición. Los campos con datos de personas (jugadores, goleadores, árbitros, entrenadores, plantillas) se rechazan.',
  noDerivation:
    'Los marcadores y las clasificaciones que falten no se completan ni se calculan: un partido finalizado necesita su marcador.',
  versions:
    'Para corregir datos, vuelva a importarlos: cada selección importada se guarda como una versión nueva y las versiones anteriores y los originales se conservan. Las importaciones no se borran.',
  statusRegion: 'Avisos de la página de importaciones',
  channelLegend: 'Forma de importar',
  channelFile: 'Archivo JSON o CSV',
  channelForm: 'Formulario',
  errorPrefix: 'Error:',
} as const;

/** ImportSummary.channel. */
export const channelLabel: Record<ImportChannel, string> = {
  json_file: 'Archivo JSON',
  csv_file: 'Archivo CSV',
  form: 'Formulario',
};

/** MatchStatus, in the wording of the facts view. */
export const matchStatusLabel: Record<MatchStatus, string> = {
  scheduled: 'Programado',
  in_play: 'En juego',
  finished: 'Finalizado',
  postponed: 'Aplazado',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
  abandoned: 'Abandonado',
  awarded: 'Resultado adjudicado por decisión administrativa',
};

export const fileCopy = {
  heading: 'Importar un archivo',
  fileField: 'Archivo',
  fileHint:
    'Archivo .json o .csv en UTF-8, de hasta 512 KiB (524 288 bytes). Se envía exactamente como está, sin convertirlo. El nombre admite letras, números, espacios, puntos, guiones, guiones bajos y paréntesis.',
  layouts: 'Formatos aceptados',
  jsonLayout: 'JSON: un documento con el formato «edr-manual-import/1».',
  csvMatchesLayout: 'CSV de partidos, con esta fila de encabezado:',
  csvStandingsLayout: 'CSV de clasificación, con esta fila de encabezado:',
  sourceField: 'Fuente declarada (opcional)',
  sourceHint: 'De dónde provienen los datos, hasta 80 caracteres. Se guarda como texto.',
  submit: 'Importar archivo',
  submitting: 'Importando…',
  fileRequired: 'Seleccione un archivo .json o .csv.',
  fileEmpty: 'El archivo está vacío.',
  fileTooLarge: 'El archivo supera el tamaño máximo de 512 KiB (524 288 bytes). No se envió.',
  fileExtension: 'El nombre del archivo debe terminar en .json o .csv (en minúsculas).',
  fileName:
    'El nombre del archivo no es válido: use hasta 120 caracteres con letras, números, espacios, puntos, guiones, guiones bajos o paréntesis, y la extensión .json o .csv. Cambie el nombre del archivo y vuelva a elegirlo.',
  fileUnreadable: 'No se pudo leer el archivo. Vuelva a elegirlo.',
  sourceTooLong: 'La fuente declarada admite como máximo 80 caracteres.',
  sourceInvalid: 'La fuente declarada contiene caracteres no permitidos (caracteres de control o de formato).',
} as const;

/** Exact CSV header rows (`contracts/provider-ports.md` section 1.6, AD-29). */
export const CSV_MATCHES_HEADER =
  'competition_id,competition_name,season_id,season_label,stage_id,stage_name,stage_order,matchday,home_team,away_team,kickoff,status,home_score,away_score';
export const CSV_STANDINGS_HEADER =
  'competition_id,competition_name,season_id,season_label,stage_id,stage_name,stage_order,matchday,as_of,position,team,played,won,drawn,lost,goals_for,goals_against,goal_difference,points';

export const formCopy = {
  heading: 'Introducir datos con el formulario',
  intro:
    'El formulario crea una importación de una selección: una fase completa o una jornada, con sus equipos, partidos y, si la tiene, su clasificación. Las comprobaciones de esta página son solo una ayuda; el servidor vuelve a validarlo todo.',
  required: 'Los campos sin «(opcional)» son obligatorios.',
  identifierHint:
    'Identificador: minúsculas sin acentos, números y guiones, hasta 64 caracteres (por ejemplo «liga-sintetica»). Use el mismo identificador en todas las importaciones de la misma competición.',
  competitionLegend: 'Competición',
  competitionId: 'Identificador de la competición',
  competitionName: 'Nombre de la competición',
  areaName: 'País o región (opcional)',
  seasonLegend: 'Temporada',
  seasonId: 'Identificador de la temporada',
  seasonLabel: 'Nombre de la temporada',
  stageLegend: 'Fase',
  stageId: 'Identificador de la fase',
  stageName: 'Nombre de la fase',
  stageOrder: 'Orden de la fase en la temporada',
  stageOrderHint: 'Número del 1 al 99.',
  scopeLegend: 'Alcance de la selección',
  scopeMatchday: 'Una jornada',
  scopeStage: 'La fase completa (sin jornadas)',
  matchday: 'Número de jornada',
  matchdayHint: 'Número del 1 al 999.',
  teamsLegend: 'Equipos',
  teamsHint:
    'Entre 2 y 64 equipos, con su nombre oficial. La clave de cada equipo se calcula a partir del nombre con la misma regla que las importaciones CSV.',
  teamName: (index: number): string => `Nombre del equipo ${index}`,
  teamKey: 'Clave',
  teamKeyNone: 'sin clave válida',
  addTeam: 'Añadir equipo',
  removeTeam: (index: number): string => `Quitar el equipo ${index}`,
  matchesLegend: 'Partidos',
  matchesHint: 'Entre 1 y 64 partidos. La fecha y hora se indican en la hora local de este equipo y se envían en UTC.',
  matchLegend: (index: number): string => `Partido ${index}`,
  home: 'Equipo local',
  away: 'Equipo visitante',
  chooseTeam: 'Elija un equipo',
  unnamedTeam: (index: number): string => `Equipo ${index} (sin nombre)`,
  kickoff: 'Fecha y hora de inicio',
  status: 'Estado',
  chooseStatus: 'Elija un estado',
  homeScore: 'Goles del local',
  awayScore: 'Goles del visitante',
  scoreHint: 'Solo un partido finalizado lleva marcador.',
  addMatch: 'Añadir partido',
  removeMatch: (index: number): string => `Quitar el partido ${index}`,
  standingsLegend: 'Clasificación (opcional)',
  includeStandings: 'Incluir la clasificación de esta selección',
  standingsHint:
    'Una fase sin clasificación es válida. Si la incluye, escriba todos los valores tal como los publica la competición; no se calculan.',
  asOf: 'Clasificación a fecha de',
  rowLegend: (index: number): string => `Fila ${index} de la clasificación`,
  position: 'Posición',
  team: 'Equipo',
  played: 'Jugados',
  won: 'Ganados',
  drawn: 'Empatados',
  lost: 'Perdidos',
  goalsFor: 'Goles a favor',
  goalsAgainst: 'Goles en contra',
  goalDifference: 'Diferencia de goles',
  points: 'Puntos',
  addRow: 'Añadir fila',
  removeRow: (index: number): string => `Quitar la fila ${index}`,
  sourceField: 'Fuente declarada (opcional)',
  sourceHint: 'De dónde provienen los datos, hasta 80 caracteres. Se guarda como texto.',
  submit: 'Importar datos del formulario',
  submitting: 'Importando…',
  summaryTitle: (count: number): string =>
    count === 1 ? 'Hay 1 error en el formulario' : `Hay ${count} errores en el formulario`,
  summaryNote: 'No se envió nada. Corrija los campos indicados.',
} as const;

/** Client-side hints of the form (the server stays authoritative). */
export const hintCopy = {
  required: 'Este campo es obligatorio.',
  slug: 'Use minúsculas sin acentos, números y guiones (hasta 64 caracteres), empezando por una letra o un número.',
  displayName: "Use hasta 80 caracteres: letras, números, espacios y los signos . ' & ( ) / -",
  stageName: "Use hasta 80 caracteres: letras, números, espacios y los signos . ' & ( ) / _ -",
  teamName: "Use hasta 64 caracteres: letras, números, espacios y los signos . ' & ( ) -",
  integer: (min: number, max: number): string => `Escriba un número entero entre ${min} y ${max}.`,
  dateTime: 'Escriba una fecha y hora válidas.',
  teamsCount: 'Indique al menos 2 equipos (como máximo 64).',
  teamKeyInvalid: 'El nombre no produce una clave válida: incluya al menos una letra o un número sin acento.',
  teamKeyDuplicate: (key: string): string => `Otro equipo produce la misma clave «${key}»; use nombres distintos.`,
  matchesCount: 'Indique al menos 1 partido (como máximo 64).',
  chooseTeam: 'Elija un equipo de la lista.',
  sameTeams: 'El equipo local y el visitante deben ser distintos.',
  duplicateMatch: 'Este partido ya está en la lista con los mismos equipos.',
  statusRequired: 'Elija el estado del partido.',
  scoreRequired: 'Un partido finalizado necesita el marcador.',
  rowsCount: 'Indique al menos 1 fila (como máximo 64) o desmarque la clasificación.',
  positions: 'Las posiciones deben ser únicas y consecutivas desde 1.',
  results: 'Ganados + empatados + perdidos debe ser igual a jugados.',
  goalDifference: 'Goles a favor − goles en contra debe ser igual a la diferencia de goles.',
  tooLarge: 'Los datos del formulario superan 512 KiB (524 288 bytes) y no se enviaron.',
  format: 'Los datos no cumplen el formato de importación. Revise los campos.',
} as const;

export const resultCopy = {
  appliedTitle: 'Importación aplicada',
  applied: (competition: string, season: string): string =>
    `Se importaron los datos de «${competition}», temporada «${season}».`,
  appliedAnnouncement: (competition: string, season: string): string =>
    `Importación aplicada: «${competition}», temporada «${season}».`,
  rejectedTitle: 'Importación rechazada',
  rejectedFile: (fileName: string): string =>
    `El archivo «${fileName}» fue rechazado completo; no se guardó ningún dato. Corrija todos los errores y vuelva a importarlo.`,
  rejectedForm:
    'Los datos del formulario fueron rechazados completos; no se guardó ningún dato. Corrija todos los errores y vuelva a enviarlos.',
  rejectedAnnouncement: 'Importación rechazada; no se guardó ningún dato.',
  errorCap: 'El servidor informa como máximo 500 errores; puede haber más. Corrija estos y vuelva a importar.',
  failedTitle: 'No se pudo completar la importación',
  newVersion: (versionNumber: number): string =>
    versionNumber === 1
      ? 'versión 1 (primera versión)'
      : `versión ${versionNumber} (nueva versión; las anteriores se conservan)`,
  selections: 'Selecciones importadas',
  createProject: (competition: string): string => `Crear un proyecto con «${competition}»`,
  createProjectHint:
    'La competición aparece en el catálogo con datos manuales; elíjala en el formulario de creación del proyecto.',
  dataNotVerified:
    'Los datos manuales no cuentan como verificación independiente: quedan sin verificar hasta que el operador los apruebe manualmente.',
} as const;

export const historyCopy = {
  heading: 'Historial de importaciones',
  loading: 'Cargando las importaciones…',
  loadFailedTitle: 'No se pudo cargar el historial de importaciones',
  empty: 'Todavía no hay importaciones aplicadas. Las importaciones rechazadas no se guardan.',
  caption: 'Importaciones aplicadas, de la más reciente a la más antigua',
  receivedAt: 'Recibida',
  channel: 'Canal',
  fileName: 'Archivo',
  noFileName: 'Sin archivo (formulario)',
  declaredSource: 'Fuente declarada',
  noDeclaredSource: 'No indicada',
  competition: 'Competición y temporada',
  selections: 'Selecciones y versiones',
  hash: 'SHA-256 del original',
  original: 'Original',
  download: 'Descargar original',
  downloadContext: (name: string, receivedAt: string): string => `(${name}, ${receivedAt})`,
  openAsText:
    'Abra los originales descargados como texto (por ejemplo, en un editor de texto), no en una hoja de cálculo: una hoja de cálculo puede interpretar algunas celdas como fórmulas.',
  hashNote: 'El SHA-256 del original coincide con el del archivo importado.',
} as const;

export const versionsCopy = {
  heading: 'Versiones por selección',
  intro:
    'Cada reimportación de una selección crea una versión nueva. La investigación usa la versión actual; las anteriores siguen disponibles.',
  pairField: 'Competición y temporada',
  noPairs: 'No hay selecciones importadas.',
  loading: 'Cargando las versiones…',
  loadFailedTitle: 'No se pudieron cargar las versiones',
  empty: 'Esta temporada no tiene selecciones importadas.',
  current: 'Actual',
  earlier: 'Anterior',
  versionColumn: 'Versión',
  version: (versionNumber: number): string => `Versión ${versionNumber}`,
  createdAt: 'Creada',
  state: 'Estado',
  view: 'Ver',
  viewVersion: (versionNumber: number, selection: string): string => `Ver la versión ${versionNumber} de ${selection}`,
  versionsCaption: (selection: string): string => `Versiones de ${selection}`,
} as const;

/** Name of a selection: stage name with its matchday, or the whole stage. */
export function selectionName(stageName: string, matchday: number | null): string {
  return matchday === null ? `${stageName}, fase completa` : `${stageName}, jornada ${matchday}`;
}

export const importDetailCopy = {
  invalidAddress: 'La dirección no identifica una importación válida.',
  loading: 'Cargando la importación…',
  loadFailedTitle: 'No se pudo cargar la importación',
  back: 'Volver a las importaciones',
  title: (competition: string, season: string): string => `Importación de «${competition}», temporada «${season}»`,
  rowLink: (receivedAt: string): string => `Importación del ${receivedAt}`,
} as const;

export const versionCopy = {
  invalidAddress: 'La dirección no identifica una versión válida.',
  loading: 'Cargando la versión…',
  loadFailedTitle: 'No se pudo cargar la versión',
  back: 'Volver a las importaciones',
  title: (versionNumber: number, selection: string): string => `Versión ${versionNumber}: ${selection}`,
  current: 'Versión actual: la usa la investigación de los proyectos nuevos.',
  superseded: (at: string): string => `Versión anterior, sustituida el ${at}. Se conserva para consulta.`,
  details: 'Datos de la versión',
  createdAt: 'Creada',
  competition: 'Competición',
  season: 'Temporada',
  importId: 'Importación',
  stageOrder: 'Orden de la fase',
  dataMode: 'Modo de datos',
  teams: 'Equipos',
  teamKey: 'Clave',
  teamName: 'Nombre',
  matches: 'Partidos',
  home: 'Local',
  away: 'Visitante',
  kickoff: 'Inicio',
  status: 'Estado',
  score: 'Marcador',
  noScore: 'Sin marcador',
  standings: 'Clasificación',
  standingsAsOf: (at: string): string => `Clasificación a fecha de ${at}`,
  noStandings: 'Esta versión no incluye clasificación.',
} as const;
