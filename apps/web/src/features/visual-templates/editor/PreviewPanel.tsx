import {
  type CompetitionRound,
  LanguageSchema,
  type Language,
  type VisualTemplateContentType,
  type VisualTemplatePreview,
} from '@edr/contracts';
import { useCallback, useId, useState } from 'react';

import { Alert, Button, ErrorBanner, Select } from '../../../ui';
import { languageLabel } from '../../brand/copy';
import { PreviewImage } from '../../brand/PreviewImage';
import { useResource } from '../../brand/useResource';
import type { CompetitionsApi } from '../../competitions/api';
import { badgeBindingLabel, bindingLabel, previewCopy } from '../copy';
import type { VisualTemplatesApi } from '../visualTemplatesApi';
import { IssueList } from './ValidationPanel';

/** The read operations of Competiciones the preview needs (existing local data only). */
export type PreviewSportsApi = Pick<
  CompetitionsApi,
  'list' | 'listSeasons' | 'listSeasonRounds' | 'listStages' | 'listStageRounds' | 'listMatches'
>;

/** A round with the name shown in the selector. */
interface RoundOption {
  readonly id: string;
  readonly label: string;
}

/**
 * Every round of a season, as the project wizard reads them: the rounds without a stage and the rounds of each stage
 * (imported calendars put every round in a stage), in stage order then round order. With more than one stage the
 * stage name is shown before the round name.
 */
async function seasonRounds(
  sportsApi: PreviewSportsApi,
  competitionId: string,
  seasonId: string,
  signal: AbortSignal,
): Promise<RoundOption[]> {
  const [direct, stages] = await Promise.all([
    sportsApi.listSeasonRounds(competitionId, seasonId, signal),
    sportsApi.listStages(competitionId, seasonId, signal),
  ]);
  const ordered = [...stages].sort((a, b) => a.displayOrder - b.displayOrder);
  const staged = await Promise.all(
    ordered.map((stage) => sportsApi.listStageRounds(competitionId, seasonId, stage.id, signal)),
  );
  const byOrder = (a: CompetitionRound, b: CompetitionRound) => a.displayOrder - b.displayOrder;
  const named = stages.length > 1;
  const options: RoundOption[] = [...direct].sort(byOrder).map((round) => ({ id: round.id, label: round.name }));
  ordered.forEach((stage, index) => {
    for (const round of [...(staged[index] ?? [])].sort(byOrder)) {
      options.push({ id: round.id, label: named ? `${stage.name} · ${round.name}` : round.name });
    }
  });
  return options.filter((option, index) => options.findIndex((other) => other.id === option.id) === index);
}

export interface PreviewPanelProps {
  api: VisualTemplatesApi;
  sportsApi: PreviewSportsApi;
  templateId: string;
  contentType: VisualTemplateContentType;
  /** True when the draft has unsaved changes (they are saved before the preview). */
  dirty: boolean;
  /** Saves the draft when needed; resolves with the version to preview, or null when the save failed. */
  prepare: () => Promise<string | null>;
  layerNames: ReadonlyMap<string, string>;
  onSelectLayer: (layerId: string) => void;
  /** Receives each new preview, so the design mode can show the resolved value of a bound layer. */
  onResult?: (preview: VisualTemplatePreview) => void;
}

const empty = async () => Promise.resolve([]);

/** Content types whose slides show one match. */
const MATCH_TYPES: ReadonlySet<VisualTemplateContentType> = new Set(['match_preview', 'fixture', 'match_result']);

/**
 * The preview mode of the editor (PD-ARCH-01G-C): the sports context (an existing competition, season, round and
 * match of the local data, and the language), the PNG the server draws with the same slide engine as the final
 * pieces, and the resolved values with the issues of that rendering. No AI provider is called and no value is
 * invented: a missing value is reported. The draft is saved first when it has changes.
 */
export function PreviewPanel({
  api,
  sportsApi,
  templateId,
  contentType,
  dirty,
  prepare,
  layerNames,
  onSelectLayer,
  onResult,
}: PreviewPanelProps) {
  const baseId = useId();
  const [competitionId, setCompetitionId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [matchId, setMatchId] = useState('');
  const [language, setLanguage] = useState<Language>('es');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [result, setResult] = useState<VisualTemplatePreview | null>(null);

  const competitions = useResource(useCallback((signal: AbortSignal) => sportsApi.list(signal), [sportsApi]));
  const seasons = useResource(
    useCallback(
      (signal: AbortSignal) => (competitionId === '' ? empty() : sportsApi.listSeasons(competitionId, signal)),
      [sportsApi, competitionId],
    ),
  );
  const rounds = useResource(
    useCallback(
      (signal: AbortSignal) =>
        competitionId === '' || seasonId === '' ? empty() : seasonRounds(sportsApi, competitionId, seasonId, signal),
      [sportsApi, competitionId, seasonId],
    ),
  );
  const matchList = useResource(
    useCallback(
      (signal: AbortSignal) =>
        competitionId === '' || seasonId === '' || !MATCH_TYPES.has(contentType)
          ? empty()
          : sportsApi.listMatches(competitionId, seasonId, signal),
      [sportsApi, competitionId, seasonId, contentType],
    ),
  );

  // A match slide needs a match, a round calendar a round; a cover takes a round if given, a closing none (01G-D-3).
  const needsMatch = MATCH_TYPES.has(contentType);
  const needsRound = contentType === 'round_overview';
  const showRound = contentType !== 'closing';
  const matchOptions =
    matchList.state.status === 'ready'
      ? matchList.state.data.filter((match) => roundId === '' || match.round?.id === roundId)
      : [];
  const ready =
    competitionId !== '' && seasonId !== '' && (needsMatch ? matchId !== '' : needsRound ? roundId !== '' : true);
  const loadFailure = [competitions, seasons, rounds, matchList].find((item) => item.state.status === 'error');

  async function run() {
    if (!ready || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const versionId = await prepare();
      if (versionId === null) return;
      const preview = await api.preview(templateId, versionId, {
        selection: {
          competitionId,
          seasonId,
          ...(roundId === '' || !showRound ? {} : { roundId }),
          ...(matchId === '' || !needsMatch ? {} : { matchId }),
        },
        language,
      });
      setResult(preview);
      onResult?.(preview);
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <section
        aria-labelledby={`${baseId}-context`}
        className="grid min-h-0 content-start gap-3 overflow-y-auto rounded-xl border border-border-subtle bg-surface-raised p-4"
      >
        <h2 id={`${baseId}-context`} className="m-0 font-display text-body-md font-bold text-text-primary">
          {previewCopy.context}
        </h2>
        <p className="m-0 inline-flex w-fit items-center gap-1.5 rounded-full bg-info-surface px-2.5 py-0.5 text-caption font-bold text-info">
          {previewCopy.localData}
        </p>
        <p className="m-0 text-caption text-text-secondary">{previewCopy.intro}</p>
        {loadFailure !== undefined && loadFailure.state.status === 'error' ? (
          <ErrorBanner
            error={loadFailure.state.error}
            title={previewCopy.loadFailedTitle}
            onRetry={loadFailure.reload}
          />
        ) : null}
        <Select
          id={`${baseId}-competition`}
          label={previewCopy.competition}
          value={competitionId}
          onChange={(event) => {
            setCompetitionId(event.target.value);
            setSeasonId('');
            setRoundId('');
            setMatchId('');
          }}
        >
          <option value="">{previewCopy.choose}</option>
          {(competitions.state.status === 'ready' ? competitions.state.data : []).map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.name}
            </option>
          ))}
        </Select>
        <Select
          id={`${baseId}-season`}
          label={previewCopy.season}
          value={seasonId}
          disabled={competitionId === ''}
          onChange={(event) => {
            setSeasonId(event.target.value);
            setRoundId('');
            setMatchId('');
          }}
        >
          <option value="">{previewCopy.choose}</option>
          {(seasons.state.status === 'ready' ? seasons.state.data : []).map((season) => (
            <option key={season.id} value={season.id}>
              {season.label}
            </option>
          ))}
        </Select>
        {showRound ? (
          <Select
            id={`${baseId}-round`}
            label={previewCopy.round}
            value={roundId}
            disabled={seasonId === ''}
            onChange={(event) => {
              setRoundId(event.target.value);
              setMatchId('');
            }}
          >
            <option value="">
              {needsMatch ? previewCopy.anyRound : needsRound ? previewCopy.choose : previewCopy.noRound}
            </option>
            {(rounds.state.status === 'ready' ? rounds.state.data : []).map((round) => (
              <option key={round.id} value={round.id}>
                {round.label}
              </option>
            ))}
          </Select>
        ) : null}
        {needsMatch ? (
          <Select
            id={`${baseId}-match`}
            label={previewCopy.match}
            value={matchId}
            disabled={seasonId === ''}
            onChange={(event) => setMatchId(event.target.value)}
          >
            <option value="">{previewCopy.choose}</option>
            {matchOptions.map((match) => (
              <option key={match.id} value={match.id}>
                {previewCopy.matchOption(match.homeTeam.name, match.awayTeam.name, match.round?.name ?? null)}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          id={`${baseId}-language`}
          label={previewCopy.language}
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          {LanguageSchema.options.map((value) => (
            <option key={value} value={value}>
              {languageLabel[value]}
            </option>
          ))}
        </Select>
        {/* Kept in view at the bottom of the column, under a long list of selectors. */}
        <div className="sticky bottom-0 -mx-4 -mb-4 grid gap-2 border-t border-border-subtle bg-surface-raised p-4">
          <Button isLoading={busy} loadingLabel={previewCopy.running} disabled={!ready} onClick={() => void run()}>
            {result === null ? previewCopy.submit : previewCopy.update}
          </Button>
          {!ready && seasonId !== '' ? (
            <span className="text-caption text-text-subtle">
              {needsMatch ? previewCopy.needMatch : previewCopy.needRound}
            </span>
          ) : null}
          {dirty ? <span className="text-caption text-text-subtle">{previewCopy.savesFirst}</span> : null}
        </div>
      </section>

      <section
        aria-label={previewCopy.imageRegion}
        className="grid min-h-[24rem] place-items-center overflow-auto rounded-xl border border-border-subtle bg-surface-subtle p-4"
      >
        {failure === null ? null : <ErrorBanner error={failure} title={previewCopy.failedTitle} />}
        {result === null ? (
          <p className="m-0 max-w-sm text-center text-body-sm text-text-secondary">{previewCopy.empty}</p>
        ) : (
          <figure className="m-0 grid h-full min-h-0 w-full place-items-center gap-3">
            <PreviewImage
              key={result.imageUrl}
              src={result.imageUrl}
              alt={previewCopy.imageAlt}
              failedText={previewCopy.imageFailed}
              className="h-auto max-h-[calc(100%-3rem)] w-auto max-w-full object-contain shadow-overlay"
              width={result.width}
              height={result.height}
            />
            <figcaption className="flex flex-wrap items-center justify-center gap-3 text-caption text-text-secondary">
              <span>{previewCopy.updated(result.width, result.height)}</span>
              <a
                href={result.imageUrl}
                download
                className="focus-studio font-bold text-text-link underline underline-offset-2"
              >
                {previewCopy.download}
              </a>
            </figcaption>
          </figure>
        )}
      </section>

      <section
        aria-label={previewCopy.details}
        className="grid min-h-0 content-start gap-4 overflow-y-auto rounded-xl border border-border-subtle bg-surface-raised p-4 lg:col-span-2 xl:col-span-1"
      >
        {result === null ? (
          <p className="m-0 text-body-sm text-text-secondary">{previewCopy.detailsEmpty}</p>
        ) : (
          <>
            <section aria-label={previewCopy.values} className="grid gap-2">
              <h3 className="m-0 text-body-sm font-bold text-text-primary">{previewCopy.values}</h3>
              <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body-sm">
                {result.values.map((entry) => (
                  <div key={entry.binding} className="contents">
                    <dt className="font-bold text-text-secondary">{bindingLabel[entry.binding]}</dt>
                    <dd className="m-0 break-words whitespace-pre-line text-text-primary">
                      {entry.value ?? previewCopy.noValue}
                    </dd>
                  </div>
                ))}
                {result.badges.map((entry) => (
                  <div key={entry.binding} className="contents">
                    <dt className="font-bold text-text-secondary">
                      {previewCopy.badge(badgeBindingLabel[entry.binding])}
                    </dt>
                    <dd className={`m-0 ${entry.badgeId === null ? 'text-warning' : 'text-text-primary'}`}>
                      {entry.badgeId === null ? previewCopy.noBadge : previewCopy.hasBadge}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 text-caption text-text-subtle">{previewCopy.valuesNote}</p>
            </section>
            <section aria-label={previewCopy.issues} className="grid gap-2">
              <h3 className="m-0 text-body-sm font-bold text-text-primary">{previewCopy.issues}</h3>
              {result.issues.length === 0 ? (
                <Alert tone="success">{previewCopy.noIssues}</Alert>
              ) : (
                <IssueList
                  issues={result.issues}
                  layerNames={layerNames}
                  onSelect={onSelectLayer}
                  label={previewCopy.issues}
                />
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
