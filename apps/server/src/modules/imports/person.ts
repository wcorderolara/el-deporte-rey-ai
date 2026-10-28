/**
 * Person-level field detection (SC-07, R-119, R-280; contracts/provider-ports.md section 1.6): a CSV column or a JSON
 * member whose normalized name contains one of the person words is refused as `person_field`, naming the field.
 *
 * Normalization: NFKD, combining marks removed, lowercase, every character outside `a-z` and `0-9` removed, so that
 * `Line-Up`, `line_up` and `LINEUP` all contain `lineup`. Linear; no backtracking expression.
 */

/** Words that mark a person-level column or member name. */
export const PERSON_WORDS: readonly string[] = Object.freeze([
  'player',
  'scorer',
  'goalscorer',
  'referee',
  'coach',
  'manager',
  'squad',
  'lineup',
  'assist',
  'card',
  'person',
]);

/** The normalized form of a column or member name used for the person-word check. */
export function normalizeFieldName(name: string): string {
  return name
    .slice(0, 1000)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** True when the name denotes a person-level field. */
export function isPersonField(name: string): boolean {
  const normalized = normalizeFieldName(name);
  return PERSON_WORDS.some((word) => normalized.includes(word));
}
