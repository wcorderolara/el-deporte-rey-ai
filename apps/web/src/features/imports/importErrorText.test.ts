/**
 * Localized import error texts (OD-63 F-1, F-2; R-061, R-274, R-416): record kinds, every `problem` value in Spanish
 * and English with and without a field, and the rendered table (text only, server message never shown).
 */
import { ImportProblemSchema, LanguageSchema, type ImportError, type Language } from '@edr/contracts';
import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { importProblemLabel } from '../../ui';
import {
  importDetailTable,
  importErrorDetail,
  importProblemTable,
  importProblemText,
  importRecordKind,
  importRecordText,
  UI_LANGUAGE,
} from './importErrorText';
import { ImportErrorTable } from './ImportErrorTable';

const PROBLEMS = ImportProblemSchema.options;
const LANGUAGES = LanguageSchema.options;
const SERVER_MESSAGE = 'SERVER ENGLISH MESSAGE that must never be shown';

function importError(overrides: Partial<ImportError> = {}): ImportError {
  return {
    location: 'file',
    record: '3',
    field: 'home_score',
    problem: 'type_invalid',
    message: SERVER_MESSAGE,
    ...overrides,
  };
}

/** Expected label and details (with the field "f" and without a field) of every problem, in Spanish and English. */
const EXPECTED: Record<
  (typeof PROBLEMS)[number],
  Record<Language, { label: string; withField: string; withoutField: string }>
> = {
  parse_error: {
    es: {
      label: 'Formato no válido',
      withField: 'El contenido no se puede leer en «f»: el formato no es válido.',
      withoutField: 'El contenido no se puede leer: el formato no es válido.',
    },
    en: {
      label: 'Invalid format',
      withField: 'The content cannot be read at "f": the format is not valid.',
      withoutField: 'The content cannot be read: the format is not valid.',
    },
  },
  encoding_invalid: {
    es: {
      label: 'Codificación no válida (se requiere UTF-8)',
      withField: '«f» no tiene una codificación UTF-8 válida.',
      withoutField: 'El contenido no tiene una codificación UTF-8 válida.',
    },
    en: {
      label: 'Invalid encoding (UTF-8 required)',
      withField: '"f" is not valid UTF-8.',
      withoutField: 'The content is not valid UTF-8.',
    },
  },
  too_large: {
    es: {
      label: 'Archivo demasiado grande',
      withField: '«f» supera el tamaño máximo permitido.',
      withoutField: 'El contenido supera el tamaño máximo permitido.',
    },
    en: {
      label: 'File too large',
      withField: '"f" exceeds the maximum allowed size.',
      withoutField: 'The content exceeds the maximum allowed size.',
    },
  },
  too_many_rows: {
    es: {
      label: 'Demasiadas filas',
      withField: '«f» tiene más filas o elementos de los permitidos.',
      withoutField: 'El contenido tiene más filas o elementos de los permitidos.',
    },
    en: {
      label: 'Too many rows',
      withField: '"f" has more rows or items than allowed.',
      withoutField: 'The content has more rows or items than allowed.',
    },
  },
  header_invalid: {
    es: {
      label: 'Encabezado no válido',
      withField: 'El encabezado «f» no es válido para ningún formato de importación.',
      withoutField: 'La fila de encabezado no coincide con ningún formato de importación aceptado.',
    },
    en: {
      label: 'Invalid header',
      withField: 'The header "f" is not valid for any import layout.',
      withoutField: 'The header row does not match any accepted import layout.',
    },
  },
  column_unknown: {
    es: {
      label: 'Columna desconocida',
      withField: 'La columna o el campo «f» no forma parte del formato de importación.',
      withoutField: 'Una columna o un campo no forma parte del formato de importación.',
    },
    en: {
      label: 'Unknown column',
      withField: 'The column or field "f" is not part of the import format.',
      withoutField: 'A column or field is not part of the import format.',
    },
  },
  person_field: {
    es: {
      label: 'Campo con datos de personas (no permitido)',
      withField: '«f» contiene datos de personas, que no se aceptan: solo datos de equipos y de competición.',
      withoutField: 'No se aceptan datos de personas: solo datos de equipos y de competición.',
    },
    en: {
      label: 'Field with person data (not allowed)',
      withField: '"f" holds person data, which is not accepted: team and competition data only.',
      withoutField: 'Person data is not accepted: team and competition data only.',
    },
  },
  required_missing: {
    es: {
      label: 'Falta un valor obligatorio',
      withField: 'Falta el valor obligatorio de «f».',
      withoutField: 'Falta un valor obligatorio.',
    },
    en: {
      label: 'A required value is missing',
      withField: 'The required value of "f" is missing.',
      withoutField: 'A required value is missing.',
    },
  },
  type_invalid: {
    es: {
      label: 'Tipo de valor no válido',
      withField: 'El valor de «f» no tiene el tipo o el formato esperado.',
      withoutField: 'Un valor no tiene el tipo o el formato esperado.',
    },
    en: {
      label: 'Invalid value type',
      withField: 'The value of "f" does not have the expected type or format.',
      withoutField: 'A value does not have the expected type or format.',
    },
  },
  value_out_of_range: {
    es: {
      label: 'Valor fuera de rango',
      withField: 'El valor de «f» está fuera del rango o de los valores permitidos.',
      withoutField: 'Un valor está fuera del rango o de los valores permitidos.',
    },
    en: {
      label: 'Value out of range',
      withField: 'The value of "f" is outside the allowed range or values.',
      withoutField: 'A value is outside the allowed range or values.',
    },
  },
  value_inconsistent: {
    es: {
      label: 'Valor incoherente',
      withField: 'El valor de «f» no es coherente con otros valores de la importación.',
      withoutField: 'Un valor no es coherente con otros valores de la importación.',
    },
    en: {
      label: 'Inconsistent value',
      withField: 'The value of "f" is inconsistent with other values of the import.',
      withoutField: 'A value is inconsistent with other values of the import.',
    },
  },
  duplicate_match: {
    es: {
      label: 'Partido duplicado',
      withField: 'El partido de «f» aparece dos veces en la importación.',
      withoutField: 'El partido aparece dos veces en la importación.',
    },
    en: {
      label: 'Duplicate match',
      withField: 'The match at "f" appears twice in the import.',
      withoutField: 'The match appears twice in the import.',
    },
  },
  unknown_team: {
    es: {
      label: 'Equipo desconocido',
      withField: 'El equipo de «f» no está declarado entre los equipos de la selección.',
      withoutField: 'Un equipo no está declarado entre los equipos de la selección.',
    },
    en: {
      label: 'Unknown team',
      withField: 'The team of "f" is not declared among the teams of the selection.',
      withoutField: 'A team is not declared among the teams of the selection.',
    },
  },
  metadata_missing: {
    es: {
      label: 'Faltan metadatos',
      withField: 'Falta «f» de la competición, la temporada o la fase.',
      withoutField: 'Faltan datos de la competición, la temporada o la fase.',
    },
    en: {
      label: 'Missing metadata',
      withField: '"f" of the competition, season or stage is missing.',
      withoutField: 'Competition, season or stage data is missing.',
    },
  },
  metadata_conflict: {
    es: {
      label: 'Metadatos en conflicto',
      withField: '«f» no coincide con una importación anterior de la misma competición o temporada.',
      withoutField: 'Los datos de la competición o la temporada no coinciden con una importación anterior.',
    },
    en: {
      label: 'Conflicting metadata',
      withField: '"f" differs from an earlier import of the same competition or season.',
      withoutField: 'The competition or season data differs from an earlier import.',
    },
  },
  finished_without_score: {
    es: {
      label: 'Partido finalizado sin marcador',
      withField: 'Un partido finalizado necesita su marcador (f); no se completa automáticamente.',
      withoutField: 'Un partido finalizado necesita su marcador; no se completa automáticamente.',
    },
    en: {
      label: 'Finished match without a score',
      withField: 'A finished match needs its score (f); it is never filled in automatically.',
      withoutField: 'A finished match needs its score; it is never filled in automatically.',
    },
  },
  score_not_allowed: {
    es: {
      label: 'Marcador no permitido para este estado',
      withField: 'Solo un partido finalizado lleva marcador; quite «f» o cambie el estado.',
      withoutField: 'Solo un partido finalizado lleva marcador.',
    },
    en: {
      label: 'Score not allowed for this status',
      withField: 'Only a finished match has a score; remove "f" or change the status.',
      withoutField: 'Only a finished match has a score.',
    },
  },
};

describe('import record kinds (OD-63 F-1)', () => {
  it.each([
    ['file', 'file', 'whole_file', { es: 'Archivo completo', en: 'Whole file' }, null],
    ['form', 'file', 'whole_form', { es: 'Formulario completo', en: 'Whole form' }, null],
    ['file', '/', 'whole_document', { es: 'Documento JSON completo', en: 'Whole JSON document' }, null],
    ['form', '/', 'whole_form', { es: 'Formulario completo', en: 'Whole form' }, null],
    ['file', '3', 'csv_row', { es: 'Fila 3', en: 'Row 3' }, null],
    [
      'file',
      '/selections/0/matches/2',
      'json_pointer',
      { es: 'Puntero JSON', en: 'JSON pointer' },
      '/selections/0/matches/2',
    ],
    [
      'form',
      '/selections/0/matches/0',
      'form_entry',
      { es: 'Entrada del formulario', en: 'Form entry' },
      '/selections/0/matches/0',
    ],
    ['form', '7', 'other', { es: 'Registro', en: 'Record' }, '7'],
    ['file', 'row 2', 'other', { es: 'Registro', en: 'Record' }, 'row 2'],
  ] as const)('location %s, record "%s" is a %s record', (location, record, kind, labels, code) => {
    expect(importRecordKind({ location, record })).toBe(kind);
    for (const language of LANGUAGES) {
      expect(importRecordText({ location, record }, language)).toEqual({ kind, label: labels[language], code });
    }
  });

  it('never labels a CSV row as "Archivo"', () => {
    expect(importRecordText({ location: 'file', record: '3' }).label).toBe('Fila 3');
    expect(importRecordText({ location: 'file', record: '3' }).label).not.toMatch(/Archivo/);
  });

  it('uses Spanish by default (PD-06)', () => {
    expect(UI_LANGUAGE).toBe('es');
    expect(importRecordText({ location: 'file', record: '12' })).toEqual({
      kind: 'csv_row',
      label: 'Fila 12',
      code: null,
    });
  });
});

describe('every problem value in Spanish and English (OD-63 F-2)', () => {
  it('has a label and a detail for every closed problem value and language, and no other', () => {
    for (const language of LANGUAGES) {
      expect(Object.keys(importProblemTable[language]).sort()).toEqual([...PROBLEMS].sort());
      expect(Object.keys(importDetailTable[language]).sort()).toEqual([...PROBLEMS].sort());
    }
    expect(Object.keys(EXPECTED).sort()).toEqual([...PROBLEMS].sort());
    expect(importProblemTable.es).toBe(importProblemLabel);
  });

  describe.each(PROBLEMS)('%s', (problem) => {
    it.each(LANGUAGES)('in %s', (language) => {
      const expected = EXPECTED[problem][language];
      expect(importProblemText(problem, language)).toBe(expected.label);
      expect(importErrorDetail({ problem, field: 'f' }, language)).toBe(expected.withField);
      expect(importErrorDetail({ problem, field: null }, language)).toBe(expected.withoutField);
      expect(importErrorDetail({ problem, field: '' }, language)).toBe(expected.withoutField);
    });
  });

  it('defaults to Spanish', () => {
    expect(importProblemText('type_invalid')).toBe('Tipo de valor no válido');
    expect(importErrorDetail({ problem: 'type_invalid', field: 'kickoff' })).toBe(
      'El valor de «kickoff» no tiene el tipo o el formato esperado.',
    );
  });

  it('inserts the field as given, as text', () => {
    expect(importErrorDetail({ problem: 'column_unknown', field: '<b>x</b>' }, 'es')).toBe(
      'La columna o el campo «<b>x</b>» no forma parte del formato de importación.',
    );
  });
});

describe('ImportErrorTable', () => {
  const errors: ImportError[] = [
    importError({ record: '3', field: 'home_score', problem: 'type_invalid' }),
    importError({ record: '/selections/0/matches/1', field: 'status', problem: 'value_out_of_range' }),
    importError({ record: 'file', field: null, problem: 'encoding_invalid' }),
    importError({ record: '1', field: '<img src=x onerror=alert(1)>', problem: 'column_unknown' }),
  ];

  function cellTexts(row: HTMLElement): (string | null)[] {
    return within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
  }

  it('renders every error by record kind, field, problem and detail in Spanish, never the server message', () => {
    render(createElement(ImportErrorTable, { errors }));
    const table = screen.getByRole('table', { name: '4 errores en la importación' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Registro', 'Campo', 'Problema', 'Detalle']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(cellTexts)).toEqual([
      [
        'Fila 3',
        'home_score',
        'Tipo de valor no válido',
        'El valor de «home_score» no tiene el tipo o el formato esperado.',
      ],
      [
        'Puntero JSON /selections/0/matches/1',
        'status',
        'Valor fuera de rango',
        'El valor de «status» está fuera del rango o de los valores permitidos.',
      ],
      [
        'Archivo completo',
        '—',
        'Codificación no válida (se requiere UTF-8)',
        'El contenido no tiene una codificación UTF-8 válida.',
      ],
      [
        'Fila 1',
        '<img src=x onerror=alert(1)>',
        'Columna desconocida',
        'La columna o el campo «<img src=x onerror=alert(1)>» no forma parte del formato de importación.',
      ],
    ]);
    expect(table.querySelector('tbody')?.getAttribute('lang')).toBe('es');
    expect(within(table).queryByText(new RegExp(SERVER_MESSAGE))).toBeNull();
    // Text only: no element is created from a field (T10).
    expect(table.querySelector('img')).toBeNull();
    expect(rows.map((row) => row.getAttribute('data-record-kind'))).toEqual([
      'csv_row',
      'json_pointer',
      'whole_file',
      'csv_row',
    ]);
  });

  it('renders the English texts when asked, marking their language', () => {
    render(createElement(ImportErrorTable, { errors: errors.slice(0, 3), language: 'en' }));
    const table = screen.getByRole('table', { name: '3 errores en la importación' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(cellTexts)).toEqual([
      [
        'Row 3',
        'home_score',
        'Invalid value type',
        'The value of "home_score" does not have the expected type or format.',
      ],
      [
        'JSON pointer /selections/0/matches/1',
        'status',
        'Value out of range',
        'The value of "status" is outside the allowed range or values.',
      ],
      ['Whole file', '—', 'Invalid encoding (UTF-8 required)', 'The content is not valid UTF-8.'],
    ]);
    expect(table.querySelector('tbody')?.getAttribute('lang')).toBe('en');
  });
});
