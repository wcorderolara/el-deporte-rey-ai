/**
 * Visual templates in generated projects (PD-ARCH-01G-D): the rendering plans of a project that uses published
 * template versions, one per slide type (decision 01G-D-3: a cover, the match slides, a closing), and the structured
 * document of each slide of a planned type.
 *
 * - A plan holds the pinned version (immutable), the verified bytes of its background and brand assets, the badge of
 *   each team as recorded when the project was created (badge IDs; badge rows and files are never deleted), and the
 *   sports context of the project's generation batch (competition, season, stage, round).
 * - A slide is composed from its stored text (content stage, with fact segments for the QA), the context labels
 *   (template text) and the badges found through the teams' internal identity: the team-name fact of the slide →
 *   its evidence (supporting or consulted, never disagreeing) → the observation of the local source, whose `teamKey`
 *   is the local team ID. A name is
 *   never used to find an image.
 * - The project's badges (`loadProjectBadges`) are read from the same snapshot for the badge slots of the engine
 *   match templates too, when the snapshot covers them (versions 2 and 3, PD-ARCH-01G-E.1), and for the rows of the
 *   round calendars (version 3, PD-ARCH-01G-E.2; `projects/badge-snapshot.ts`). The team of each calendar row is
 *   found the same way, from the team-name fact segments of its line.
 *   A badge is read from its confined file with its hash checked; a file that does not match fails the render, and
 *   nothing is substituted.
 * - TEAM-DISPLAY-01 (PD-37): the presentation names of the project's snapshot (version 4) are drawn wherever an image
 *   shows a team-name fact: the team fields, the home and away names of each calendar row, the standings team cells
 *   and the team placeholders of the headline and the description. The team is found through the same identity
 *   (fact → evidence → local team ID), never by comparing names. The stored text keeps the official names; only the
 *   drawn text changes (`presentedText`).
 * - Nothing here calls an AI provider or the network. This file imports the renderer modules directly (not the
 *   rendering module index) so the rendering stage can use it without an import cycle.
 */
import { createHash } from 'node:crypto';

import {
  type Language,
  type SlideType,
  SlideTypeSchema,
  type TextFieldName,
  type VisualTemplateBadgeBinding,
  type VisualTemplateBinding,
  type VisualTemplateIssue,
  type VisualTemplateLayer,
} from '@edr/contracts';
import { z } from 'zod';

import type { AppContainer } from '../../container.js';
import type { Db } from '../../platform/db/index.js';
import { createBrandAssetService } from '../brand/index.js';
import { teamBadgeServiceOf } from '../competitions/badges/index.js';
import { designServiceOf } from '../design/index.js';
import { parseBadgeSnapshot } from '../projects/badge-snapshot.js';
import type { EmbeddedAsset } from '../rendering/renderer.js';
import {
  type SegmentRun,
  type SlideContent,
  type StoredElementText,
  type StoredSegment,
  runOf,
  segmentsOf,
} from '../rendering/slide-content.js';
import type { StructuredDocument } from '../rendering/structured.js';
import type { AssetRef } from '../rendering/templates/common.js';
import { fixtureRowsOf } from '../rendering/templates/round-overview.js';

import { composeItems } from './compose.js';
import { VisualTemplateRepository } from './repository.js';

/** The rendering plan of a project that uses a visual template. */
export interface ProjectTemplatePlan {
  readonly templateId: string;
  readonly versionId: string;
  readonly version: number;
  /** The slide type the template draws (its content type). */
  readonly slideType: SlideType;
  readonly canvas: { readonly width: number; readonly height: number };
  readonly background: AssetRef;
  readonly layers: readonly VisualTemplateLayer[];
  readonly assets: ReadonlyMap<string, { readonly ref: AssetRef; readonly protectedAsset: boolean }>;
  readonly badges: ReadonlyMap<string, AssetRef | null>;
  readonly context: {
    readonly competitionName: string;
    readonly seasonLabel: string;
    readonly stageName: string | null;
    readonly roundName: string | null;
  };
  /** Every file the plan draws, with its verified bytes. */
  readonly files: readonly EmbeddedAsset[];
}

/** The teams of one match by their local IDs (null when the slide does not show that team or it is not found). */
export interface MatchTeams {
  readonly home: string | null;
  readonly away: string | null;
}

/** The teams of a slide: its match's teams, and the teams of each row of a round calendar (PD-ARCH-01G-E.2). */
export interface SlideTeams extends MatchTeams {
  /** One entry per calendar row, in row order; absent on a slide without a `fixtures` field. */
  readonly rows?: readonly MatchTeams[];
}

/** The badges of a project's snapshot, with their verified files (PD-ARCH-01G-D, PD-ARCH-01G-E.1). */
export interface ProjectBadges {
  /** True when the badge slots of the engine match templates draw these badges (snapshot versions 2 and 3). */
  readonly engineSlots: boolean;
  /** True when the round calendars are drawn as rows with these badges (snapshot version 3, PD-ARCH-01G-E.2). */
  readonly calendarRows: boolean;
  /** The badge of each team of the snapshot by local team ID; null for a team without a badge. */
  readonly teams: ReadonlyMap<string, AssetRef | null>;
  /** Every badge file of the snapshot, each once, with its bytes checked against its recorded hash. */
  readonly files: readonly EmbeddedAsset[];
}

/** A project's template plan as validated stage input (it carries maps and bytes). */
export const ProjectTemplatePlanSchema = z.custom<ProjectTemplatePlan>(
  (value) => typeof value === 'object' && value !== null && 'versionId' in value,
  'expected a visual template plan',
);

const SQL = {
  pins:
    'SELECT slide_type, visual_template_id, visual_template_version_id FROM project_visual_templates ' +
    'WHERE project_id = ? ORDER BY slide_type',
  badges: 'SELECT badge_snapshot_json FROM projects WHERE id = ?',
  context:
    'SELECT b.competition_name, b.season_label, b.stage_name, b.round_name FROM content_generation_items i ' +
    'JOIN content_generation_batches b ON b.id = i.batch_id WHERE i.project_id = ?',
  teamOfFact:
    "SELECT json_extract(o.value, '$.teamKey') AS team_key FROM fact_evidence fe JOIN observations o " +
    "ON o.id = fe.observation_id WHERE fe.fact_id = ? AND fe.relation IN ('supports', 'consulted') AND " +
    "json_extract(o.value, '$.kind') = 'team' ORDER BY o.id LIMIT 1",
} as const;

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/** A file whose bytes do not match the hash the plan pinned. */
export class TemplateFileError extends Error {
  override readonly name = 'TemplateFileError';
}

function verified(ref: AssetRef, content: Buffer): EmbeddedAsset {
  if (sha256(content) !== ref.sha256) {
    throw new TemplateFileError('a template file does not match its pinned hash');
  }
  return { ...ref, content };
}

/**
 * The badges of a project's snapshot with their verified files (see the module notes): by the teams' local IDs, as
 * recorded when the project was created. A badge replaced or retired since then is still the one drawn. A project
 * without a snapshot has no badge, and `engineSlots` is false for it and for a version 1 snapshot (decision DE-E3).
 */
export async function loadProjectBadges(container: AppContainer, projectId: string): Promise<ProjectBadges> {
  const row = container.db.prepare<{ badge_snapshot_json: string | null }>(SQL.badges).get([projectId]);
  const snapshot = parseBadgeSnapshot(row?.badge_snapshot_json);
  const badgeService = teamBadgeServiceOf(container);
  const files: EmbeddedAsset[] = [];
  const teams = new Map<string, AssetRef | null>();
  for (const [teamId, badgeId] of Object.entries(snapshot.teams)) {
    const record = badgeId === null ? null : badgeService.badge(badgeId);
    if (record === null) {
      teams.set(teamId, null);
      continue;
    }
    const ref: AssetRef = { id: record.id, sha256: record.sha256, mime: record.mime };
    if (!files.some((file) => file.id === ref.id)) {
      files.push(verified(ref, await badgeService.read(record)));
    }
    teams.set(teamId, ref);
  }
  return { engineSlots: snapshot.engineSlots, calendarRows: snapshot.calendarRows, teams, files };
}

/**
 * The presentation names of a project's snapshot (TEAM-DISPLAY-01) by local team ID: empty for a project created
 * before snapshot version 4 or without a snapshot, so those projects keep drawing the official names.
 */
export function loadProjectDisplayNames(db: Db, projectId: string): ReadonlyMap<string, string> {
  const row = db.prepare<{ badge_snapshot_json: string | null }>(SQL.badges).get([projectId]);
  return new Map(Object.entries(parseBadgeSnapshot(row?.badge_snapshot_json).displayNames));
}

/** The fact IDs of every fact segment of a slide's text, each once. */
function factIdsOf(texts: Iterable<StoredElementText>): Set<string> {
  const ids = new Set<string>();
  for (const text of texts) {
    for (const field of text.fields) {
      for (const segment of field.segments) {
        if (segment.provenance === 'fact' && segment.factId !== null) {
          ids.add(segment.factId);
        }
      }
    }
  }
  return ids;
}

/**
 * The presentation name to draw for each team-name fact of the given slides (TEAM-DISPLAY-01), by fact ID: the
 * snapshot name of the fact's local team, found through its evidence. Only a team-name fact has a team (its evidence
 * is a team observation), so no other fact is ever listed; a fact whose team has no snapshot name is left out, so it
 * is drawn with the official name.
 */
export function displayNamesOfSlides(
  db: Db,
  texts: Iterable<StoredElementText>,
  names: ReadonlyMap<string, string>,
): Record<string, string> {
  return names.size === 0 ? {} : displayNamesOfFacts(db, factIdsOf(texts), names);
}

/**
 * The presentation name of each given team-name fact (TEAM-DISPLAY-01), by fact ID, for the visual QA: the snapshot
 * name of the fact's local team. A fact whose team has none is left out.
 */
export function displayNamesOfFacts(
  db: Db,
  factIds: Iterable<string>,
  names: ReadonlyMap<string, string>,
): Record<string, string> {
  const byFact: Record<string, string> = {};
  if (names.size === 0) {
    return byFact;
  }
  for (const factId of factIds) {
    const teamId = teamOfFact(db, factId);
    const name = teamId === null ? undefined : names.get(teamId);
    if (name !== undefined) byFact[factId] = name;
  }
  return byFact;
}

/**
 * The text a slide is drawn with (TEAM-DISPLAY-01): the stored text with every fact segment of a team-name fact that
 * has a presentation name drawn with that name, keeping the fact ID and provenance. That covers the team fields, the
 * home and away names of the calendar rows, the standings team cells, and the team names the AI text holds as
 * `{{t:<teamId>}}` placeholders (fact segments of the headline and the description). Commentary, template text and
 * every other fact are drawn as stored: the swap goes by fact, never by comparing text.
 * With no name the stored text itself is returned.
 */
export function presentedText(text: StoredElementText, byFact: Readonly<Record<string, string>>): StoredElementText {
  if (Object.keys(byFact).length === 0) {
    return text;
  }
  const swap = (segment: StoredSegment): StoredSegment => {
    const name = segment.provenance === 'fact' && segment.factId !== null ? byFact[segment.factId] : undefined;
    return name === undefined ? segment : { ...segment, text: name };
  };
  return { ...text, fields: text.fields.map((field) => ({ ...field, segments: field.segments.map(swap) })) };
}

function sideOf(badges: ProjectBadges, teamId: string | null): { teamId: string | null; badge: AssetRef | null } {
  return { teamId, badge: teamId === null ? null : (badges.teams.get(teamId) ?? null) };
}

/**
 * The teams and badges of an engine match slide (`SlideContent.badges`; PD-ARCH-01G-E.1): each side's team by its
 * local identity and that team's snapshot badge. Undefined when the project's badges do not cover the engine
 * templates (decision DE-E3), so the slots stay empty and record no team.
 */
export function engineSlideBadges(badges: ProjectBadges, teams: MatchTeams): SlideContent['badges'] {
  if (!badges.engineSlots) {
    return undefined;
  }
  return { home: sideOf(badges, teams.home), away: sideOf(badges, teams.away) };
}

/**
 * The teams and badges of each row of an engine round calendar slide (`SlideContent.rowBadges`; PD-ARCH-01G-E.2).
 * Undefined when the project's badges do not cover the calendar rows (decision DE-E3) or the slide has no rows, so
 * the calendar keeps its earlier template.
 */
export function engineRowBadges(badges: ProjectBadges, teams: SlideTeams): SlideContent['rowBadges'] {
  if (!badges.calendarRows || teams.rows === undefined) {
    return undefined;
  }
  return teams.rows.map((row) => ({ home: sideOf(badges, row.home), away: sideOf(badges, row.away) }));
}

/**
 * The template plans of a project, one per slide type with a pinned version; empty for a project without a visual
 * template (see the module notes). The plans draw the project's badges (`loadProjectBadges`), whichever the version
 * of its snapshot.
 */
export async function loadProjectTemplatePlans(
  container: AppContainer,
  projectId: string,
  projectBadges?: ProjectBadges,
): Promise<ProjectTemplatePlan[]> {
  const { db } = container;
  const pins = db
    .prepare<{ slide_type: string; visual_template_id: string; visual_template_version_id: string }>(SQL.pins)
    .all([projectId]);
  if (pins.length === 0) {
    return [];
  }
  const brand = createBrandAssetService(container);
  const { teams: badges, files: badgeFiles } = projectBadges ?? (await loadProjectBadges(container, projectId));
  const context = db
    .prepare<{ competition_name: string; season_label: string; stage_name: string | null; round_name: string }>(
      SQL.context,
    )
    .get([projectId]);

  const repository = new VisualTemplateRepository(db);
  const plans: ProjectTemplatePlan[] = [];
  for (const pin of pins) {
    const template = repository.template(pin.visual_template_id);
    const version = repository.version(pin.visual_template_id, pin.visual_template_version_id);
    if (template === null || version === null || version.status !== 'published') {
      throw new TemplateFileError('a visual template version of the project is not a published version');
    }
    const files: EmbeddedAsset[] = [...badgeFiles];
    const background: AssetRef = {
      id: version.background.id,
      sha256: version.background.sha256,
      mime: version.background.mime,
    };
    const backgroundBytes =
      version.background.source === 'design_proposal'
        ? (await designServiceOf(container).readFile(version.background.id, 'background')).content
        : (await brand.readFile(version.background.id)).content;
    files.push(verified(background, backgroundBytes));
    const assets = new Map<string, { ref: AssetRef; protectedAsset: boolean }>();
    for (const pinned of version.assets) {
      const file = await brand.readFile(pinned.assetId);
      if (file.asset.mime !== 'image/png' && file.asset.mime !== 'image/jpeg') {
        continue;
      }
      const ref: AssetRef = { id: pinned.assetId, sha256: pinned.sha256, mime: file.asset.mime };
      files.push(verified(ref, file.content));
      assets.set(pinned.assetId, { ref, protectedAsset: pinned.usagePolicy === 'protected' });
    }
    plans.push({
      templateId: template.id,
      versionId: version.id,
      version: version.version,
      slideType: SlideTypeSchema.parse(pin.slide_type),
      canvas: { width: version.canvasWidth, height: version.canvasHeight },
      background,
      layers: version.layers,
      assets,
      badges,
      context: {
        competitionName: context?.competition_name ?? '',
        seasonLabel: context?.season_label ?? '',
        stageName: context?.stage_name ?? null,
        roundName: context?.round_name ?? null,
      },
      files,
    });
  }
  return plans;
}

/** The plan that draws a slide type, if the project pinned one. */
export function planOf(plans: readonly ProjectTemplatePlan[], slideType: string): ProjectTemplatePlan | null {
  return plans.find((plan) => plan.slideType === slideType) ?? null;
}

/** The local team of a team-name fact, through its evidence (null when it cannot be found). */
function teamOfFact(db: Db, factId: string | null): string | null {
  if (factId === null) {
    return null;
  }
  const key = db.prepare<{ team_key: string | null }>(SQL.teamOfFact).get([factId])?.team_key ?? null;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/** The local team of a team-name field of a slide (null when it cannot be found). */
function teamOfField(db: Db, text: StoredElementText, field: TextFieldName): string | null {
  return teamOfFact(db, segmentsOf(text, field).find((segment) => segment.factId !== null)?.factId ?? null);
}

/**
 * The teams of a slide by their local IDs (see the module notes); a slide with a `fixtures` field also has the teams
 * of each calendar row, from the home and away name segments of its line (rendering `fixtureRowsOf`).
 */
export function slideTeams(db: Db, text: StoredElementText): SlideTeams {
  const teams = { home: teamOfField(db, text, 'team_home'), away: teamOfField(db, text, 'team_away') };
  const fixtures = segmentsOf(text, 'fixtures');
  if (fixtures.length === 0) {
    return teams;
  }
  const rows = fixtureRowsOf(fixtures).map((row) => ({
    home: teamOfFact(db, row.home?.factId ?? null),
    away: teamOfFact(db, row.away?.factId ?? null),
  }));
  return { ...teams, rows };
}

/** The slide field that stores each binding's value in a project; null for the context labels. */
const SLIDE_FIELD: Readonly<Record<VisualTemplateBinding, TextFieldName | null>> = Object.freeze({
  'competition.name': null,
  'season.label': null,
  'stage.name': null,
  'round.name': null,
  'match.homeTeam.name': 'team_home',
  'match.awayTeam.name': 'team_away',
  'match.kickoffDate': 'kickoff',
  'match.kickoffTime': 'kickoff_time',
  'match.status': 'match_status',
  'match.score': 'score',
  'match.homeScore': 'score_home',
  'match.awayScore': 'score_away',
  'round.fixtures': 'fixtures',
});

function contextRun(text: string | null): SegmentRun | null {
  return text === null || text === '' ? null : { text, factIds: [], provenance: 'template_text' };
}

/**
 * The structured document of a slide of the template's type, and the issues of its composition (a missing required
 * value is an error; a team without a badge is a warning).
 */
export function projectSlideDocument(
  plan: ProjectTemplatePlan,
  slide: { readonly text: StoredElementText; readonly teams: SlideTeams },
  language: Language,
  canvas: { readonly width: number; readonly height: number },
): { document: StructuredDocument; issues: VisualTemplateIssue[] } {
  const { context } = plan;
  const badgeOfTeam = (teamId: string | null): AssetRef | null =>
    teamId === null ? null : (plan.badges.get(teamId) ?? null);
  const badgeOf = (binding: VisualTemplateBadgeBinding): AssetRef | null =>
    badgeOfTeam(binding === 'match.homeTeam.badge' ? slide.teams.home : slide.teams.away);
  const runOfSegment = (segment: StoredSegment | null): SegmentRun | null =>
    segment === null ? null : runOf([segment]);
  const { items, issues } = composeItems(
    { background: plan.background, layers: plan.layers },
    {
      text: (binding) => {
        switch (binding) {
          case 'competition.name':
            return contextRun(context.competitionName);
          case 'season.label':
            return contextRun(context.seasonLabel);
          case 'stage.name':
            return contextRun(context.stageName);
          case 'round.name':
            return contextRun(context.roundName);
          default: {
            const field = SLIDE_FIELD[binding];
            const segments = field === null ? [] : segmentsOf(slide.text, field);
            return segments.length === 0 ? null : runOf(segments);
          }
        }
      },
      badge: badgeOf,
      asset: (assetId) => plan.assets.get(assetId) ?? null,
      // PD-ARCH-01G-E.2: the matches of a calendar page from its stored lines, each team's badge by its identity.
      rows: () =>
        fixtureRowsOf(segmentsOf(slide.text, 'fixtures')).map((row, index) => ({
          homeName: runOfSegment(row.home),
          awayName: runOfSegment(row.away),
          kickoffDate: runOfSegment(row.date),
          kickoffTime: runOfSegment(row.time),
          status: runOfSegment(row.status),
          homeBadge: badgeOfTeam(slide.teams.rows?.[index]?.home ?? null),
          awayBadge: badgeOfTeam(slide.teams.rows?.[index]?.away ?? null),
        })),
    },
  );
  return {
    document: {
      templateId: `vt-${plan.templateId}`,
      templateVersion: String(plan.version),
      slideType: plan.slideType,
      language,
      designCanvas: plan.canvas,
      canvas,
      items,
    },
    issues,
  };
}
