/**
 * Unit tests of the shared source, listing, catalogue, selection and verification-status schemas on inline synthetic
 * values (`contracts/provider-ports.md` sections 1.2 and 1.3, `data-model.md` section 0).
 */
import { describe, expect, it } from 'vitest';

import {
  CatalogueEntrySchema,
  CompetitionListingSchema,
  SeasonListingSchema,
  SelectionSchema,
  SourceAvailabilitySchema,
  SourceDescriptorSchema,
  SourceStageSchema,
  StageListingSchema,
} from './catalogue.js';
import { countStrippedKeys, formatIssuePath, parseDomain } from './parse.js';
import { VerificationStatusSchema } from './verification.js';

const OPAQUE_REF = '{"k":"liga-demo","s":"2026"}';

function descriptor(): Record<string, unknown> {
  return {
    id: 'demo-a',
    name: 'Demo A',
    mode: 'DEMO_DATA',
    adapter: 'fixture',
    role: 'primary',
    officialPublication: false,
    accepted: true,
    independenceGroup: 'demo-a',
    publicationPermission: 'not_applicable',
    enabled: true,
  };
}

function competitionListing(): Record<string, unknown> {
  return {
    items: [
      { ref: OPAQUE_REF, localKey: 'liga-demo', name: 'Liga Demo', areaName: 'Región Ficticia' },
      { ref: '{"k":"copa-demo"}', localKey: 'copa-demo', name: 'Copa Demo', areaName: null },
    ],
    availability: { available: true },
    retrievedAt: '2026-10-27T10:00:00Z',
    fromCache: true,
    stale: false,
    retryAfterSeconds: null,
  };
}

function stage(): Record<string, unknown> {
  return {
    id: 'fase-liga',
    name: 'Fase de liga',
    order: 1,
    standings: 'expected',
    wholeStageRef: null,
    matchdays: [
      { number: 1, ref: '{"md":1}' },
      { number: 2, ref: '{"md":2}' },
    ],
  };
}

describe('SourceDescriptorSchema (Source)', () => {
  it('accepts a configured descriptor', () => {
    expect(parseDomain(SourceDescriptorSchema, descriptor())).toMatchObject({ success: true, strippedKeys: 0 });
  });

  it('strips credentials and other unknown keys and counts them', () => {
    const input = { ...descriptor(), options: { baseUrl: 'http://127.0.0.1:1' }, token: 'edr-test-marker-token-0000' };
    const result = parseDomain(SourceDescriptorSchema, input);
    expect(result).toMatchObject({ success: true, strippedKeys: 2 });
    expect(JSON.stringify(result)).not.toContain('edr-test-marker-token-0000');
  });

  it('refuses an accepted MANUAL_DATA source (R-071)', () => {
    const result = parseDomain(SourceDescriptorSchema, { ...descriptor(), mode: 'MANUAL_DATA' });
    expect(result).toMatchObject({ success: false, issues: [{ path: '/accepted' }] });
  });

  it('refuses an unknown data mode, an invalid source ID and an unknown role', () => {
    const result = parseDomain(SourceDescriptorSchema, {
      ...descriptor(),
      id: 'Demo_A',
      mode: 'LIVE',
      role: 'secondary',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.path)).toEqual(['/id', '/mode', '/role']);
    }
  });
});

describe('SourceAvailabilitySchema', () => {
  it('accepts available and unavailable with a closed reason', () => {
    expect(SourceAvailabilitySchema.safeParse({ available: true }).success).toBe(true);
    expect(SourceAvailabilitySchema.safeParse({ available: false, reason: 'subscription_restricted' }).success).toBe(
      true,
    );
  });

  it('refuses unavailable without a reason or with an unknown reason', () => {
    expect(SourceAvailabilitySchema.safeParse({ available: false }).success).toBe(false);
    expect(SourceAvailabilitySchema.safeParse({ available: false, reason: 'quota' }).success).toBe(false);
  });
});

describe('listing schemas (listing items)', () => {
  it('accepts a competition listing with provenance', () => {
    expect(parseDomain(CompetitionListingSchema, competitionListing()).success).toBe(true);
  });

  it('accepts a stale empty listing of an unavailable source', () => {
    const listing = {
      ...competitionListing(),
      items: [],
      availability: { available: false, reason: 'rate_limited' },
      stale: true,
      retryAfterSeconds: 30,
    };
    expect(parseDomain(CompetitionListingSchema, listing).success).toBe(true);
  });

  it('refuses competition names outside the display-name rule and a non-slug local key', () => {
    const listing = competitionListing();
    const items = listing.items as Record<string, unknown>[];
    items[0] = { ...items[0], name: 'Liga\u202EDemo' };
    items[1] = { ...items[1], localKey: 'Copa Demo' };
    const result = parseDomain(CompetitionListingSchema, listing);
    expect(result).toMatchObject({
      success: false,
      issues: [{ path: '/items/0/name' }, { path: '/items/1/localKey' }],
    });
  });

  it('refuses a control character in an opaque reference and a reference over 512 characters', () => {
    const listing = competitionListing();
    const items = listing.items as Record<string, unknown>[];
    items[0] = { ...items[0], ref: '{"k":"a\u0000"}' };
    items[1] = { ...items[1], ref: `{"k":"${'x'.repeat(520)}"}` };
    const result = parseDomain(CompetitionListingSchema, listing);
    expect(result).toMatchObject({ success: false, issues: [{ path: '/items/0/ref' }, { path: '/items/1/ref' }] });
  });

  it('accepts seasons with optional dates and start year, and refuses an invalid date', () => {
    const listing = {
      ...competitionListing(),
      items: [
        {
          ref: '{"s":2026}',
          id: '2026-27',
          label: '2026/27',
          current: true,
          startDate: '2026-08-01',
          endDate: '2027-05-30',
          startYear: 2026,
        },
        { ref: '{"s":2025}', id: '2025-26', label: '2025/26', current: false, startDate: null, endDate: null, startYear: null },
      ],
    };
    expect(parseDomain(SeasonListingSchema, listing).success).toBe(true);
    (listing.items[0] as Record<string, unknown>).startDate = '2026-13-01';
    expect(parseDomain(SeasonListingSchema, listing)).toMatchObject({
      success: false,
      issues: [{ path: '/items/0/startDate' }],
    });
  });

  it('accepts stages by the source names, with matchdays or selectable as a whole', () => {
    const knockout = {
      id: 'octavos',
      name: 'Octavos de final',
      order: 3,
      standings: 'not_expected',
      wholeStageRef: '{"stage":"r16"}',
      matchdays: [],
    };
    const listing = { ...competitionListing(), items: [stage(), knockout] };
    expect(parseDomain(StageListingSchema, listing).success).toBe(true);
  });

  it('refuses duplicate matchday numbers and numbers out of range', () => {
    const duplicate = { ...stage(), matchdays: [{ number: 1, ref: 'a' }, { number: 1, ref: 'b' }] };
    expect(SourceStageSchema.safeParse(duplicate).success).toBe(false);
    const outOfRange = { ...stage(), matchdays: [{ number: 0, ref: 'a' }] };
    expect(SourceStageSchema.safeParse(outOfRange).success).toBe(false);
  });

  it('caps the number of listed items', () => {
    const many = Array.from({ length: 65 }, (_, index) => ({ ...stage(), id: `fase-${index}`, order: index + 1 }));
    expect(parseDomain(StageListingSchema, { ...competitionListing(), items: many }).success).toBe(false);
  });
});

describe('CatalogueEntrySchema (Competition) and SelectionSchema (Matchday)', () => {
  it('accepts a catalogue competition bound to two sources', () => {
    const entry = {
      id: 'liga-demo',
      name: 'Liga Demo',
      areaName: null,
      reference: false,
      bindings: [
        { sourceId: 'demo-a', competitionRef: OPAQUE_REF },
        { sourceId: 'demo-b', competitionRef: '{"k":"ld"}' },
      ],
    };
    expect(CatalogueEntrySchema.safeParse(entry).success).toBe(true);
    expect(CatalogueEntrySchema.safeParse({ ...entry, bindings: [] }).success).toBe(false);
    expect(CatalogueEntrySchema.safeParse({ ...entry, bindings: [entry.bindings[0], entry.bindings[0]] }).success).toBe(
      false,
    );
  });

  it('accepts a matchday selection and a whole-stage selection, and refuses matchday 0', () => {
    const selection = {
      competitionId: 'demo-a-liga-demo',
      sourceId: 'demo-a',
      seasonId: '2026-27',
      stageId: 'fase-liga',
      matchday: 3,
    };
    expect(SelectionSchema.safeParse(selection).success).toBe(true);
    expect(SelectionSchema.safeParse({ ...selection, matchday: null }).success).toBe(true);
    expect(SelectionSchema.safeParse({ ...selection, matchday: 0 }).success).toBe(false);
  });
});

describe('VerificationStatusSchema', () => {
  it('sets a reason exactly for unverified facts', () => {
    expect(VerificationStatusSchema.safeParse({ status: 'verified', unverifiedReason: null }).success).toBe(true);
    expect(
      VerificationStatusSchema.safeParse({ status: 'unverified', unverifiedReason: 'disputed' }).success,
    ).toBe(true);
    expect(VerificationStatusSchema.safeParse({ status: 'manually_approved', unverifiedReason: null }).success).toBe(
      true,
    );
    expect(VerificationStatusSchema.safeParse({ status: 'unverified', unverifiedReason: null }).success).toBe(false);
    expect(VerificationStatusSchema.safeParse({ status: 'verified', unverifiedReason: 'disputed' }).success).toBe(
      false,
    );
    expect(VerificationStatusSchema.safeParse({ status: 'disputed', unverifiedReason: null }).success).toBe(false);
  });
});

describe('parse helpers', () => {
  it('formats issue paths as JSON pointers', () => {
    expect(formatIssuePath([])).toBe('/');
    expect(formatIssuePath(['matches', 0, 'score'])).toBe('/matches/0/score');
    expect(formatIssuePath(['a/b', 'c~d'])).toBe('/a~1b/c~0d');
  });

  it('counts stripped keys inside arrays and nested objects only', () => {
    const input: unknown = JSON.parse('{"a":1,"x":2,"list":[{"b":1,"y":1},{"b":2}],"__proto__":{"z":1}}');
    const output = { a: 1, list: [{ b: 1 }, { b: 2 }] };
    expect(countStrippedKeys(input, output)).toBe(3);
  });

  it('reports issues with fixed messages, never the refused value', () => {
    const secret = 'edr-test-marker-token-0000 <script>';
    const result = parseDomain(SourceDescriptorSchema, { ...descriptor(), name: secret, adapter: secret });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('edr-test-marker-token-0000');
  });
});
