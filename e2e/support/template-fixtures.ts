/**
 * A synthetic visual template for the layout checks of the template editor (UI-06.2). A real template starts from an
 * approved design proposal, which needs the paid image provider (PD-27); the suites never call it. These values are
 * served to the browser only (`serveSyntheticTemplate`), through the same-origin API routes the editor reads; nothing
 * is written to the server or to operator storage.
 */
import type { Page } from '@playwright/test';
import type { VisualTemplateDetail, VisualTemplateVersion } from '@edr/contracts';

import { solidPng } from './png.js';

const T = '2026-11-06T12:00:00.000Z';
export const TEMPLATE_ID = '00000000-0000-4000-8000-000000000100';
const VERSION_ID = '00000000-0000-4000-8000-000000000101';
const PROPOSAL_ID = '00000000-0000-4000-8000-000000000001';

const style = {
  fontRole: 'heading',
  maxFontSize: 64,
  minFontSize: 32,
  maxLines: 1,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
} as const;

const detail: VisualTemplateDetail = {
  template: {
    id: TEMPLATE_ID,
    name: 'Previa sintética de prueba',
    description: null,
    category: 'Previas',
    contentType: 'match_preview',
    format: '4:5',
    status: 'draft',
    sourceProposalId: PROPOSAL_ID,
    publishedVersion: null,
    draftVersionId: VERSION_ID,
    versionCount: 1,
    createdAt: T,
    updatedAt: T,
    archivedAt: null,
  },
  versions: [
    { id: VERSION_ID, version: 1, status: 'draft', layerCount: 2, createdAt: T, updatedAt: T, publishedAt: null },
  ],
};

const version: VisualTemplateVersion = {
  id: VERSION_ID,
  templateId: TEMPLATE_ID,
  version: 1,
  status: 'draft',
  revision: 1,
  canvasWidth: 1080,
  canvasHeight: 1350,
  background: {
    source: 'design_proposal',
    id: PROPOSAL_ID,
    label: 'Previa individual · 4:5 · 1/1',
    sha256: 'a'.repeat(64),
    mime: 'image/png',
    width: 1024,
    height: 1280,
  },
  layers: [
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
      style,
    },
    {
      id: 'dato-2',
      type: 'sports_data',
      name: 'Equipo visitante',
      x: 0.55,
      y: 0.4,
      width: 0.4,
      height: 0.1,
      visible: true,
      binding: 'match.awayTeam.name',
      required: true,
      style,
    },
  ],
  bindings: ['match.homeTeam.name', 'match.awayTeam.name'],
  assets: [],
  validation: {
    publishable: false,
    issues: [
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
};

/** Serves the synthetic template, its draft version and its background to `page`. */
export async function serveSyntheticTemplate(page: Page): Promise<void> {
  const background = solidPng(64, 80, [0x2e, 0x11, 0x45]);
  await page.route(`**/api/v1/visual-templates/${TEMPLATE_ID}**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405, json: { code: 'NOT_ALLOWED_IN_TEST' } });
    } else if (pathname.endsWith('/background')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: background });
    } else if (pathname.endsWith(`/versions/${VERSION_ID}`)) {
      await route.fulfill({ json: version });
    } else {
      await route.fulfill({ json: detail });
    }
  });
}
