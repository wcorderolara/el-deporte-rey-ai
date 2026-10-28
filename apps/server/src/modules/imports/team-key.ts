/**
 * Team keys of CSV imports, derived deterministically from team names by the exact rule of
 * contracts/provider-ports.md section 1.6 (T11H-F09):
 *
 * 1. NFC normalization;
 * 2. NFD decomposition and removal of every `\p{M}` character;
 * 3. `toLowerCase()` (locale-independent);
 * 4. each maximal run of characters outside `[a-z0-9]` replaced by one `-`;
 * 5. leading and trailing `-` removed;
 * 6. the result must match the contract `Slug` pattern (1 to 64 characters), else there is no key.
 *
 * Every step is linear in the name length; trimming is a loop, not a regular expression.
 */
import { contractRegExp } from '@edr/contracts';

const SLUG = contractRegExp('Slug');
const DASH = 0x2d;

/** The derived team key of a name, or null when the result is empty or not a `Slug`. */
export function deriveTeamKey(name: string): string | null {
  const folded = name
    .normalize('NFC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  let start = 0;
  let end = folded.length;
  while (start < end && folded.charCodeAt(start) === DASH) {
    start += 1;
  }
  while (end > start && folded.charCodeAt(end - 1) === DASH) {
    end -= 1;
  }
  const key = folded.slice(start, end);
  return key.length >= 1 && key.length <= 64 && SLUG.test(key) ? key : null;
}
