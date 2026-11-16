/**
 * Test support of the visual templates (PD-ARCH-01G-C): synthetic contract values. Requests go through the fake fetch
 * of the brand feature; no network is used.
 */
import type {
  CompetitionMatch,
  DesignProposal,
  VisualTemplate,
  VisualTemplateDetail,
  VisualTemplateVersion,
} from '@edr/contracts';

import { asset } from '../brand/testSupport';

export const T = '2026-11-06T12:00:00.000Z';

export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

export const TEMPLATE_ID = uuid(0x100);
export const DRAFT_ID = uuid(0x101);
export const PUBLISHED_ID = uuid(0x102);

export function proposal(n: number, values: Partial<DesignProposal> = {}): DesignProposal {
  return {
    id: uuid(n),
    generationId: uuid(70),
    mode: 'guided',
    name: `Previa individual · 4:5 · ${String(n)}/1`,
    contentType: 'match_preview',
    format: '4:5',
    width: 1024,
    height: 1280,
    mime: 'image/png',
    status: 'approved',
    model: 'gpt-image-2.5-flare',
    quality: 'low',
    parentProposalId: null,
    references: [],
    decisionNote: null,
    decidedAt: T,
    createdAt: T,
    ...values,
  };
}

export function template(values: Partial<VisualTemplate> = {}): VisualTemplate {
  return {
    id: TEMPLATE_ID,
    name: 'Previa dorada',
    description: null,
    category: 'Previas',
    contentType: 'match_preview',
    format: '4:5',
    status: 'draft',
    sourceProposalId: uuid(1),
    publishedVersion: null,
    draftVersionId: DRAFT_ID,
    versionCount: 1,
    createdAt: T,
    updatedAt: T,
    archivedAt: null,
    ...values,
  };
}

export const LOGO = asset({
  id: uuid(0xa1),
  kind: 'brand_logo',
  label: 'Logotipo oficial',
  official: true,
  primary: true,
});

export const KETSI = asset({
  id: uuid(0xa2),
  kind: 'mascot',
  label: 'Ketsi oficial',
  official: true,
  primary: true,
});

export const DECORATION = asset({
  id: uuid(0xa3),
  kind: 'decoration',
  label: 'Trazo dorado',
  usagePolicy: 'reusable',
});

export function version(values: Partial<VisualTemplateVersion> = {}): VisualTemplateVersion {
  return {
    id: DRAFT_ID,
    templateId: TEMPLATE_ID,
    version: 1,
    status: 'draft',
    revision: 3,
    canvasWidth: 1080,
    canvasHeight: 1350,
    background: {
      source: 'design_proposal',
      id: uuid(1),
      label: 'Previa individual · 4:5 · 1/1',
      sha256: 'a'.repeat(64),
      mime: 'image/png',
      width: 1024,
      height: 1280,
    },
    layers: [
      {
        id: 'marca-1',
        type: 'brand_asset',
        name: 'Logotipo oficial',
        x: 0.36,
        y: 0.03,
        width: 0.28,
        height: 0.12,
        visible: true,
        assetId: LOGO.id,
      },
      {
        id: 'dato-1',
        type: 'sports_data',
        name: 'Equipo local',
        x: 0.05,
        y: 0.4,
        width: 0.4,
        height: 0.1,
        visible: true,
        binding: 'match.homeTeam.name',
        required: true,
        style: {
          fontRole: 'heading',
          maxFontSize: 64,
          minFontSize: 32,
          maxLines: 1,
          colorRole: 'light',
          align: 'center',
          verticalAlign: 'middle',
          overflow: 'shrink',
        },
      },
    ],
    bindings: ['match.homeTeam.name'],
    assets: [
      {
        assetId: LOGO.id,
        label: LOGO.label,
        kind: 'brand_logo',
        usagePolicy: 'protected',
        official: true,
        sha256: LOGO.sha256,
      },
    ],
    validation: {
      publishable: false,
      issues: [
        {
          code: 'REQUIRED_BINDING_MISSING',
          severity: 'error',
          layerId: null,
          message: 'Falta una capa con el equipo visitante.',
        },
        {
          code: 'LOW_CONTRAST',
          severity: 'warning',
          layerId: 'dato-1',
          message: 'El contraste del texto con el fondo puede ser insuficiente.',
        },
      ],
    },
    createdAt: T,
    updatedAt: T,
    publishedAt: null,
    ...values,
  };
}

export function detail(
  templateValues: Partial<VisualTemplate> = {},
  versions: VisualTemplateDetail['versions'] = [
    { id: DRAFT_ID, version: 1, status: 'draft', layerCount: 2, createdAt: T, updatedAt: T, publishedAt: null },
  ],
): VisualTemplateDetail {
  return { template: template(templateValues), versions };
}

export const COMPETITION = { id: uuid(0xc1), name: 'Liga Sintética', createdAt: T, updatedAt: T };
export const SEASON = { id: uuid(0xc2), competitionId: COMPETITION.id, label: '2026/27', createdAt: T };
export const ROUND = {
  id: uuid(0xc3),
  seasonId: SEASON.id,
  stageId: null,
  name: 'Jornada 9',
  displayOrder: 9,
  createdAt: T,
};

/** A stage of the season and a round inside it (imported calendars put every round in a stage). */
export const STAGE = { id: uuid(0xc5), seasonId: SEASON.id, name: 'Fase regular', displayOrder: 0, createdAt: T };
export const STAGED_ROUND = {
  id: uuid(0xc6),
  seasonId: SEASON.id,
  stageId: STAGE.id,
  name: 'Jornada 10',
  displayOrder: 10,
  createdAt: T,
};

function team(n: number, name: string) {
  return { id: uuid(n), name, displayName: null, region: null, badge: null, createdAt: T, updatedAt: T };
}

export const MATCH: CompetitionMatch = {
  id: uuid(0xc4),
  seasonId: SEASON.id,
  stage: null,
  round: { id: ROUND.id, name: ROUND.name },
  homeTeam: team(0xd1, 'Club Uno'),
  awayTeam: team(0xd2, 'Club Dos'),
  kickoffAt: '2026-11-20T20:00:00Z',
  status: 'scheduled',
  homeScore: null,
  awayScore: null,
  createdAt: T,
  updatedAt: T,
};
