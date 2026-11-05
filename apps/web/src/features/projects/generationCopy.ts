/**
 * Copy of the content generation from local competitions (PD-ARCH-01E-A): labels of the wizard, of the batch result
 * and of the closed values of the content batch contract. Spanish, like the rest of the interface.
 */
import type {
  CompetitionMatch,
  ContentBatch,
  ContentBatchItemStatus,
  ContentPieceKind,
  ContentPieceSkipReason,
} from '@edr/contracts';

import type { BadgeVariant } from '../../ui';

export const generationSteps = ['Contexto deportivo', 'Tipo de contenido', 'Partidos', 'Revisión'] as const;

export const pieceKindCopy: Readonly<Record<ContentPieceKind, { label: string; description: string }>> = {
  round_results: {
    label: 'Resultados de jornada',
    description: 'Un carrusel con todos los partidos finalizados que selecciones.',
  },
  match_result: {
    label: 'Resultado individual',
    description: 'Una pieza por cada partido finalizado que selecciones.',
  },
  round_calendar: {
    label: 'Calendario de jornada',
    description: 'Un carrusel con los partidos de la jornada que aún no han finalizado: portada, resumen y partidos.',
  },
  upcoming_matches: {
    label: 'Próximos partidos',
    description: 'Un carrusel con los partidos programados o aplazados que selecciones.',
  },
  match_preview: {
    label: 'Previa individual',
    description: 'Una pieza por cada partido por jugar que selecciones, con la información del encuentro.',
  },
};

/** The two families of content: matches already played, and matches not played yet (PD-ARCH-01E-B). */
export const kindGroups: readonly { label: string; kinds: readonly ContentPieceKind[] }[] = [
  { label: 'Partidos jugados', kinds: ['round_results', 'match_result'] },
  { label: 'Partidos por jugar', kinds: ['round_calendar', 'upcoming_matches', 'match_preview'] },
];

export const skipReasonCopy: Readonly<Record<ContentPieceSkipReason, string>> = {
  not_finished: 'El partido no ha finalizado.',
  already_finished: 'El partido ya finalizó; no es un partido por jugar.',
  not_upcoming: 'El estado del partido no es programado ni aplazado.',
  score_missing: 'El marcador es desconocido; no se representa como 0-0.',
  kickoff_missing: 'El partido no tiene fecha y hora registradas.',
  team_name_not_supported: 'Un nombre de equipo no es compatible con la plantilla.',
  no_eligible_matches: 'Ningún partido seleccionado es compatible con este tipo de contenido.',
  context_not_supported:
    'El contexto no se puede representar: falta la fuente de datos locales o la jornada tiene un nombre demasiado largo.',
};

export const matchStatusCopy: Readonly<Record<CompetitionMatch['status'], string>> = {
  scheduled: 'Programado',
  in_progress: 'En juego',
  finished: 'Finalizado',
  postponed: 'Aplazado',
  cancelled: 'Cancelado',
};

export const itemStatusCopy: Readonly<Record<ContentBatchItemStatus, { label: string; tone: BadgeVariant }>> = {
  skipped: { label: 'Omitida', tone: 'neutral' },
  pending: { label: 'En cola', tone: 'info' },
  running: { label: 'Generando', tone: 'info' },
  completed: { label: 'Generada', tone: 'success' },
  failed: { label: 'Fallida', tone: 'danger' },
  deleted: { label: 'Proyecto eliminado', tone: 'neutral' },
};

export const batchStateCopy: Readonly<Record<ContentBatch['state'], { label: string; tone: BadgeVariant }>> = {
  in_progress: { label: 'En curso', tone: 'info' },
  completed: { label: 'Completada', tone: 'success' },
  partial: { label: 'Completada con errores', tone: 'warning' },
  failed: { label: 'Fallida', tone: 'danger' },
};

/** Score text of a local match: `null/null` is unknown and never shown as 0-0. */
export function scoreText(homeScore: number | null, awayScore: number | null): string {
  return homeScore === null || awayScore === null ? 'Sin marcador' : `${String(homeScore)} - ${String(awayScore)}`;
}
