/** Domain values owned by the local competition administration module. */
export interface LocalSeason {
  readonly id: string;
  readonly competitionId: string;
  readonly label: string;
  readonly createdAt: string;
}

export interface LocalTeam {
  readonly id: string;
  readonly name: string;
  readonly region: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SeasonParticipant {
  readonly team: LocalTeam;
  readonly joinedAt: string;
}
