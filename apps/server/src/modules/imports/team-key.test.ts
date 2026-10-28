/** Team-key derivation rule of CSV imports (T11H-F09). */
import { describe, expect, it } from 'vitest';

import { deriveTeamKey } from './team-key.js';

describe('deriveTeamKey', () => {
  it.each([
    ['Club Alfa', 'club-alfa'],
    ['Atlético Gamma', 'atletico-gamma'],
    ['Unión  Delta  ', 'union-delta'],
    ['  (Real) Épsilon & Zeta  ', 'real-epsilon-zeta'],
    ['Club A.B.', 'club-a-b'],
    ['Club A B', 'club-a-b'],
    ['Deportivo 1924', 'deportivo-1924'],
    ['ÅNGSTRÖM', 'angstrom'],
    ['__proto__', 'proto'],
    ['constructor', 'constructor'],
    ['toString', 'tostring'],
  ])('derives %j as %j', (name, key) => {
    expect(deriveTeamKey(name)).toBe(key);
  });

  it('derives the same key from the NFC and NFD forms of a name', () => {
    const nfc = 'Atlético Gamma'.normalize('NFC');
    const nfd = 'Atlético Gamma'.normalize('NFD');
    expect(nfc).not.toBe(nfd);
    expect(deriveTeamKey(nfd)).toBe(deriveTeamKey(nfc));
  });

  it('gives no key for a name in a non-Latin script only', () => {
    expect(deriveTeamKey('Клуб Альфа')).toBeNull();
    expect(deriveTeamKey('東京')).toBeNull();
    expect(deriveTeamKey('...')).toBeNull();
  });

  it('gives no key when the result is longer than 64 characters', () => {
    expect(deriveTeamKey('a'.repeat(64))).toBe('a'.repeat(64));
    expect(deriveTeamKey('a'.repeat(65))).toBeNull();
  });
});
