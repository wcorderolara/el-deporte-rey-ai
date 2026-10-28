/**
 * Parity of the stored element text between the content stage (T32, `ElementTextSchema`, the writer) and the
 * rendering module (`StoredElementTextSchema`, the reader's closed copy), and the standings row shape that
 * `standingsRowsOf` reads from the content stage's `standingRowCells` output.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ElementTextSchema, standingRowCells } from '../content/index.js';

import { StoredElementTextSchema, standingsRowsOf } from './slide-content.js';
import {
  closingText,
  coverText,
  matchText,
  MATCH_A,
  SELECTION_A,
  standingsRows,
  standingsText,
  uuid,
} from './test/support.js';

describe('stored element text parity (T32 writer, T34 reader)', () => {
  it('has the same JSON schema in both modules', () => {
    expect(z.toJSONSchema(StoredElementTextSchema, { unrepresentable: 'any' })).toEqual(
      z.toJSONSchema(ElementTextSchema, { unrepresentable: 'any' }),
    );
  });

  it('accepts and refuses the same documents', () => {
    const accepted: unknown[] = [
      coverText(SELECTION_A, '1/2'),
      matchText(MATCH_A),
      standingsText(standingsRows(3)),
      closingText(),
      { version: 1, fields: [] },
    ];
    const refused: unknown[] = [
      { version: 2, fields: [] },
      { version: 1, fields: [{ field: 'unknown_field', segments: [] }] },
      { version: 1, fields: [{ field: 'title', segments: [{ provenance: 'fact', text: '2-1', factId: null }] }] },
      {
        version: 1,
        fields: [{ field: 'title', segments: [{ provenance: 'commentary', text: 'x', factId: uuid(1) }] }],
      },
      { version: 1, fields: [{ field: 'title', segments: [{ provenance: 'template_text', text: 'x' }] }] },
      { version: 1, fields: [], extra: true },
      {
        version: 1,
        fields: [{ field: 'title', segments: [{ provenance: 'template_text', text: 'x'.repeat(2201), factId: null }] }],
      },
    ];
    for (const document of accepted) {
      expect(ElementTextSchema.safeParse(document).success).toBe(true);
      expect(StoredElementTextSchema.safeParse(document).success).toBe(true);
    }
    for (const document of refused) {
      expect(ElementTextSchema.safeParse(document).success).toBe(false);
      expect(StoredElementTextSchema.safeParse(document).success).toBe(false);
    }
  });

  it('reads the standings cells in the order the content stage writes them', () => {
    const value = {
      position: 3,
      teamId: 'equipo-tres',
      played: 10,
      won: 6,
      drawn: 2,
      lost: 2,
      goalsFor: 18,
      goalsAgainst: 9,
      goalDifference: 9,
      points: 20,
    };
    const cells = standingRowCells(value);
    const [row] = standingsRowsOf([
      { provenance: 'fact', text: cells.join(' '), factId: uuid(1) },
      { provenance: 'fact', text: 'Equipo Tres', factId: uuid(2) },
    ]);
    expect(row?.cells).toEqual(['3', '10', '6', '2', '2', '18', '9', '9', '20']);
    expect([row?.team, row?.cellsFactId, row?.teamFactId]).toEqual(['Equipo Tres', uuid(1), uuid(2)]);
  });
});
