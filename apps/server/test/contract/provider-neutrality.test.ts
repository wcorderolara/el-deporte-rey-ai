/**
 * Provider neutrality of the contract and of the shared domain schemas (R-288, R-140, PD-14, AD-31): no schema name,
 * property, enum value, description or other text of the contract, and no name, property, enum value or description
 * of the domain schemas, contains a provider identifier or a provider field name.
 */
import {
  CatalogueEntrySchema,
  CompetitionListingSchema,
  componentSchemas,
  SeasonListingSchema,
  SelectionSchema,
  SelectionSnapshotSchema,
  SourceDescriptorSchema,
  StageListingSchema,
  VerificationStatusSchema,
} from '@edr/contracts';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isObject, loadContract, type JsonObject, type JsonValue } from './support/contract-document.js';

/**
 * Provider identifiers and provider field names that must not appear (R-288 examples, R-289): the provider name and
 * host, the credential header, the reference competition's code, numeric ID and name, and provider response fields.
 */
const FORBIDDEN: readonly RegExp[] = [
  /football/i,
  /x-auth/i,
  /\bCL\b/,
  /\b2001\b/,
  /champions/i,
  /\bcrest\b/i,
  /\btla\b/i,
  /playedGames/i,
  /utcDate/i,
  /X-Requests/i,
  /X-RequestCounter/i,
  /X-Authenticated-Client/i,
  /lastUpdated/i,
  /winner/i,
  /fullTime/i,
  /halfTime/i,
  /\breferees?\b/i,
];

/** Every key and every string value of a JSON tree, with its location. */
function texts(value: JsonValue, where = '', found: { where: string; text: string }[] = []) {
  if (typeof value === 'string') {
    found.push({ where, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => texts(item, `${where}/${index}`, found));
  } else if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      found.push({ where: `${where}/${key} (key)`, text: key });
      texts(entry, `${where}/${key}`, found);
    }
  }
  return found;
}

function violations(value: JsonValue): string[] {
  const result: string[] = [];
  for (const { where, text } of texts(value)) {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) {
        result.push(`${where}: ${pattern.source}`);
      }
    }
  }
  return result;
}

let document: JsonObject;

beforeAll(async () => {
  document = await loadContract();
});

describe('provider neutrality (R-288)', () => {
  it('finds no provider identifier or provider field name anywhere in the contract', () => {
    expect(violations(document)).toEqual([]);
  });

  it('finds none in the names, properties, enum values or descriptions of the domain schemas', () => {
    const domain: Record<string, z.ZodType> = {
      SelectionSnapshot: SelectionSnapshotSchema,
      SourceDescriptor: SourceDescriptorSchema,
      CompetitionListing: CompetitionListingSchema,
      SeasonListing: SeasonListingSchema,
      StageListing: StageListingSchema,
      CatalogueEntry: CatalogueEntrySchema,
      Selection: SelectionSchema,
      VerificationStatus: VerificationStatusSchema,
    };
    const result: string[] = [];
    for (const [name, schema] of Object.entries(domain)) {
      result.push(...violations(name).map((entry) => `${name}${entry}`));
      const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as unknown as JsonValue;
      result.push(...violations(jsonSchema).map((entry) => `${name}${entry}`));
    }
    expect(result).toEqual([]);
  });

  it('finds none in the Zod mirror of the contract', () => {
    const result: string[] = [];
    for (const [name, schema] of Object.entries(componentSchemas)) {
      const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as unknown as JsonValue;
      result.push(...violations(jsonSchema).map((entry) => `${name}${entry}`));
    }
    expect(result).toEqual([]);
  });

  it('detects provider identifiers and field names (the check is effective)', () => {
    // The competition code and ID are assembled here because the AD-31 lint rule bans them as literals in apps/**.
    const seeded: JsonValue = {
      properties: { crest: { type: 'string' }, tla: { type: 'string' }, playedGames: { type: 'integer' } },
      enum: ['C' + 'L', String(2000 + 1)],
      description: 'From the football API with the X-Auth-Token header; utcDate kept',
    };
    const found = violations(seeded);
    for (const pattern of [
      /football/i,
      /x-auth/i,
      /\bCL\b/,
      /\b2001\b/,
      /\bcrest\b/i,
      /\btla\b/i,
      /playedGames/i,
      /utcDate/i,
    ]) {
      expect(
        found.some((entry) => entry.endsWith(`: ${pattern.source}`)),
        pattern.source,
      ).toBe(true);
    }
  });
});
