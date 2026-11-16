/**
 * The items of a visual template version for one set of values (PD-ARCH-01G-C and 01G-D): the background, then every
 * visible layer in stacking order. The same composition serves the preview with local data and the slides of a
 * project, so what is previewed is what is rendered.
 *
 * - Text values come from a source: the local Competiciones data (preview) or the stored text of a slide with its fact
 *   segments (project). A missing value leaves its layer out and is reported (an error when the layer is required).
 * - Brand assets are the pinned files of the version; a team badge is the badge of the team found by its internal
 *   identity (never its name). Both are drawn only scaled proportionally (`contain`), from their original files.
 * - A team without a badge leaves its layer out with a warning (PD-ARCH-01G-D: the design keeps the name visible).
 * - A match list (PD-ARCH-01G-E.2) draws its row once per match of the source, top to bottom (`fixture-list.ts`): the
 *   badges and values of each match, each value its own text element so visual QA compares every row with its facts.
 *   A row without a team name is an error; a team without a badge leaves that badge out with a warning; the status is
 *   drawn only when the match has one to show (not scheduled). More matches than rows is an error, never a dropped
 *   row.
 */
import {
  VISUAL_TEMPLATE_FIXTURE_LIST_ROWS,
  type VisualTemplateBadgeBinding,
  type VisualTemplateBinding,
  type VisualTemplateIssue,
  type VisualTemplateLayer,
} from '@edr/contracts';

import type { AssetRef, SegmentRun, StructuredItem } from '../rendering/index.js';

import { BINDING_ELEMENT } from './catalog.js';
import { FIXTURE_ROW_BADGE_PARTS, FIXTURE_ROW_TEXT_PARTS, partBox, rowBox } from './fixture-list.js';
import { issueOf } from './issues.js';

/** One match of a match list: its values (null when it has none) and the badge of each team (null without one). */
export interface ComposeRow {
  readonly homeName: SegmentRun | null;
  readonly awayName: SegmentRun | null;
  readonly kickoffDate: SegmentRun | null;
  readonly kickoffTime: SegmentRun | null;
  readonly status: SegmentRun | null;
  readonly homeBadge: AssetRef | null;
  readonly awayBadge: AssetRef | null;
}

/** Where the values of a composition come from. */
export interface ComposeSource {
  /** The run of a text binding (its text, fact IDs and provenance), or null when the data has no value. */
  text(binding: VisualTemplateBinding): SegmentRun | null;
  /** The badge image of a badge binding, or null when the team has none. */
  badge(binding: VisualTemplateBadgeBinding): AssetRef | null;
  /**
   * The brand asset a layer places, or null when it cannot be drawn; `protectedAsset` is true for a `protected` asset
   * (only proportional scaling).
   */
  asset(assetId: string): { readonly ref: AssetRef; readonly protectedAsset: boolean } | null;
  /** The matches a match list draws, in row order (PD-ARCH-01G-E.2); empty when the data has none. */
  rows(): readonly ComposeRow[];
}

/** The items and issues of a match list (see the module notes). */
function composeFixtureList(
  layer: Extract<VisualTemplateLayer, { type: 'fixture_list' }>,
  rows: readonly ComposeRow[],
  items: StructuredItem[],
  issues: VisualTemplateIssue[],
): void {
  const id = `layer-${layer.id}`;
  if (rows.length === 0) {
    issues.push(issueOf('VALUE_MISSING', 'error', layer.id, '(round.fixtures)'));
    return;
  }
  if (rows.length > VISUAL_TEMPLATE_FIXTURE_LIST_ROWS) {
    issues.push(
      issueOf(
        'TEXT_OVERFLOW',
        'error',
        layer.id,
        `(${String(rows.length)} partidos; caben ${String(VISUAL_TEMPLATE_FIXTURE_LIST_ROWS)}.)`,
      ),
    );
    return;
  }
  rows.forEach((row, index) => {
    const n = index + 1;
    const box = rowBox(layer, index);
    for (const part of ['homeBadge', 'awayBadge'] as const) {
      const spec = layer.row[part];
      if (!spec.visible) {
        continue;
      }
      const badge = row[part];
      if (badge === null) {
        issues.push(
          issueOf(
            'VALUE_MISSING',
            'warning',
            layer.id,
            `(sin escudo: partido ${String(n)}, ${FIXTURE_ROW_BADGE_PARTS[part].label})`,
          ),
        );
        continue;
      }
      const suffix = part === 'homeBadge' ? 'home-badge' : 'away-badge';
      items.push({
        kind: 'image',
        id: `${id}-r${String(n)}-${suffix}`,
        slot: 'layer',
        box: partBox(box, spec),
        asset: badge,
        fit: 'contain',
      });
    }
    for (const part of ['homeName', 'kickoffDate', 'kickoffTime', 'status', 'awayName'] as const) {
      const spec = layer.row[part];
      if (!spec.visible) {
        continue;
      }
      const run = row[part];
      if (run === null || run.text.trim() === '') {
        if (part !== 'status') {
          // A status is shown only for a match that is not scheduled; any other missing value is reported.
          const name = part === 'homeName' || part === 'awayName';
          issues.push(
            issueOf(
              'VALUE_MISSING',
              name ? 'error' : 'warning',
              layer.id,
              `(partido ${String(n)}, ${FIXTURE_ROW_TEXT_PARTS[part].label})`,
            ),
          );
        }
        continue;
      }
      items.push({
        kind: 'text',
        id: `${id}-r${String(n)}-${part === 'homeName' ? 'home' : part === 'awayName' ? 'away' : part === 'kickoffDate' ? 'date' : part === 'kickoffTime' ? 'time' : 'status'}`,
        field: 'fixtures',
        semantic: FIXTURE_ROW_TEXT_PARTS[part].semantic,
        box: partBox(box, spec),
        style: spec.style,
        run,
      });
    }
  });
}

export interface Composition {
  readonly items: StructuredItem[];
  readonly issues: VisualTemplateIssue[];
}

/** Composes a version's items over its background (see the module notes). */
export function composeItems(
  version: { readonly background: AssetRef; readonly layers: readonly VisualTemplateLayer[] },
  source: ComposeSource,
): Composition {
  const issues: VisualTemplateIssue[] = [];
  const items: StructuredItem[] = [
    {
      kind: 'image',
      id: 'background',
      slot: 'background',
      box: { x: 0, y: 0, width: 1, height: 1 },
      asset: version.background,
      fit: 'cover',
    },
  ];
  for (const layer of version.layers) {
    if (!layer.visible) {
      continue;
    }
    const id = `layer-${layer.id}`;
    switch (layer.type) {
      case 'image':
      case 'brand_asset': {
        const asset = source.asset(layer.assetId);
        if (asset === null) {
          issues.push(issueOf('ASSET_MISSING', 'error', layer.id));
          break;
        }
        // A protected asset, and every logo or mascot, is only scaled proportionally from its original file.
        items.push({
          kind: 'image',
          id,
          slot: 'layer',
          box: layer,
          asset: asset.ref,
          fit: layer.type === 'image' && !asset.protectedAsset ? layer.fit : 'contain',
        });
        break;
      }
      case 'team_badge': {
        const badge = source.badge(layer.binding);
        if (badge === null) {
          issues.push(issueOf('VALUE_MISSING', 'warning', layer.id, '(sin escudo)'));
          break;
        }
        items.push({ kind: 'image', id, slot: 'layer', box: layer, asset: badge, fit: 'contain' });
        break;
      }
      case 'text':
        items.push({
          kind: 'text',
          id,
          field: 'title',
          semantic: 'title',
          box: layer,
          style: layer.style,
          run: { text: layer.text, factIds: [], provenance: 'template_text' },
        });
        break;
      case 'fixture_list':
        composeFixtureList(layer, source.rows(), items, issues);
        break;
      case 'sports_data': {
        if (layer.binding === null) {
          issues.push(issueOf('BINDING_MISSING', 'error', layer.id));
          break;
        }
        const run = source.text(layer.binding);
        if (run === null || run.text.trim() === '') {
          issues.push(issueOf('VALUE_MISSING', layer.required ? 'error' : 'warning', layer.id, `(${layer.binding})`));
          break;
        }
        const element = BINDING_ELEMENT[layer.binding];
        items.push({
          kind: 'text',
          id,
          field: element.field,
          semantic: element.semantic,
          box: layer,
          style: layer.style,
          run,
        });
        break;
      }
    }
  }
  return { items, issues };
}
