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
 *   match templates too, when the snapshot covers them (version 2, PD-ARCH-01G-E.1; `projects/badge-snapshot.ts`).
 *   A badge is read from its confined file with its hash checked; a file that does not match fails the render, and
 *   nothing is substituted.
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
  runOf,
  segmentsOf,
} from '../rendering/slide-content.js';
import type { StructuredDocument } from '../rendering/structured.js';
import type { AssetRef } from '../rendering/templates/common.js';

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

/** The teams of a slide by their local IDs (null when the slide does not show that team). */
export interface SlideTeams {
  readonly home: string | null;
  readonly away: string | null;
}

/** The badges of a project's snapshot, with their verified files (PD-ARCH-01G-D, PD-ARCH-01G-E.1). */
export interface ProjectBadges {
  /** True when the badge slots of the engine match templates draw these badges (snapshot version 2). */
  readonly engineSlots: boolean;
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
  return { engineSlots: snapshot.engineSlots, teams, files };
}

/**
 * The teams and badges of an engine match slide (`SlideContent.badges`; PD-ARCH-01G-E.1): each side's team by its
 * local identity and that team's snapshot badge. Undefined when the project's badges do not cover the engine
 * templates (decision DE-E3), so the slots stay empty and record no team.
 */
export function engineSlideBadges(badges: ProjectBadges, teams: SlideTeams): SlideContent['badges'] {
  if (!badges.engineSlots) {
    return undefined;
  }
  const side = (teamId: string | null) => ({
    teamId,
    badge: teamId === null ? null : (badges.teams.get(teamId) ?? null),
  });
  return { home: side(teams.home), away: side(teams.away) };
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

/** The local team of a team-name field of a slide, through its fact's evidence (null when it cannot be found). */
function teamOfField(db: Db, text: StoredElementText, field: TextFieldName): string | null {
  const factId = segmentsOf(text, field).find((segment) => segment.factId !== null)?.factId ?? null;
  if (factId === null) {
    return null;
  }
  const key = db.prepare<{ team_key: string | null }>(SQL.teamOfFact).get([factId])?.team_key ?? null;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/** The teams of a slide by their local IDs (see the module notes). */
export function slideTeams(db: Db, text: StoredElementText): SlideTeams {
  return { home: teamOfField(db, text, 'team_home'), away: teamOfField(db, text, 'team_away') };
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
  const badgeOf = (binding: VisualTemplateBadgeBinding): AssetRef | null => {
    const teamId = binding === 'match.homeTeam.badge' ? slide.teams.home : slide.teams.away;
    return teamId === null ? null : (plan.badges.get(teamId) ?? null);
  };
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
