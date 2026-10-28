/**
 * Standings template (architecture.md section 9; R-285): the fixed title, the per-language column headings, every
 * row given to it (the content stage splits the table per slide; no table size is assumed), the "as of" text and the
 * AI headline and description.
 *
 * Rows come from the stored `standings` field (one fact segment with the nine cells, one with the team name, per
 * row). The row height shares the table area between the rows given, down to a minimum; rows that cannot fit at the
 * smallest size are drawn with `overflow` set, so visual QA blocks the slide rather than dropping a row.
 */
import { formatDate, templateText } from '../../../platform/format/index.js';
import { runOf, segmentsOf, standingsRowsOf } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition, templateRun } from './common.js';
import { aiFields } from './shared.js';

/** Top and height of the rows area in the reference layout. */
const ROWS_TOP = 362;
const ROWS_HEIGHT = 690;
/** Largest and smallest row heights in the reference layout. */
const MAX_ROW_HEIGHT = 60;
const MIN_ROW_HEIGHT = 16;

/** Columns after the team: played, won, drawn, lost, goals for, goals against, goal difference, points. */
const NUMBER_COLUMNS_LEFT = 530;
const NUMBER_COLUMN_WIDTH = 63;

export const standingsTemplate: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'standings',
  version: '1.0.0',
  slideType: 'standings',
  label: 'Tabla de posiciones',
  imageSlots: Object.freeze(['brand_logo'] as const),
  badgeSlots: Object.freeze([]),
  build(content, ctx) {
    const model = new ModelBuilder(standingsTemplate, content, ctx);
    const text = templateText(content.language);
    model.chrome();
    model.text({
      id: 'title',
      field: 'title',
      semantic: 'title',
      x: 60,
      y: 218,
      width: 960,
      height: 80,
      role: 'heading',
      maxSize: 56,
      minSize: 32,
      maxLines: 1,
      colorRole: 'light',
      run: runOf(segmentsOf(content.text, 'title')),
    });

    const columns = text.standingsColumns;
    const numberHeadings = [
      columns.played,
      columns.won,
      columns.drawn,
      columns.lost,
      columns.goalsFor,
      columns.goalsAgainst,
      columns.goalDifference,
      columns.points,
    ];
    const heading = (id: string, label: string, x: number, width: number, align: 'left' | 'center') => {
      model.text({
        id,
        field: 'standings',
        semantic: 'standings_heading',
        x,
        y: 310,
        width,
        height: 44,
        role: 'numeric',
        maxSize: 26,
        minSize: 14,
        maxLines: 1,
        colorRole: 'accent',
        align,
        run: templateRun(label),
      });
    };
    heading('heading-position', columns.position, 40, 70, 'center');
    heading('heading-team', columns.team, 124, 396, 'left');
    numberHeadings.forEach((label, index) => {
      heading(`heading-c${String(index + 1)}`, label, NUMBER_COLUMNS_LEFT + index * NUMBER_COLUMN_WIDTH, 63, 'center');
    });

    const rows = standingsRowsOf(segmentsOf(content.text, 'standings'));
    const rowHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, ROWS_HEIGHT / Math.max(1, rows.length)));
    const maxSize = Math.min(32, rowHeight * 0.6);
    const minSize = Math.min(14, maxSize);
    // Rows beyond the table area (more rows than fit at the minimum row height) are flagged, never dropped.
    const lastRowInside = Math.floor(ROWS_HEIGHT / rowHeight + 1e-9);
    rows.forEach((row, index) => {
      const y = ROWS_TOP + index * rowHeight;
      const id = `row-${String(index + 1)}`;
      if (index % 2 === 0) {
        model.rect(`${id}-band`, 30, y, 1020, rowHeight, 'primary');
      }
      const cell = (
        cellId: string,
        value: string,
        factId: string | null,
        semantic: 'standings_position' | 'standings_cell' | 'team_name',
        x: number,
        width: number,
        align: 'left' | 'center',
      ) => {
        model.text({
          id: `${id}-${cellId}`,
          field: 'standings',
          semantic,
          x,
          y,
          width,
          height: rowHeight,
          role: semantic === 'team_name' ? 'body' : 'numeric',
          maxSize,
          minSize,
          maxLines: 1,
          colorRole: semantic === 'standings_position' ? 'accent' : 'light',
          align,
          forceOverflow: index >= lastRowInside,
          run: { text: value, factIds: factId === null ? [] : [factId], provenance: 'fact' },
        });
      };
      const [position = '', ...numbers] = row.cells;
      cell('position', position, row.cellsFactId, 'standings_position', 40, 70, 'center');
      cell('team', row.team, row.teamFactId, 'team_name', 124, 396, 'left');
      numbers.forEach((value, column) => {
        cell(
          `c${String(column + 1)}`,
          value,
          row.cellsFactId,
          'standings_cell',
          NUMBER_COLUMNS_LEFT + column * NUMBER_COLUMN_WIDTH,
          NUMBER_COLUMN_WIDTH,
          'center',
        );
      });
    });

    if (content.standingsAsOf !== null) {
      model.text({
        id: 'as-of',
        field: 'footer',
        semantic: 'as_of',
        x: 60,
        y: 1058,
        width: 960,
        height: 44,
        role: 'body',
        maxSize: 28,
        minSize: 18,
        maxLines: 1,
        colorRole: 'accent',
        run: templateRun(
          `${text.standingsAsOf} ${formatDate(content.standingsAsOf, content.language, ctx.utcOffsetMinutes)}`,
        ),
      });
    }
    aiFields(model, content, {
      headline: { y: 1108, height: 100, maxSize: 40, minSize: 24, maxLines: 2 },
      description: { y: 1212, height: 114, maxSize: 28, minSize: 20, maxLines: 3 },
    });
    return model.build();
  },
});
