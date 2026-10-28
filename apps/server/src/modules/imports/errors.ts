/**
 * Import errors (contract `ImportError`; contracts/provider-ports.md section 1.6; R-061, R-274, T11H-F12).
 *
 * Every error names its location (`file` or `form`), its record (a CSV row number, a JSON pointer built from schema
 * member names and indexes only, or `file`), its field (a column or member name) and a closed problem code, with a
 * message of fixed text plus code-controlled parameters (row numbers, pointers, limits). No error ever carries a cell
 * or member value. At most 500 errors are kept; later ones are counted only.
 */
import type { ImportErrorItem } from '../../platform/http/index.js';

export type ImportProblem = ImportErrorItem['problem'];
export type ImportLocation = ImportErrorItem['location'];

/** Most errors reported for one import (contract `Problem.importErrors` cap). */
export const MAX_IMPORT_ERRORS = 500;

const MAX_FIELD_LENGTH = 80;
const MAX_RECORD_LENGTH = 120;
const UNSAFE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Zl}\p{Zp}]/gu;

/** Record value of an error about the whole file or document. */
export const WHOLE_FILE = 'file';

/**
 * A column or member name as an error field: control, format, private-use and separator characters removed, at most
 * 80 characters. Names are structural (header cells, JSON member names), never cell or member values.
 */
export function fieldName(name: string): string {
  const cleaned = name
    .slice(0, 4 * MAX_FIELD_LENGTH)
    .replace(UNSAFE, '')
    .trim();
  const bounded = [...cleaned].slice(0, MAX_FIELD_LENGTH).join('');
  return bounded === '' ? '(empty)' : bounded;
}

/** Collects the errors of one import, up to `MAX_IMPORT_ERRORS`. */
export class ImportErrorList {
  readonly location: ImportLocation;
  readonly #items: ImportErrorItem[] = [];
  #total = 0;

  constructor(location: ImportLocation) {
    this.location = location;
  }

  /** Adds one error; `message` is fixed text plus code-controlled parameters only. */
  add(record: string, field: string | null, problem: ImportProblem, message: string): void {
    this.#total += 1;
    if (this.#items.length >= MAX_IMPORT_ERRORS) {
      return;
    }
    this.#items.push(
      Object.freeze({
        location: this.location,
        record: record.length > MAX_RECORD_LENGTH ? record.slice(0, MAX_RECORD_LENGTH) : record,
        field,
        problem,
        message,
      }),
    );
  }

  /** True when no error was added. */
  get empty(): boolean {
    return this.#total === 0;
  }

  /** True when the cap is reached: further errors are only counted. */
  get full(): boolean {
    return this.#items.length >= MAX_IMPORT_ERRORS;
  }

  /** Number of errors found, including those beyond the cap. */
  get total(): number {
    return this.#total;
  }

  /** The kept errors, in the order they were found. */
  get items(): readonly ImportErrorItem[] {
    return this.#items;
  }
}

/** Thrown inside the pipeline when an import is rejected; carries the collected errors. */
export class ImportRejection extends Error {
  override readonly name = 'ImportRejection';
  readonly errors: readonly ImportErrorItem[];
  readonly total: number;

  constructor(list: ImportErrorList) {
    super('import rejected');
    this.errors = Object.freeze([...list.items]);
    this.total = list.total;
  }
}

/** Throws the rejection when the list holds any error. */
export function rejectIfAny(list: ImportErrorList): void {
  if (!list.empty) {
    throw new ImportRejection(list);
  }
}
