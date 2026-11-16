import type { CompetitionMatch } from '@edr/contracts';
import { Badge, type BadgeVariant } from '../../../ui';
import { deriveRoundStatus, type RoundPresentationStatus } from '../round-status';

export const roundStatusLabels: Record<RoundPresentationStatus, string> = {
  finished: 'Finalizada',
  in_progress: 'En curso',
  scheduled: 'Por jugar',
  empty: 'Sin partidos',
};

const roundStatusTones: Record<RoundPresentationStatus, BadgeVariant> = {
  finished: 'success',
  in_progress: 'warning',
  scheduled: 'info',
  empty: 'neutral',
};

export function RoundStatusIndicator({ matches }: { matches: readonly Pick<CompetitionMatch, 'status'>[] }) {
  const state = deriveRoundStatus(matches);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Badge tone={roundStatusTones[state.status]}>{roundStatusLabels[state.status]}</Badge>
      <span className="text-caption text-text-secondary">{state.summary}</span>
    </div>
  );
}
