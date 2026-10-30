/**
 * Fields of the create form. Radio groups are used where each option carries its own availability, sources or
 * standings note, so that the reason of an unavailable option is visible next to it and announced with it
 * (`aria-describedby`); unavailable options are disabled and never chosen (R-286).
 */
import type {
  Catalogue,
  CatalogueCompetition,
  CompetitionSource,
  Language,
  SeasonList,
  SourceListing,
  Stage,
  StageList,
} from '@edr/contracts';
import { LanguageSchema } from '@edr/contracts';
import { useId } from 'react';

import { AvailabilityNote, DataModeBadge, ListingProvenance, StatusBadge } from '../../ui';
import { createCopy, languageLabel, standingsExpectationLabel } from './copy';
import styles from './Projects.module.css';
import {
  isCompetitionChoosable,
  isSourceChoosable,
  isStageChoosable,
  selectableSources,
  sortCompetitions,
  sortedMatchdays,
  sortStages,
  type MatchdayChoice,
} from './selection';

/** Element-ID-safe form of a contract slug or source ID (both are `[a-z0-9-]`). */
function idPart(value: string): string {
  return value.replace(/[^a-z0-9-]/g, '_');
}

function UnavailableLabel() {
  return <StatusBadge label={createCopy.competitionUnavailable} tone="caution" symbol="✕" />;
}

/** Sources of the catalogue with availability and listing provenance (R-141, R-291). */
export function CatalogueSources({ sources }: { sources: readonly SourceListing[] }) {
  return (
    <section aria-labelledby="catalogue-sources-title" className={styles.panel}>
      <h2 id="catalogue-sources-title">{createCopy.catalogueSources}</h2>
      <ul className={styles.plainList}>
        {sources.map((source) => (
          <li key={source.sourceId} className={styles.sourceListing}>
            <p className={styles.sourceName}>
              {source.sourceName} <DataModeBadge mode={source.mode} />
            </p>
            <AvailabilityNote availability={source.availability} />
            <ListingProvenance listing={source.listing} surface="studio" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompetitionSources({ competition }: { competition: CatalogueCompetition }) {
  return (
    <>
      <span className={styles.secondary}>{createCopy.sourcesOf}:</span>
      <ul className={styles.inlineList}>
        {competition.sources.map((source) => (
          <li key={source.sourceId}>
            {source.sourceName} <DataModeBadge mode={source.mode} />
            {source.selectable ? null : <span className={styles.secondary}> ({createCopy.notSelectableSource})</span>}
            <AvailabilityNote availability={source.availability} />
          </li>
        ))}
      </ul>
    </>
  );
}

export interface CompetitionFieldProps {
  catalogue: Catalogue;
  value: string | null;
  onChange: (competition: CatalogueCompetition) => void;
}

/** Competition selector: the catalogue (R-243, R-282), reference competitions first, each with its sources. */
export function CompetitionField({ catalogue, value, onChange }: CompetitionFieldProps) {
  const prefix = useId();
  const competitions = sortCompetitions(catalogue.competitions);
  return (
    <fieldset className={styles.fieldset}>
      <legend>{createCopy.competitionLegend}</legend>
      {competitions.length === 0 ? <p>{createCopy.catalogueEmpty}</p> : null}
      <ul className={styles.choiceList}>
        {competitions.map((competition) => {
          const inputId = `${prefix}-competition-${idPart(competition.id)}`;
          const descriptionId = `${inputId}-description`;
          const choosable = isCompetitionChoosable(competition);
          const noSelectableSource = selectableSources(competition).length === 0;
          return (
            <li key={competition.id} className={styles.choice}>
              <input
                type="radio"
                id={inputId}
                name="competition"
                value={competition.id}
                checked={value === competition.id}
                disabled={!choosable}
                aria-describedby={descriptionId}
                onChange={() => onChange(competition)}
              />
              <label htmlFor={inputId}>
                {competition.name}
                {competition.areaName === null ? null : (
                  <span className={styles.secondary}> ({competition.areaName})</span>
                )}
                {competition.reference ? (
                  <>
                    {' '}
                    <StatusBadge label={createCopy.reference} tone="info" symbol="★" />
                  </>
                ) : null}
                {choosable ? null : (
                  <>
                    {' '}
                    <UnavailableLabel />
                  </>
                )}
              </label>
              <div id={descriptionId} className={styles.choiceDescription}>
                <details>
                  <summary>{createCopy.competitionAvailabilityDetails}</summary>
                  <CompetitionSources competition={competition} />
                  {noSelectableSource ? <p className={styles.secondary}>{createCopy.competitionNoSource}</p> : null}
                </details>
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export interface SourceFieldProps {
  competition: CatalogueCompetition;
  value: string | null;
  onChange: (source: CompetitionSource) => void;
}

/** Data source selector: the competition's selectable sources only, the first available preselected (OD-16). */
export function SourceField({ competition, value, onChange }: SourceFieldProps) {
  const prefix = useId();
  const hintId = `${prefix}-source-hint`;
  const sources = selectableSources(competition);
  const anyChoosable = sources.some(isSourceChoosable);
  return (
    <fieldset className={styles.fieldset} aria-describedby={hintId}>
      <legend>{createCopy.sourceLegend}</legend>
      <p id={hintId} className={styles.hint}>
        {anyChoosable ? createCopy.sourceHint : createCopy.sourceNone}
      </p>
      <ul className={styles.choiceList}>
        {sources.map((source) => {
          const inputId = `${prefix}-source-${idPart(source.sourceId)}`;
          const descriptionId = `${inputId}-description`;
          const choosable = isSourceChoosable(source);
          return (
            <li key={source.sourceId} className={styles.choice}>
              <input
                type="radio"
                id={inputId}
                name="source"
                value={source.sourceId}
                checked={value === source.sourceId}
                disabled={!choosable}
                aria-describedby={choosable ? undefined : descriptionId}
                onChange={() => onChange(source)}
              />
              <label htmlFor={inputId}>
                {source.sourceName} <DataModeBadge mode={source.mode} />
                {choosable ? null : (
                  <>
                    {' '}
                    <UnavailableLabel />
                  </>
                )}
              </label>
              {choosable ? null : (
                <div id={descriptionId} className={styles.choiceDescription}>
                  <AvailabilityNote availability={source.availability} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export interface SeasonFieldProps {
  seasonList: SeasonList;
  value: string | null;
  onChange: (seasonId: string | null) => void;
}

/** Season selector: only the seasons the chosen source reports (R-243), with the listing's provenance (R-291). */
export function SeasonField({ seasonList, value, onChange }: SeasonFieldProps) {
  const selectId = useId();
  const provenanceId = `${selectId}-provenance`;
  if (!seasonList.availability.available) {
    return (
      <div className={styles.field}>
        <p className={styles.fieldTitle}>{createCopy.seasonsUnavailable}</p>
        <AvailabilityNote availability={seasonList.availability} />
        <ListingProvenance listing={seasonList.listing} surface="studio" />
      </div>
    );
  }
  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.fieldTitle}>
        {createCopy.seasonLabel}
      </label>
      {seasonList.seasons.length === 0 ? (
        <p>{createCopy.seasonsEmpty}</p>
      ) : (
        <select
          id={selectId}
          value={value ?? ''}
          aria-describedby={provenanceId}
          onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">{createCopy.seasonPlaceholder}</option>
          {seasonList.seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.current ? `${season.label} (${createCopy.seasonCurrent})` : season.label}
            </option>
          ))}
        </select>
      )}
      <div id={provenanceId}>
        <ListingProvenance listing={seasonList.listing} surface="studio" />
      </div>
    </div>
  );
}

function StageDescription({ stage }: { stage: Stage }) {
  const matchdays = sortedMatchdays(stage);
  return (
    <>
      <p>
        {createCopy.matchdays(matchdays)} · {stage.selectableAsWhole ? createCopy.stageWhole : createCopy.stageNotWhole}
      </p>
      {stage.standings === 'expected' ? (
        <p>{standingsExpectationLabel.expected}</p>
      ) : (
        <p className={styles.note}>
          <span aria-hidden="true">ⓘ </span>
          {standingsExpectationLabel[stage.standings]}
        </p>
      )}
      <AvailabilityNote availability={stage.availability} />
      {stage.availability.available && !isStageChoosable(stage) ? (
        <p className={styles.secondary}>{createCopy.stageNoChoice}</p>
      ) : null}
    </>
  );
}

export interface StageFieldProps {
  stageList: StageList;
  value: string | null;
  onChange: (stage: Stage) => void;
}

/**
 * Stage selector: the season's stages by the source's names and order, with their matchday numbers, whether the
 * stage can be chosen as a whole and a note when standings are not expected (R-077, R-283, R-284).
 */
export function StageField({ stageList, value, onChange }: StageFieldProps) {
  const prefix = useId();
  if (!stageList.availability.available) {
    return (
      <div className={styles.field}>
        <p className={styles.fieldTitle}>{createCopy.seasonUnavailable}</p>
        <AvailabilityNote availability={stageList.availability} />
        <ListingProvenance listing={stageList.listing} surface="studio" />
      </div>
    );
  }
  const stages = sortStages(stageList.stages);
  return (
    <fieldset className={styles.fieldset}>
      <legend>{createCopy.stageLegend}</legend>
      {stages.length === 0 ? <p>{createCopy.stagesEmpty}</p> : null}
      <ul className={styles.choiceList}>
        {stages.map((stage) => {
          const inputId = `${prefix}-stage-${idPart(stage.id)}`;
          const descriptionId = `${inputId}-description`;
          const choosable = isStageChoosable(stage);
          return (
            <li key={stage.id} className={styles.choice}>
              <input
                type="radio"
                id={inputId}
                name="stage"
                value={stage.id}
                checked={value === stage.id}
                disabled={!choosable}
                aria-describedby={descriptionId}
                onChange={() => onChange(stage)}
              />
              <label htmlFor={inputId}>
                {stage.name}
                {choosable ? null : (
                  <>
                    {' '}
                    <UnavailableLabel />
                  </>
                )}
              </label>
              <div id={descriptionId} className={styles.choiceDescription}>
                <StageDescription stage={stage} />
              </div>
            </li>
          );
        })}
      </ul>
      <ListingProvenance listing={stageList.listing} surface="studio" />
    </fieldset>
  );
}

export interface MatchdayFieldProps {
  stage: Stage;
  value: MatchdayChoice;
  onChange: (value: MatchdayChoice) => void;
}

/** Matchday of the chosen stage, or the whole stage when the source allows it (AD-24). */
export function MatchdayField({ stage, value, onChange }: MatchdayFieldProps) {
  const selectId = useId();
  const matchdays = sortedMatchdays(stage);
  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.fieldTitle}>
        {stage.selectableAsWhole ? createCopy.matchdayLabel : createCopy.matchdayOnlyLabel}
      </label>
      <select
        id={selectId}
        value={value === null ? '' : String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? null : raw === 'whole' ? 'whole' : Number(raw));
        }}
      >
        {stage.selectableAsWhole ? (
          <option value="whole">{createCopy.wholeStage}</option>
        ) : (
          <option value="">{createCopy.matchdayPlaceholder}</option>
        )}
        {matchdays.map((matchday) => (
          <option key={matchday} value={String(matchday)}>
            {createCopy.matchday(matchday)}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface LanguageFieldProps {
  value: Language;
  onChange: (value: Language) => void;
  label?: string;
}

/** Content language, Spanish by default (PD-06, R-236). */
export function LanguageField({ value, onChange, label = createCopy.languageLabel }: LanguageFieldProps) {
  const selectId = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.fieldTitle}>
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(event) => {
          const parsed = LanguageSchema.safeParse(event.target.value);
          if (parsed.success) {
            onChange(parsed.data);
          }
        }}
      >
        {LanguageSchema.options.map((language) => (
          <option key={language} value={language}>
            {languageLabel[language]}
          </option>
        ))}
      </select>
    </div>
  );
}
