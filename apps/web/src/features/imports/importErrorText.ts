/**
 * Localized texts of an import error (contract `ImportError`; R-061, R-274, R-416; OD-63 F-1 and F-2), built only
 * from its closed members: `location`, the shape of `record` and the closed `problem`, with the sanitized `field` as
 * the only parameter. Nothing is parsed out of the server's `message`, which is fixed English text: since `problem`
 * is a closed code present on every error, the message is never shown.
 *
 * Record kinds (contract: "Row number (CSV), JSON pointer (JSON, form) or "file""):
 * - `file` (either location): the whole file or the whole form; the root pointer `/` is the whole document too;
 * - digits only, in a file: a CSV row number;
 * - a pointer starting with `/`: a JSON pointer in a file, or an entry of the form document in the form;
 * - any other value: shown as given, as a record. This is the only server text shown, and only when the record has
 *   none of the documented shapes.
 *
 * Every text renders as text only (T10 controls).
 */
import type { ImportError, Language } from '@edr/contracts';

import type { ImportErrorProblem } from '../../api/types';
import { importProblemLabel } from '../../ui';

/**
 * Language of the operator interface: Spanish, the default (PD-06, BR-07). The interface has no language switch (the
 * document is `lang="es"` and every feature's copy is Spanish). Components take a `language` prop that defaults to it.
 */
export const UI_LANGUAGE: Language = 'es';

export type ImportRecordKind =
  'whole_file' | 'whole_form' | 'whole_document' | 'csv_row' | 'json_pointer' | 'form_entry' | 'other';

const CSV_ROW = /^[0-9]{1,9}$/;

/** Kind of the record of an import error, from its location and the documented record shapes. */
export function importRecordKind(error: Pick<ImportError, 'location' | 'record'>): ImportRecordKind {
  const { location, record } = error;
  if (record === 'file') {
    return location === 'form' ? 'whole_form' : 'whole_file';
  }
  if (record === '/') {
    return location === 'form' ? 'whole_form' : 'whole_document';
  }
  if (record.startsWith('/')) {
    return location === 'form' ? 'form_entry' : 'json_pointer';
  }
  if (location === 'file' && CSV_ROW.test(record)) {
    return 'csv_row';
  }
  return 'other';
}

/** Record label: a text, and the record itself as code when it is a pointer or an undocumented value. */
export interface ImportRecordText {
  kind: ImportRecordKind;
  label: string;
  /** Pointer or record shown as code next to the label (never translated); null when the label says it all. */
  code: string | null;
}

interface RecordTable {
  whole_file: string;
  whole_form: string;
  whole_document: string;
  csv_row: (row: string) => string;
  json_pointer: string;
  form_entry: string;
  other: string;
}

export const importRecordTable: Record<Language, RecordTable> = {
  es: {
    whole_file: 'Archivo completo',
    whole_form: 'Formulario completo',
    whole_document: 'Documento JSON completo',
    csv_row: (row) => `Fila ${row}`,
    json_pointer: 'Puntero JSON',
    form_entry: 'Entrada del formulario',
    other: 'Registro',
  },
  en: {
    whole_file: 'Whole file',
    whole_form: 'Whole form',
    whole_document: 'Whole JSON document',
    csv_row: (row) => `Row ${row}`,
    json_pointer: 'JSON pointer',
    form_entry: 'Form entry',
    other: 'Record',
  },
};

export function importRecordText(
  error: Pick<ImportError, 'location' | 'record'>,
  language: Language = UI_LANGUAGE,
): ImportRecordText {
  const kind = importRecordKind(error);
  const table = importRecordTable[language];
  switch (kind) {
    case 'whole_file':
    case 'whole_form':
    case 'whole_document':
      return { kind, label: table[kind], code: null };
    case 'csv_row':
      return { kind, label: table.csv_row(error.record), code: null };
    case 'json_pointer':
    case 'form_entry':
    case 'other':
      return { kind, label: table[kind], code: error.record };
  }
}

/** Short label of each problem (the "Problema" column). Spanish is the shared table of `src/ui/copy.ts`. */
export const importProblemTable: Record<Language, Record<ImportErrorProblem, string>> = {
  es: importProblemLabel,
  en: {
    parse_error: 'Invalid format',
    encoding_invalid: 'Invalid encoding (UTF-8 required)',
    too_large: 'File too large',
    too_many_rows: 'Too many rows',
    header_invalid: 'Invalid header',
    column_unknown: 'Unknown column',
    person_field: 'Field with person data (not allowed)',
    required_missing: 'A required value is missing',
    type_invalid: 'Invalid value type',
    value_out_of_range: 'Value out of range',
    value_inconsistent: 'Inconsistent value',
    duplicate_match: 'Duplicate match',
    unknown_team: 'Unknown team',
    metadata_missing: 'Missing metadata',
    metadata_conflict: 'Conflicting metadata',
    finished_without_score: 'Finished match without a score',
    score_not_allowed: 'Score not allowed for this status',
  },
};

/** Detail of a problem: one text with the field as parameter, one for an error without a field. */
interface DetailText {
  withField: (field: string) => string;
  withoutField: string;
}

export const importDetailTable: Record<Language, Record<ImportErrorProblem, DetailText>> = {
  es: {
    parse_error: {
      withField: (field) => `El contenido no se puede leer en «${field}»: el formato no es válido.`,
      withoutField: 'El contenido no se puede leer: el formato no es válido.',
    },
    encoding_invalid: {
      withField: (field) => `«${field}» no tiene una codificación UTF-8 válida.`,
      withoutField: 'El contenido no tiene una codificación UTF-8 válida.',
    },
    too_large: {
      withField: (field) => `«${field}» supera el tamaño máximo permitido.`,
      withoutField: 'El contenido supera el tamaño máximo permitido.',
    },
    too_many_rows: {
      withField: (field) => `«${field}» tiene más filas o elementos de los permitidos.`,
      withoutField: 'El contenido tiene más filas o elementos de los permitidos.',
    },
    header_invalid: {
      withField: (field) => `El encabezado «${field}» no es válido para ningún formato de importación.`,
      withoutField: 'La fila de encabezado no coincide con ningún formato de importación aceptado.',
    },
    column_unknown: {
      withField: (field) => `La columna o el campo «${field}» no forma parte del formato de importación.`,
      withoutField: 'Una columna o un campo no forma parte del formato de importación.',
    },
    person_field: {
      withField: (field) =>
        `«${field}» contiene datos de personas, que no se aceptan: solo datos de equipos y de competición.`,
      withoutField: 'No se aceptan datos de personas: solo datos de equipos y de competición.',
    },
    required_missing: {
      withField: (field) => `Falta el valor obligatorio de «${field}».`,
      withoutField: 'Falta un valor obligatorio.',
    },
    type_invalid: {
      withField: (field) => `El valor de «${field}» no tiene el tipo o el formato esperado.`,
      withoutField: 'Un valor no tiene el tipo o el formato esperado.',
    },
    value_out_of_range: {
      withField: (field) => `El valor de «${field}» está fuera del rango o de los valores permitidos.`,
      withoutField: 'Un valor está fuera del rango o de los valores permitidos.',
    },
    value_inconsistent: {
      withField: (field) => `El valor de «${field}» no es coherente con otros valores de la importación.`,
      withoutField: 'Un valor no es coherente con otros valores de la importación.',
    },
    duplicate_match: {
      withField: (field) => `El partido de «${field}» aparece dos veces en la importación.`,
      withoutField: 'El partido aparece dos veces en la importación.',
    },
    unknown_team: {
      withField: (field) => `El equipo de «${field}» no está declarado entre los equipos de la selección.`,
      withoutField: 'Un equipo no está declarado entre los equipos de la selección.',
    },
    metadata_missing: {
      withField: (field) => `Falta «${field}» de la competición, la temporada o la fase.`,
      withoutField: 'Faltan datos de la competición, la temporada o la fase.',
    },
    metadata_conflict: {
      withField: (field) => `«${field}» no coincide con una importación anterior de la misma competición o temporada.`,
      withoutField: 'Los datos de la competición o la temporada no coinciden con una importación anterior.',
    },
    finished_without_score: {
      withField: (field) => `Un partido finalizado necesita su marcador (${field}); no se completa automáticamente.`,
      withoutField: 'Un partido finalizado necesita su marcador; no se completa automáticamente.',
    },
    score_not_allowed: {
      withField: (field) => `Solo un partido finalizado lleva marcador; quite «${field}» o cambie el estado.`,
      withoutField: 'Solo un partido finalizado lleva marcador.',
    },
  },
  en: {
    parse_error: {
      withField: (field) => `The content cannot be read at "${field}": the format is not valid.`,
      withoutField: 'The content cannot be read: the format is not valid.',
    },
    encoding_invalid: {
      withField: (field) => `"${field}" is not valid UTF-8.`,
      withoutField: 'The content is not valid UTF-8.',
    },
    too_large: {
      withField: (field) => `"${field}" exceeds the maximum allowed size.`,
      withoutField: 'The content exceeds the maximum allowed size.',
    },
    too_many_rows: {
      withField: (field) => `"${field}" has more rows or items than allowed.`,
      withoutField: 'The content has more rows or items than allowed.',
    },
    header_invalid: {
      withField: (field) => `The header "${field}" is not valid for any import layout.`,
      withoutField: 'The header row does not match any accepted import layout.',
    },
    column_unknown: {
      withField: (field) => `The column or field "${field}" is not part of the import format.`,
      withoutField: 'A column or field is not part of the import format.',
    },
    person_field: {
      withField: (field) => `"${field}" holds person data, which is not accepted: team and competition data only.`,
      withoutField: 'Person data is not accepted: team and competition data only.',
    },
    required_missing: {
      withField: (field) => `The required value of "${field}" is missing.`,
      withoutField: 'A required value is missing.',
    },
    type_invalid: {
      withField: (field) => `The value of "${field}" does not have the expected type or format.`,
      withoutField: 'A value does not have the expected type or format.',
    },
    value_out_of_range: {
      withField: (field) => `The value of "${field}" is outside the allowed range or values.`,
      withoutField: 'A value is outside the allowed range or values.',
    },
    value_inconsistent: {
      withField: (field) => `The value of "${field}" is inconsistent with other values of the import.`,
      withoutField: 'A value is inconsistent with other values of the import.',
    },
    duplicate_match: {
      withField: (field) => `The match at "${field}" appears twice in the import.`,
      withoutField: 'The match appears twice in the import.',
    },
    unknown_team: {
      withField: (field) => `The team of "${field}" is not declared among the teams of the selection.`,
      withoutField: 'A team is not declared among the teams of the selection.',
    },
    metadata_missing: {
      withField: (field) => `"${field}" of the competition, season or stage is missing.`,
      withoutField: 'Competition, season or stage data is missing.',
    },
    metadata_conflict: {
      withField: (field) => `"${field}" differs from an earlier import of the same competition or season.`,
      withoutField: 'The competition or season data differs from an earlier import.',
    },
    finished_without_score: {
      withField: (field) => `A finished match needs its score (${field}); it is never filled in automatically.`,
      withoutField: 'A finished match needs its score; it is never filled in automatically.',
    },
    score_not_allowed: {
      withField: (field) => `Only a finished match has a score; remove "${field}" or change the status.`,
      withoutField: 'Only a finished match has a score.',
    },
  },
};

/** Short label of the problem, in `language`. */
export function importProblemText(problem: ImportErrorProblem, language: Language = UI_LANGUAGE): string {
  return importProblemTable[language][problem];
}

/** Detail of the error from its problem code, with its field as the only parameter, in `language`. */
export function importErrorDetail(
  error: Pick<ImportError, 'problem' | 'field'>,
  language: Language = UI_LANGUAGE,
): string {
  const detail = importDetailTable[language][error.problem];
  return error.field === null || error.field === '' ? detail.withoutField : detail.withField(error.field);
}
