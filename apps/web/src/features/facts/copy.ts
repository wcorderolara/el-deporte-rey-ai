/**
 * Spanish copy of the facts and verification view (PD-06). Contract values that the shared UI already names (data
 * modes, fact statuses, unverified reasons, refusal reasons, standings reasons) use the tables of `src/ui/copy.ts`.
 *
 * Wording rules (BR-12, BR-17, OD-17, OD-28): a MANUALLY_APPROVED fact is "aprobado manualmente" and "atestiguado
 * por el operador", never "verificado"; DEMO_DATA is always a demonstration; no text claims real-time data (U-24).
 */
import type {
  BlockReason,
  DisputeOutcome,
  EvidenceRelation,
  FactKind,
  LeftOutMatch,
  MatchStatus,
  RunListResponse,
  SourceRole,
} from '@edr/contracts';

import { blockReasonTable } from './reasonText';

type Run = RunListResponse['runs'][number];

export const factsCopy = {
  intro: 'Datos de la ejecución con su estado, la evidencia de cada fuente y los registros de disputa.',
  invalidAddress: 'La dirección no identifica un proyecto y una ejecución válidos.',
  backToProject: 'Volver al proyecto',
  toReview: 'Ir a la revisión del contenido',
  refresh: 'Actualizar datos',
  loadErrorTitle: 'No se pudieron cargar los datos de la ejecución',
  run: (runNumber: number): string => `Ejecución n.º ${runNumber}`,
  runUnknown: 'Ejecución no encontrada en la lista del proyecto',
  dataMode: 'Modo de datos',
  noFacts: 'Esta ejecución no tiene datos registrados.',
  summary: (total: number, verified: number, unverified: number, attested: number): string =>
    `${total === 1 ? '1 dato' : `${total} datos`}: ${verified} verificados, ${unverified} sin verificar, ` +
    `${attested} aprobados manualmente (atestiguados por el operador).`,
} as const;

export const runKindLabel: Record<Run['kind'], string> = {
  full: 'completa',
  redraft: 'solo nueva redacción',
};

export const runStatusLabel: Record<Run['status'], string> = {
  pending: 'pendiente',
  running: 'en curso',
  completed: 'finalizada',
  failed: 'fallida',
};

export const sectionCopy = {
  matches: 'Partidos',
  standings: 'Clasificación',
  teams: 'Equipos',
  context: 'Jornada y contexto',
  leftOut: 'Partidos que quedan fuera',
  standingsAvailable: 'La clasificación está disponible para esta selección.',
  noStandingsFacts: 'No hay filas de clasificación en esta ejecución.',
  match: (label: string): string => `Partido: ${label}`,
} as const;

export const factKindLabel: Record<FactKind, string> = {
  match_teams: 'Equipos del partido',
  match_kickoff: 'Fecha y hora de inicio',
  match_status: 'Estado del partido',
  match_score: 'Marcador',
  standing_row: 'Fila de la clasificación',
  matchday_info: 'Jornada o fase',
  context_item: 'Dato de contexto',
  team_official_name: 'Nombre oficial del equipo',
};

/** How the value of a fact is labelled, by status: only a verified value is called a value without qualifier. */
export const valueCopy = {
  verified: 'Valor',
  candidate: 'Valor candidato (sin verificar)',
  attested: 'Valor aprobado manualmente (atestiguado por el operador)',
  none: 'Sin valor',
  noneDisputed: 'No se muestra ningún valor mientras las fuentes no coincidan.',
  reason: 'Motivo',
  factKey: 'Clave del dato',
} as const;

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

/** Publication approval of content using the fact (architecture section 7.4; R-026, R-271, R-272, R-078). */
export const publicationCopy = {
  title: 'Aprobación de publicación',
  blocked: 'Bloquea la aprobación de publicación del contenido que lo usa',
  noBlockReported: 'El servidor no indica ningún bloqueo de publicación para este dato.',
  attestedNoBlock:
    'El servidor no indica ningún bloqueo de publicación: la competición está configurada sin fuente pública ' +
    'aceptada. El contenido que use este dato se etiqueta como atestiguado por el operador.',
} as const;

/** BlockReason in Spanish; the Spanish and English tables are in `reasonText.ts` (OD-63). */
export const blockReasonLabel: Record<BlockReason, string> = blockReasonTable.es;

export const evidenceCopy = {
  caption: 'Evidencia por fuente',
  empty: 'No hay evidencia registrada para este dato.',
  source: 'Fuente',
  mode: 'Modo de datos',
  role: 'Función',
  accepted: 'Aceptada',
  relation: 'Relación con el dato',
  value: 'Valor de la fuente',
  reference: 'Referencia',
  retrievedAt: 'Obtenido',
  importVersion: 'Versión de importación',
  noImportVersion: 'No aplica',
  viewImports: 'Ver importaciones manuales',
  officialPublication: 'publicación oficial',
  yes: 'Sí',
  no: 'No',
  scrollRegion: (factLabel: string): string => `Evidencia por fuente: ${factLabel}`,
} as const;

export const sourceRoleLabel: Record<SourceRole, string> = {
  primary: 'Principal',
  verification: 'Verificación independiente',
};

export const evidenceRelationLabel: Record<EvidenceRelation, string> = {
  supports: 'Respalda el valor',
  disagrees: 'Discrepa',
  consulted: 'Consultada (no cuenta)',
};

export const disputeCopy = {
  title: 'Registro de disputa',
  valuesCaption: 'Valores por fuente',
  source: 'Fuente',
  independenceGroup: 'Grupo de independencia',
  value: 'Valor',
  consultation: 'Consulta a la publicación oficial',
  notConsulted: 'No se consultó ninguna publicación oficial.',
  consultedAt: 'consultada el',
  outcome: 'Resultado',
  resolvedValue: 'Valor resuelto',
} as const;

export const disputeOutcomeLabel: Record<DisputeOutcome, string> = {
  resolved: 'Resuelta: la publicación oficial coincide con uno de los valores.',
  unavailable: 'Sin resolver: la publicación oficial no está disponible o no da un valor.',
  same_source: 'Sin resolver: la publicación oficial es la misma fuente que uno de los valores en disputa.',
  no_match: 'Sin resolver: la publicación oficial no coincide con ninguno de los valores.',
};

export const manualCopy = {
  approve: 'Aprobar manualmente',
  revoke: 'Revocar la aprobación manual',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  sending: 'Enviando…',
  approveTitle: 'Confirmar la aprobación manual',
  approveBody:
    'El operador atestigua este valor importado. La aprobación queda registrada como atestiguada por el operador: ' +
    'no es una verificación y no cuenta como segunda fuente.',
  revokeTitle: 'Confirmar la revocación',
  revokeBody:
    'El dato volverá a quedar sin aprobación manual y se anularán las aprobaciones finales que dependan de él.',
  approved: 'Dato aprobado manualmente (atestiguado por el operador).',
  revoked: 'Aprobación manual revocada.',
  approvedAt: 'Aprobado manualmente el',
  carriedOver: 'Aprobación conservada de la ejecución anterior porque el dato no cambió.',
  unavailableTitle: 'Aprobación manual no disponible',
  noCandidateValue: 'El dato no tiene un valor candidato.',
  notEligible: 'El dato no cumple las condiciones de la aprobación manual.',
  actionErrorTitle: 'No se pudo completar la acción',
  pageNotManual:
    'La aprobación manual solo existe para proyectos con datos manuales; ningún dato de este proyecto puede ' +
    'aprobarse manualmente. Ninguna acción marca un dato como verificado.',
  pageNotLatest:
    'Esta no es la ejecución completa más reciente del proyecto: la aprobación manual solo se aplica a los datos ' +
    'de esa ejecución. Ninguna acción marca un dato como verificado.',
  pageManual:
    'Los datos manuales elegibles pueden aprobarse manualmente. La aprobación manual es atestiguada por el operador ' +
    'y nunca marca un dato como verificado.',
} as const;

export const leftOutCopy = {
  caption: 'Partidos que quedan fuera del contenido, con su estado',
  none: 'Ningún partido queda fuera del contenido.',
  match: 'Partido',
  status: 'Estado',
  reason: 'Motivo',
  statusUnknown: 'Estado no disponible',
} as const;

export const leftOutReasonLabel: Record<LeftOutMatch['reason'], string> = {
  not_finished: 'El partido no ha finalizado.',
  not_verified: 'Los datos del partido no tienen valor verificado ni candidato, o están en disputa.',
  excluded_by_operator: 'Excluido por el operador.',
  already_finished: 'El partido ya finalizó; no es un partido por jugar.',
  not_upcoming: 'El estado del partido no es programado ni aplazado.',
};

/** Value formatting (`format.ts`). */
export const valueFormatCopy = {
  versus: 'contra',
  home: 'local',
  away: 'visitante',
  position: 'Posición',
  played: 'PJ',
  won: 'G',
  drawn: 'E',
  lost: 'P',
  goalsFor: 'GF',
  goalsAgainst: 'GC',
  goalDifference: 'DG',
  points: 'Pts',
  matchday: (matchday: number, total: number | null): string =>
    total === null ? `jornada ${matchday}` : `jornada ${matchday} de ${total}`,
  totalMatchdays: (total: number): string => `${total} jornadas`,
  teamsInTable: (count: number): string => (count === 1 ? '1 equipo en la tabla' : `${count} equipos en la tabla`),
  matchesInSelection: (count: number): string =>
    count === 1 ? '1 partido en la selección' : `${count} partidos en la selección`,
} as const;
