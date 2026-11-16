/**
 * The geometry and parts of a match list (`fixture_list` layer, PD-ARCH-01G-E.2): the layer box is the first row, the
 * other rows follow below it at `height + rowGap`, up to `VISUAL_TEMPLATE_FIXTURE_LIST_ROWS` rows, and each part of a
 * row is a box in fractions of the row. Shared by the validation and the composition, so what is validated is what is
 * drawn. No dependency on the renderer.
 */
import {
  VISUAL_TEMPLATE_FIXTURE_LIST_ROWS,
  type VisualTemplateBinding,
  type VisualTemplateFixtureListLayer,
  type VisualTemplateFixtureRowPart,
  type VisualTemplateLayer,
} from '@edr/contracts';

/** A box in fractions of the canvas. */
export interface Fractions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The text parts of a row, with what they show: the render-model semantic and the catalogue value of its kind. */
export const FIXTURE_ROW_TEXT_PARTS = Object.freeze({
  homeName: { semantic: 'team_name', binding: 'match.homeTeam.name', label: 'nombre local' },
  kickoffDate: { semantic: 'kickoff', binding: 'match.kickoffDate', label: 'fecha' },
  kickoffTime: { semantic: 'kickoff_time', binding: 'match.kickoffTime', label: 'hora' },
  status: { semantic: 'match_status', binding: 'match.status', label: 'estado' },
  awayName: { semantic: 'team_name', binding: 'match.awayTeam.name', label: 'nombre visitante' },
} as const satisfies Partial<
  Record<VisualTemplateFixtureRowPart, { semantic: string; binding: VisualTemplateBinding; label: string }>
>);

export type FixtureRowTextPart = keyof typeof FIXTURE_ROW_TEXT_PARTS;

/** The badge parts of a row. */
export const FIXTURE_ROW_BADGE_PARTS = Object.freeze({
  homeBadge: { label: 'escudo local' },
  awayBadge: { label: 'escudo visitante' },
} as const);

export type FixtureRowBadgePart = keyof typeof FIXTURE_ROW_BADGE_PARTS;

/** The box of row `index` (0 for the first row). */
export function rowBox(layer: VisualTemplateFixtureListLayer, index: number): Fractions {
  return { x: layer.x, y: layer.y + index * (layer.height + layer.rowGap), width: layer.width, height: layer.height };
}

/** The box of every row of the list together. */
export function listArea(layer: VisualTemplateFixtureListLayer): Fractions {
  const rows = VISUAL_TEMPLATE_FIXTURE_LIST_ROWS;
  return { x: layer.x, y: layer.y, width: layer.width, height: rows * layer.height + (rows - 1) * layer.rowGap };
}

/** The box a layer covers on the canvas: every row of a match list, the layer box otherwise. */
export function layerArea(layer: VisualTemplateLayer): Fractions {
  return layer.type === 'fixture_list' ? listArea(layer) : layer;
}

/** The canvas box of a part inside a row. */
export function partBox(row: Fractions, part: Fractions): Fractions {
  return {
    x: row.x + part.x * row.width,
    y: row.y + part.y * row.height,
    width: part.width * row.width,
    height: part.height * row.height,
  };
}
