import { MatchStatusSchema, type ImportFormCreate, type MatchStatus } from '@edr/contracts';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';

import { formCopy, matchStatusLabel } from './copy';
import {
  buildFormImport,
  deriveTeamKey,
  emptyDraft,
  emptyMatch,
  emptyStanding,
  emptyTeam,
  fieldIds,
  isValidTeamKey,
  MAX_MATCHES,
  MAX_ROWS,
  MAX_TEAMS,
  MIN_MATCHES,
  MIN_TEAMS,
  STANDING_NUMBER_FIELDS,
  type FormDraft,
  type FormIssue,
  type MatchDraft,
  type StandingDraft,
  type StandingNumberField,
} from './formDocument';
import { InputField, SelectField, type SelectOption } from './FormFields';
import styles from './Imports.module.css';

const MATCH_STATUSES: readonly MatchStatus[] = MatchStatusSchema.options;

const standingLabel: Record<StandingNumberField, string> = {
  played: formCopy.played,
  won: formCopy.won,
  drawn: formCopy.drawn,
  lost: formCopy.lost,
  goalsFor: formCopy.goalsFor,
  goalsAgainst: formCopy.goalsAgainst,
  goalDifference: formCopy.goalDifference,
  points: formCopy.points,
};

const standingBounds: Record<StandingNumberField, [number, number]> = {
  played: [0, 999],
  won: [0, 999],
  drawn: [0, 999],
  lost: [0, 999],
  goalsFor: [0, 999],
  goalsAgainst: [0, 999],
  goalDifference: [-999, 999],
  points: [-999, 999],
};

export interface FormImportFormProps {
  /** True while an import is being sent (from either channel). */
  sending: boolean;
  /** Sends the import; resolves to true when it was applied. */
  onSend: (body: ImportFormCreate) => Promise<boolean>;
}

/**
 * Web-form channel of createImport (R-057, R-319): one selection (a matchday or a whole stage) of a competition
 * season, with its teams, matches (status, and a score only when finished) and optional standings. There is no
 * person-level field (R-119). On submit the draft is checked (`formDocument.ts`); hints are listed in a summary that
 * receives focus, each linked to its field, and nothing is sent until they are resolved. The server validates
 * everything again. The entries are kept after an import, so that a correction can be reimported as a new version.
 */
export function FormImportForm({ sending, onSend }: FormImportFormProps) {
  const id = useId();
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [summaryFocus, setSummaryFocus] = useState(0);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const fieldId = (field: string): string => `${id}-${field}`;

  // Focus is moved after the render that shows the summary or the new row.
  useEffect(() => {
    if (summaryFocus > 0) {
      summaryRef.current?.focus();
    }
  }, [summaryFocus]);
  useEffect(() => {
    if (pendingFocus !== null) {
      document.getElementById(pendingFocus)?.focus();
      setPendingFocus(null);
    }
  }, [pendingFocus]);

  const errorsByField = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      map.set(issue.field, [...(map.get(issue.field) ?? []), issue.message]);
    }
    return map;
  }, [issues]);
  const errorsOf = (field: string): string[] => errorsByField.get(field) ?? [];

  const teamOptions: SelectOption[] = draft.teams.map((team, index) => ({
    value: team.uid,
    label: team.name.trim() === '' ? formCopy.unnamedTeam(index + 1) : team.name.trim(),
  }));
  const statusOptions: SelectOption[] = MATCH_STATUSES.map((status) => ({
    value: status,
    label: matchStatusLabel[status],
  }));

  function update(change: Partial<FormDraft>) {
    setDraft((current) => ({ ...current, ...change }));
  }

  function updateTeam(uid: string, name: string) {
    setDraft((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.uid === uid ? { ...team, name } : team)),
    }));
  }

  function updateMatch(uid: string, change: Partial<MatchDraft>) {
    setDraft((current) => ({
      ...current,
      matches: current.matches.map((match) => (match.uid === uid ? { ...match, ...change } : match)),
    }));
  }

  function updateRow(uid: string, change: Partial<StandingDraft>) {
    setDraft((current) => ({
      ...current,
      standings: current.standings.map((row) => (row.uid === uid ? { ...row, ...change } : row)),
    }));
  }

  function addTeam() {
    const team = emptyTeam();
    setDraft((current) => ({ ...current, teams: [...current.teams, team] }));
    setPendingFocus(fieldId(fieldIds.teamName(team.uid)));
  }

  function removeTeam(uid: string) {
    // References to the removed team are cleared, so that no match or row points to it.
    setDraft((current) => ({
      ...current,
      teams: current.teams.filter((team) => team.uid !== uid),
      matches: current.matches.map((match) => ({
        ...match,
        home: match.home === uid ? '' : match.home,
        away: match.away === uid ? '' : match.away,
      })),
      standings: current.standings.map((row) => (row.team === uid ? { ...row, team: '' } : row)),
    }));
    setPendingFocus(fieldId(fieldIds.addTeam));
  }

  function addMatch() {
    const match = emptyMatch();
    setDraft((current) => ({ ...current, matches: [...current.matches, match] }));
    setPendingFocus(fieldId(fieldIds.match(match.uid, 'home')));
  }

  function removeMatch(uid: string) {
    setDraft((current) => ({ ...current, matches: current.matches.filter((match) => match.uid !== uid) }));
    setPendingFocus(fieldId(fieldIds.addMatch));
  }

  function addRow() {
    const row = emptyStanding();
    setDraft((current) => ({ ...current, standings: [...current.standings, row] }));
    setPendingFocus(fieldId(fieldIds.row(row.uid, 'position')));
  }

  function removeRow(uid: string) {
    setDraft((current) => ({ ...current, standings: current.standings.filter((row) => row.uid !== uid) }));
    setPendingFocus(fieldId(fieldIds.addRow));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) {
      return;
    }
    const check = buildFormImport(draft);
    if (!check.ok) {
      setIssues(check.issues);
      setSummaryFocus((value) => value + 1);
      return;
    }
    setIssues([]);
    await onSend(check.body);
  }

  function focusField(event: MouseEvent<HTMLAnchorElement>, field: string) {
    const element = document.getElementById(fieldId(field));
    if (element !== null) {
      event.preventDefault();
      element.focus();
    }
  }

  const headingId = fieldId('heading');
  const summaryTitleId = fieldId('summary-title');

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId}>{formCopy.heading}</h2>
      <p>{formCopy.intro}</p>
      <p className={styles.hint}>{formCopy.required}</p>
      <form className={styles.form} onSubmit={handleSubmit} noValidate aria-labelledby={headingId}>
        {issues.length === 0 ? null : (
          <div ref={summaryRef} className={styles.summary} tabIndex={-1} aria-labelledby={summaryTitleId}>
            <h3 id={summaryTitleId} className={styles.summaryTitle}>
              {formCopy.summaryTitle(issues.length)}
            </h3>
            <p>{formCopy.summaryNote}</p>
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.field}-${index}`}>
                  <a href={`#${fieldId(issue.field)}`} onClick={(event) => focusField(event, issue.field)}>
                    {issue.label}: {issue.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{formCopy.competitionLegend}</legend>
          <p className={styles.hint}>{formCopy.identifierHint}</p>
          <div className={styles.fields}>
            <InputField
              id={fieldId('competitionId')}
              label={formCopy.competitionId}
              value={draft.competitionId}
              onChange={(value) => update({ competitionId: value })}
              errors={errorsOf('competitionId')}
              maxLength={64}
              disabled={sending}
            />
            <InputField
              id={fieldId('competitionName')}
              label={formCopy.competitionName}
              value={draft.competitionName}
              onChange={(value) => update({ competitionName: value })}
              errors={errorsOf('competitionName')}
              maxLength={80}
              disabled={sending}
            />
            <InputField
              id={fieldId('areaName')}
              label={formCopy.areaName}
              value={draft.areaName}
              onChange={(value) => update({ areaName: value })}
              errors={errorsOf('areaName')}
              maxLength={80}
              required={false}
              disabled={sending}
            />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{formCopy.seasonLegend}</legend>
          <div className={styles.fields}>
            <InputField
              id={fieldId('seasonId')}
              label={formCopy.seasonId}
              value={draft.seasonId}
              onChange={(value) => update({ seasonId: value })}
              errors={errorsOf('seasonId')}
              maxLength={64}
              disabled={sending}
            />
            <InputField
              id={fieldId('seasonLabel')}
              label={formCopy.seasonLabel}
              value={draft.seasonLabel}
              onChange={(value) => update({ seasonLabel: value })}
              errors={errorsOf('seasonLabel')}
              maxLength={80}
              disabled={sending}
            />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{formCopy.stageLegend}</legend>
          <div className={styles.fields}>
            <InputField
              id={fieldId('stageId')}
              label={formCopy.stageId}
              value={draft.stageId}
              onChange={(value) => update({ stageId: value })}
              errors={errorsOf('stageId')}
              maxLength={64}
              disabled={sending}
            />
            <InputField
              id={fieldId('stageName')}
              label={formCopy.stageName}
              value={draft.stageName}
              onChange={(value) => update({ stageName: value })}
              errors={errorsOf('stageName')}
              maxLength={80}
              disabled={sending}
            />
            <InputField
              id={fieldId('stageOrder')}
              label={formCopy.stageOrder}
              hint={formCopy.stageOrderHint}
              type="number"
              min={1}
              max={99}
              value={draft.stageOrder}
              onChange={(value) => update({ stageOrder: value })}
              errors={errorsOf('stageOrder')}
              disabled={sending}
            />
          </div>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{formCopy.scopeLegend}</legend>
            <div className={styles.options}>
              <label className={styles.option}>
                <input
                  type="radio"
                  name={fieldId('scope')}
                  value="matchday"
                  checked={draft.scope === 'matchday'}
                  onChange={() => update({ scope: 'matchday' })}
                  disabled={sending}
                />
                {formCopy.scopeMatchday}
              </label>
              <label className={styles.option}>
                <input
                  type="radio"
                  name={fieldId('scope')}
                  value="stage"
                  checked={draft.scope === 'stage'}
                  onChange={() => update({ scope: 'stage' })}
                  disabled={sending}
                />
                {formCopy.scopeStage}
              </label>
            </div>
            {draft.scope === 'matchday' ? (
              <InputField
                id={fieldId('matchday')}
                label={formCopy.matchday}
                hint={formCopy.matchdayHint}
                type="number"
                min={1}
                max={999}
                value={draft.matchday}
                onChange={(value) => update({ matchday: value })}
                errors={errorsOf('matchday')}
                disabled={sending}
              />
            ) : null}
          </fieldset>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{formCopy.teamsLegend}</legend>
          <p className={styles.hint}>{formCopy.teamsHint}</p>
          <ul className={styles.list}>
            {draft.teams.map((team, index) => {
              const key = deriveTeamKey(team.name);
              return (
                <li key={team.uid} className={styles.teamRow}>
                  <InputField
                    id={fieldId(fieldIds.teamName(team.uid))}
                    label={formCopy.teamName(index + 1)}
                    value={team.name}
                    onChange={(value) => updateTeam(team.uid, value)}
                    errors={errorsOf(fieldIds.teamName(team.uid))}
                    maxLength={64}
                    disabled={sending}
                  />
                  <p className={styles.teamKey}>
                    {formCopy.teamKey}:{' '}
                    {team.name.trim() === '' ? (
                      '—'
                    ) : isValidTeamKey(key) ? (
                      <code className={styles.code} translate="no">
                        {key}
                      </code>
                    ) : (
                      formCopy.teamKeyNone
                    )}
                  </p>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => removeTeam(team.uid)}
                    disabled={sending || draft.teams.length <= MIN_TEAMS}
                  >
                    {formCopy.removeTeam(index + 1)}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            id={fieldId(fieldIds.addTeam)}
            type="button"
            className={styles.secondaryButton}
            onClick={addTeam}
            disabled={sending || draft.teams.length >= MAX_TEAMS}
            aria-describedby={errorsOf(fieldIds.addTeam).length > 0 ? `${fieldId(fieldIds.addTeam)}-error` : undefined}
          >
            {formCopy.addTeam}
          </button>
          <ListError id={`${fieldId(fieldIds.addTeam)}-error`} errors={errorsOf(fieldIds.addTeam)} />
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{formCopy.matchesLegend}</legend>
          <p className={styles.hint}>{formCopy.matchesHint}</p>
          {draft.matches.map((match, index) => (
            <fieldset key={match.uid} className={styles.row}>
              <legend className={styles.legend}>{formCopy.matchLegend(index + 1)}</legend>
              <div className={styles.fields}>
                <SelectField
                  id={fieldId(fieldIds.match(match.uid, 'home'))}
                  label={formCopy.home}
                  value={match.home}
                  onChange={(value) => updateMatch(match.uid, { home: value })}
                  options={teamOptions}
                  placeholder={formCopy.chooseTeam}
                  errors={errorsOf(fieldIds.match(match.uid, 'home'))}
                  disabled={sending}
                />
                <SelectField
                  id={fieldId(fieldIds.match(match.uid, 'away'))}
                  label={formCopy.away}
                  value={match.away}
                  onChange={(value) => updateMatch(match.uid, { away: value })}
                  options={teamOptions}
                  placeholder={formCopy.chooseTeam}
                  errors={errorsOf(fieldIds.match(match.uid, 'away'))}
                  disabled={sending}
                />
                <InputField
                  id={fieldId(fieldIds.match(match.uid, 'kickoff'))}
                  label={formCopy.kickoff}
                  type="datetime-local"
                  value={match.kickoff}
                  onChange={(value) => updateMatch(match.uid, { kickoff: value })}
                  errors={errorsOf(fieldIds.match(match.uid, 'kickoff'))}
                  disabled={sending}
                />
                <SelectField
                  id={fieldId(fieldIds.match(match.uid, 'status'))}
                  label={formCopy.status}
                  hint={formCopy.scoreHint}
                  value={match.status}
                  onChange={(value) => updateMatch(match.uid, { status: value as MatchStatus | '' })}
                  options={statusOptions}
                  placeholder={formCopy.chooseStatus}
                  errors={errorsOf(fieldIds.match(match.uid, 'status'))}
                  disabled={sending}
                />
                {match.status === 'finished' ? (
                  <>
                    <InputField
                      id={fieldId(fieldIds.match(match.uid, 'homeScore'))}
                      label={formCopy.homeScore}
                      type="number"
                      min={0}
                      max={99}
                      value={match.homeScore}
                      onChange={(value) => updateMatch(match.uid, { homeScore: value })}
                      errors={errorsOf(fieldIds.match(match.uid, 'homeScore'))}
                      disabled={sending}
                    />
                    <InputField
                      id={fieldId(fieldIds.match(match.uid, 'awayScore'))}
                      label={formCopy.awayScore}
                      type="number"
                      min={0}
                      max={99}
                      value={match.awayScore}
                      onChange={(value) => updateMatch(match.uid, { awayScore: value })}
                      errors={errorsOf(fieldIds.match(match.uid, 'awayScore'))}
                      disabled={sending}
                    />
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => removeMatch(match.uid)}
                disabled={sending || draft.matches.length <= MIN_MATCHES}
              >
                {formCopy.removeMatch(index + 1)}
              </button>
            </fieldset>
          ))}
          <button
            id={fieldId(fieldIds.addMatch)}
            type="button"
            className={styles.secondaryButton}
            onClick={addMatch}
            disabled={sending || draft.matches.length >= MAX_MATCHES}
            aria-describedby={
              errorsOf(fieldIds.addMatch).length > 0 ? `${fieldId(fieldIds.addMatch)}-error` : undefined
            }
          >
            {formCopy.addMatch}
          </button>
          <ListError id={`${fieldId(fieldIds.addMatch)}-error`} errors={errorsOf(fieldIds.addMatch)} />
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{formCopy.standingsLegend}</legend>
          <p className={styles.hint}>{formCopy.standingsHint}</p>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={draft.includeStandings}
              onChange={(event) => update({ includeStandings: event.target.checked })}
              disabled={sending}
            />
            {formCopy.includeStandings}
          </label>
          {draft.includeStandings ? (
            <>
              <InputField
                id={fieldId('asOf')}
                label={formCopy.asOf}
                type="datetime-local"
                value={draft.asOf}
                onChange={(value) => update({ asOf: value })}
                errors={errorsOf('asOf')}
                disabled={sending}
              />
              {draft.standings.map((row, index) => (
                <fieldset key={row.uid} className={styles.row}>
                  <legend className={styles.legend}>{formCopy.rowLegend(index + 1)}</legend>
                  <div className={styles.numberFields}>
                    <InputField
                      id={fieldId(fieldIds.row(row.uid, 'position'))}
                      label={formCopy.position}
                      type="number"
                      min={1}
                      max={MAX_ROWS}
                      value={row.position}
                      onChange={(value) => updateRow(row.uid, { position: value })}
                      errors={errorsOf(fieldIds.row(row.uid, 'position'))}
                      disabled={sending}
                    />
                    <SelectField
                      id={fieldId(fieldIds.row(row.uid, 'team'))}
                      label={formCopy.team}
                      value={row.team}
                      onChange={(value) => updateRow(row.uid, { team: value })}
                      options={teamOptions}
                      placeholder={formCopy.chooseTeam}
                      errors={errorsOf(fieldIds.row(row.uid, 'team'))}
                      disabled={sending}
                    />
                    {STANDING_NUMBER_FIELDS.map((field) => (
                      <InputField
                        key={field}
                        id={fieldId(fieldIds.row(row.uid, field))}
                        label={standingLabel[field]}
                        type="number"
                        min={standingBounds[field][0]}
                        max={standingBounds[field][1]}
                        value={row[field]}
                        onChange={(value) => updateRow(row.uid, { [field]: value })}
                        errors={errorsOf(fieldIds.row(row.uid, field))}
                        disabled={sending}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => removeRow(row.uid)}
                    disabled={sending || draft.standings.length <= 1}
                  >
                    {formCopy.removeRow(index + 1)}
                  </button>
                </fieldset>
              ))}
              <button
                id={fieldId(fieldIds.addRow)}
                type="button"
                className={styles.secondaryButton}
                onClick={addRow}
                disabled={sending || draft.standings.length >= MAX_ROWS}
                aria-describedby={
                  errorsOf(fieldIds.addRow).length > 0 ? `${fieldId(fieldIds.addRow)}-error` : undefined
                }
              >
                {formCopy.addRow}
              </button>
              <ListError id={`${fieldId(fieldIds.addRow)}-error`} errors={errorsOf(fieldIds.addRow)} />
            </>
          ) : null}
        </fieldset>

        <InputField
          id={fieldId('declaredSource')}
          label={formCopy.sourceField}
          hint={formCopy.sourceHint}
          value={draft.declaredSource}
          onChange={(value) => update({ declaredSource: value })}
          errors={errorsOf('declaredSource')}
          maxLength={80}
          required={false}
          disabled={sending}
        />

        <button
          id={fieldId(fieldIds.submit)}
          className={styles.button}
          type="submit"
          disabled={sending}
          aria-busy={sending}
          aria-describedby={errorsOf(fieldIds.submit).length > 0 ? `${fieldId(fieldIds.submit)}-error` : undefined}
        >
          {sending ? formCopy.submitting : formCopy.submit}
        </button>
        <ListError id={`${fieldId(fieldIds.submit)}-error`} errors={errorsOf(fieldIds.submit)} />
      </form>
    </section>
  );
}

function ListError({ id, errors }: { id: string; errors: readonly string[] }) {
  if (errors.length === 0) {
    return null;
  }
  return (
    <p id={id} className={styles.fieldError}>
      {errors.join(' ')}
    </p>
  );
}
