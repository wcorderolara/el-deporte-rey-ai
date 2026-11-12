/**
 * Contract tests of the declared HTTP contract document `contracts/http-api.openapi.yaml`: it parses and validates as
 * OpenAPI 3.1 at version 1.0.0, declares the local request protection on every operation (AD-14, T10-F17,
 * T10-A1-01), has no publication operation (R-219), carries the OD-26 visual-QA warning check, equals the accepted
 * proposal except `info.version`, descriptions and that recorded addition (V-29), and closes every fact value and QA
 * detail schema (T10-F17).
 */
import { ExportSchema } from '@edr/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  child,
  contractOperations,
  isObject,
  loadContract,
  loadDocument,
  PROPOSAL_PATH,
  validateContract,
  validateDocument,
  type ContractOperation,
  type JsonObject,
  type JsonValue,
} from './support/contract-document.js';

let document: JsonObject;
let operations: ContractOperation[];

beforeAll(async () => {
  document = await loadContract();
  operations = contractOperations(document);
});

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

function responseCodes(operation: ContractOperation): string[] {
  return Object.keys(child(operation.operation, 'responses'));
}

function label(operation: ContractOperation): string {
  return `${operation.method.toUpperCase()} ${operation.path} (${String(operation.operation.operationId)})`;
}

describe('contract document', () => {
  it('validates as OpenAPI 3.1 with the parser', async () => {
    const result = await validateContract();
    expect(result.messages).toEqual([]);
    expect(result.valid).toBe(true);
    expect(document.openapi).toBe('3.1.0');
  });

  it('is rejected by the validator when it is broken (the validation is effective)', async () => {
    const broken = structuredClone(document);
    child(broken, 'paths', '/health', 'get').responses = 'none';
    expect(await validateDocument(broken)).toBe(false);
    const duplicateId = structuredClone(document);
    child(duplicateId, 'paths', '/settings', 'get').operationId = 'getHealth';
    expect(await validateDocument(duplicateId)).toBe(false);
  });

  it('is the promoted version 1.0.0 with the v1 base path on the loopback server', () => {
    expect(child(document, 'info').version).toBe('1.0.0');
    const servers = document.servers;
    expect(Array.isArray(servers) && servers.length === 1 && isObject(servers[0]) ? servers[0].url : null).toBe(
      'http://127.0.0.1:4300/api/v1',
    );
  });

  it('has 137 operations on 101 paths, 67 of them mutating, with unique operation IDs', () => {
    expect(Object.keys(child(document, 'paths'))).toHaveLength(101);
    expect(operations).toHaveLength(137);
    expect(operations.filter((operation) => MUTATING.has(operation.method))).toHaveLength(67);
    const ids = operations.map((operation) => operation.operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has 214 component schemas', () => {
    // PD-ARCH-01G-E.2 adds the three schemas of the match list of a round calendar.
    expect(Object.keys(child(document, 'components', 'schemas'))).toHaveLength(214);
  });
});

describe('local request protection declared on every operation (AD-14, T10-F17, T10-A1-01)', () => {
  it('declares 403 and 421 on every operation', () => {
    const missing = operations
      .filter((operation) => !responseCodes(operation).includes('403') || !responseCodes(operation).includes('421'))
      .map(label);
    expect(missing).toEqual([]);
  });

  it('declares the client header and 415 on every mutating operation', () => {
    const missing = operations
      .filter((operation) => MUTATING.has(operation.method))
      .filter(
        (operation) =>
          !responseCodes(operation).includes('415') ||
          !operation.parameters.some(
            (parameter) =>
              parameter.in === 'header' && parameter.name === 'X-EDR-Client' && parameter.required === true,
          ),
      )
      .map(label);
    expect(missing).toEqual([]);
  });

  it('declares 413 on every operation with a request body, and no body on GET', () => {
    const withBody = operations.filter((operation) => operation.operation.requestBody !== undefined);
    expect(withBody.filter((operation) => !responseCodes(operation).includes('413')).map(label)).toEqual([]);
    expect(withBody.filter((operation) => operation.method === 'get').map(label)).toEqual([]);
  });

  it('declares every error response as application/problem+json with the Problem schema', () => {
    const problem = child(document, 'components', 'responses', 'Problem');
    expect(child(problem, 'content', 'application/problem+json', 'schema').$ref).toBe('#/components/schemas/Problem');
    const wrong: string[] = [];
    for (const operation of operations) {
      for (const [code, response] of Object.entries(child(operation.operation, 'responses'))) {
        if (Number(code) >= 400 && !(isObject(response) && response.$ref === '#/components/responses/Problem')) {
          wrong.push(`${label(operation)} ${code}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('constrains every server-ID path parameter with the Uuid schema and every other with a pattern schema', () => {
    const unconstrained: string[] = [];
    /** A component schema that is a closed list of strings (an enum is tighter than a pattern; PD-ARCH-01H). */
    const enumerated = (ref: string): boolean => {
      const name = ref.startsWith('#/components/schemas/') ? ref.slice('#/components/schemas/'.length) : null;
      const target = name === null ? undefined : child(document, 'components', 'schemas')[name];
      return (
        isObject(target) &&
        target.type === 'string' &&
        Array.isArray(target.enum) &&
        target.enum.length > 0 &&
        target.enum.every((value) => typeof value === 'string')
      );
    };
    for (const operation of operations) {
      for (const parameter of operation.parameters.filter((entry) => entry.in === 'path')) {
        const schema = child(parameter, 'schema');
        const ref = typeof schema.$ref === 'string' ? schema.$ref : '';
        const bounded =
          ref.endsWith('/Uuid') ||
          ref.endsWith('/Slug') ||
          ref.endsWith('/SourceId') ||
          ref.endsWith('/ExternalSeasonId') ||
          enumerated(ref);
        const patterned = typeof schema.pattern === 'string' && schema.pattern.length > 0;
        if (!bounded && !patterned && !(schema.type === 'integer' && schema.maximum !== undefined)) {
          unconstrained.push(`${label(operation)} ${String(parameter.name)}`);
        }
      }
    }
    expect(unconstrained).toEqual([]);
  });
});

describe('no publication operation (R-219, BR-11)', () => {
  const PUBLISH_WORDING = /publish|post[-_ ]?to|share/i;

  it('has no operation path or operation ID with publish, post-to or share wording', () => {
    const offending = operations
      .filter(
        (operation) =>
          PUBLISH_WORDING.test(operation.path) || PUBLISH_WORDING.test(String(operation.operation.operationId)),
      )
      .map(label);
    expect(offending).toEqual([]);
  });

  it('detects such wording (the check is effective)', () => {
    expect(PUBLISH_WORDING.test('/carousels/{carouselId}/publish')).toBe(true);
    expect(PUBLISH_WORDING.test('postToNetwork')).toBe(true);
    expect(PUBLISH_WORDING.test('shareCarousel')).toBe(true);
  });
});

describe('approved editorial copy in an export (REVIEW-APPROVAL-01, amendment of PD-33)', () => {
  it('lists copy-editorial.txt as an export file of its own kind, with no element version', () => {
    const file = child(document, 'components', 'schemas', 'ExportFields', 'properties', 'files', 'items');
    expect(child(file, 'properties', 'kind').enum).toEqual([
      'slide_image',
      'caption_text',
      'manifest',
      'editorial_text',
    ]);
    const pattern = new RegExp(String(child(file, 'properties', 'fileName').pattern), 'u');
    for (const name of ['01.png', 'caption.txt', 'copy-editorial.txt', 'manifest.json']) {
      expect(pattern.test(name), name).toBe(true);
    }
    for (const name of ['copy.txt', 'copy-editorial.md', '../copy-editorial.txt', 'copy-editorial.txt.png']) {
      expect(pattern.test(name), name).toBe(false);
    }
    const parsed = ExportSchema.shape.files.element.safeParse({
      position: 4,
      fileName: 'copy-editorial.txt',
      kind: 'editorial_text',
      sha256: 'a'.repeat(64),
      elementVersionId: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('OD-26 visual-QA warning check', () => {
  it('adds capitalized_tokens as a warning QaResult variant with closed details', () => {
    const variants = child(document, 'components', 'schemas', 'QaResult').oneOf;
    expect(Array.isArray(variants)).toBe(true);
    const checks = (variants as JsonObject[]).map((variant) => child(variant, 'properties', 'check').const);
    expect(checks).toEqual([
      'data_match',
      'team_names',
      'text_fit',
      'style_consistency',
      'dimensions',
      'capitalized_tokens',
      'team_badges',
    ]);
    // capitalized_tokens (OD-26) and team_badges (PD-ARCH-01G-E.1) are warnings with closed details.
    for (const added of (variants as JsonObject[]).slice(5)) {
      expect(child(added, 'properties', 'severity').const).toBe('warning');
      expect(child(added, 'properties', 'details').additionalProperties).toBe(false);
      expect(added.additionalProperties).toBe(false);
    }
    const badges = (variants as JsonObject[])[6] as JsonObject;
    expect(child(badges, 'properties', 'details').required).toEqual(['emptyBadgeSlots']);
    expect(child(badges, 'properties', 'details', 'properties', 'emptyBadgeSlots', 'items').enum).toEqual([
      'team-badge-home',
      'team-badge-away',
    ]);
    // PD-ARCH-01G-E.2: the slots of a calendar's rows, optional and closed, each with its row.
    const rows = child(badges, 'properties', 'details', 'properties', 'emptyRowBadgeSlots');
    expect(rows.maxItems).toBe(128);
    expect(child(rows, 'items').required).toEqual(['row', 'slot']);
    expect(child(rows, 'items').additionalProperties).toBe(false);
    expect(child(rows, 'items', 'properties', 'slot').enum).toEqual(['team-badge-home', 'team-badge-away']);
  });

  it('accepts capitalized_tokens in the existing QA acknowledgement', () => {
    const body = child(
      document,
      'paths',
      '/carousels/{carouselId}/elements/{elementId}/qa-acknowledgements',
      'post',
      'requestBody',
      'content',
      'application/json',
      'schema',
    );
    expect(child(body, 'properties', 'checks', 'items').enum).toEqual([
      'style_consistency',
      'capitalized_tokens',
      'team_badges',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// V-29: the promoted contract equals the accepted proposal except info.version (and the recorded OD-26 addition)
// ---------------------------------------------------------------------------------------------------------------

/** A copy without `description` members and without `info.version`. */
function normative(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(normative);
  }
  if (isObject(value)) {
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key !== 'description') {
        result[key] = normative(entry);
      }
    }
    return result;
  }
  return value;
}

/** JSON-pointer-like paths at which two documents differ, with the kind of difference. */
function differences(left: JsonValue | undefined, right: JsonValue | undefined, path = ''): string[] {
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return [];
  }
  if (left === undefined) {
    return [`${path}: added`];
  }
  if (right === undefined) {
    return [`${path}: removed`];
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const result: string[] = [];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      result.push(...differences(left[index], right[index], `${path}/${String(index)}`));
    }
    return result;
  }
  if (isObject(left) && isObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    return keys.flatMap((key) =>
      differences(left[key], right[key], `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`),
    );
  }
  return [`${path}: changed`];
}

describe('promoted contract and accepted proposal (V-29, T10-F03, T10-F17)', () => {
  it('contains the recorded WI-2 deltas and local competition administration additions', async () => {
    const proposal = await loadDocument(PROPOSAL_PATH);
    expect(child(proposal, 'info').version).toBe('1.0.0-proposed.2');
    const promoted = structuredClone(document);
    const accepted = structuredClone(proposal);
    delete child(promoted, 'info').version;
    delete child(accepted, 'info').version;
    const ack = '/paths/~1carousels~1{carouselId}~1elements~1{elementId}~1qa-acknowledgements/post';
    expect(differences(normative(accepted), normative(promoted))).toEqual([
      '/tags/1/name: changed',
      '/tags/2/name: changed',
      '/tags/3/name: changed',
      '/tags/4/name: changed',
      '/tags/5/name: changed',
      '/tags/6/name: changed',
      '/tags/7/name: changed',
      '/tags/8/name: changed',
      '/tags/9/name: changed',
      '/tags/10/name: changed',
      '/tags/11: added',
      '/tags/12: added',
      '/tags/13: added',
      '/tags/14: added',
      // PD-ARCH-01H: editorial copy.
      '/tags/15: added',
      '/paths/~1projects~1{projectId}/delete: added',
      // UX-REVIEW-01: setExcludedMatches retired (Product Owner, 2026-11-10).
      '/paths/~1projects~1{projectId}~1draft~1exclusions: removed',
      `${ack}/requestBody/content/application~1json/schema/properties/checks/items/enum/1: added`,
      // PD-ARCH-01G-E.1: the team_badges warning (decision DE-E4).
      `${ack}/requestBody/content/application~1json/schema/properties/checks/items/enum/2: added`,
      '/paths/~1brand~1assets/post/parameters/3: added',
      '/paths/~1brand~1assets/post/parameters/4: added',
      '/paths/~1brand~1assets/post/parameters/5: added',
      '/paths/~1brand~1assets/post/parameters/6: added',
      '/paths/~1brand~1assets/post/parameters/7: added',
      '/paths/~1brand~1assets/post/parameters/8: added',
      '/paths/~1brand~1assets/post/requestBody/content/image~1webp: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/required: removed',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/properties/label: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/properties/usagePolicy: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/properties/official: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/properties/primary: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/properties/variant: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/properties/pose: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/properties/expression: added',
      '/paths/~1brand~1assets~1{assetId}/patch/requestBody/content/application~1json/schema/minProperties: added',
      '/paths/~1brand~1assets~1{assetId}/patch/responses/409: added',
      '/paths/~1brand~1assets~1{assetId}/get: added',
      '/paths/~1brand~1assets~1{assetId}/delete: added',
      '/paths/~1brand~1assets~1{assetId}~1file/get/responses/200/content/image~1webp: added',
      '/paths/~1competitions: added',
      '/paths/~1sports~1providers: added',
      '/paths/~1sports~1providers~1{providerKey}~1competitions: added',
      '/paths/~1competitions~1{competitionId}~1provider-binding: added',
      '/paths/~1competitions~1{competitionId}~1provider-binding~1seasons: added',
      '/paths/~1competitions~1{competitionId}~1provider-binding~1seasons~1{externalSeasonId}~1capabilities: added',
      '/paths/~1competitions~1{competitionId}~1import-operations: added',
      '/paths/~1competitions~1{competitionId}~1import-operations~1{operationId}: added',
      '/paths/~1competitions~1{competitionId}~1import-operations~1{operationId}~1cancel: added',
      '/paths/~1competitions~1{competitionId}~1import-operations~1{operationId}~1events: added',
      '/paths/~1competitions~1{competitionId}~1import-previews: added',
      '/paths/~1competitions~1{competitionId}~1import-previews~1{previewId}: added',
      '/paths/~1competitions~1{competitionId}~1import-previews~1{previewId}~1application-plan: added',
      '/paths/~1competitions~1{competitionId}~1import-previews~1{previewId}~1applications: added',
      '/paths/~1competitions~1{competitionId}~1import-applications~1{operationId}: added',
      '/paths/~1competitions~1{competitionId}~1import-applications~1{operationId}~1cancel: added',
      '/paths/~1competitions~1{competitionId}~1import-applications~1{operationId}~1events: added',
      '/paths/~1competitions~1{competitionId}: added',
      '/paths/~1competitions~1{competitionId}~1provenance~1{entityType}~1{entityId}: added',
      '/paths/~1competitions~1{competitionId}~1import-applications: added',
      '/paths/~1competitions~1{competitionId}~1seasons: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1stages: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1stages~1{stageId}: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1rounds: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1rounds~1{roundId}: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1stages~1{stageId}~1rounds: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1matches: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1matches~1{matchId}: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1matches~1{matchId}~1schedule: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1matches~1{matchId}~1result: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1matches~1{matchId}~1result-history: added',
      '/paths/~1competitions~1{competitionId}~1teams: added',
      '/paths/~1competitions~1{competitionId}~1teams~1{teamId}: added',
      '/paths/~1teams: added',
      '/paths/~1teams~1{teamId}: added',
      '/paths/~1teams~1{teamId}~1badge: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1participants: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1participants~1batch: added',
      '/paths/~1competitions~1{competitionId}~1seasons~1{seasonId}~1participants~1{teamId}: added',
      '/paths/~1content-batches~1previews: added',
      '/paths/~1content-batches: added',
      '/paths/~1content-batches~1{batchId}: added',
      '/paths/~1projects~1{projectId}~1editorial: added',
      '/paths/~1projects~1{projectId}~1editorial~1generations: added',
      '/paths/~1projects~1{projectId}~1editorial~1deliverables~1{deliverable}~1edits: added',
      '/paths/~1projects~1{projectId}~1editorial~1deliverables~1{deliverable}~1approval: added',
      '/paths/~1exports~1{exportId}~1download: added',
      '/paths/~1brand~1identity: added',
      '/paths/~1design~1capabilities: added',
      '/paths/~1design~1capabilities~1check: added',
      '/paths/~1design~1estimates: added',
      '/paths/~1design~1generations: added',
      '/paths/~1design~1generations~1{generationId}: added',
      '/paths/~1design~1generations~1{generationId}~1events: added',
      '/paths/~1design~1proposals: added',
      '/paths/~1design~1proposals~1{proposalId}: added',
      '/paths/~1design~1proposals~1{proposalId}~1file: added',
      '/paths/~1design~1proposals~1{proposalId}~1background: added',
      '/paths/~1design~1proposals~1{proposalId}~1decisions: added',
      '/paths/~1visual-templates: added',
      '/paths/~1visual-templates~1{templateId}: added',
      '/paths/~1visual-templates~1{templateId}~1archive: added',
      '/paths/~1visual-templates~1{templateId}~1restore: added',
      '/paths/~1visual-templates~1{templateId}~1versions: added',
      '/paths/~1visual-templates~1{templateId}~1versions~1{versionId}: added',
      '/paths/~1visual-templates~1{templateId}~1versions~1{versionId}~1release: added',
      '/paths/~1visual-templates~1{templateId}~1versions~1{versionId}~1background: added',
      '/paths/~1visual-templates~1{templateId}~1versions~1{versionId}~1previews: added',
      '/paths/~1visual-templates~1{templateId}~1versions~1{versionId}~1preview: added',
      '/components/parameters/EditorialDeliverable: added',
      '/components/parameters/GenerationId: added',
      '/components/parameters/ProposalId: added',
      '/components/parameters/VisualTemplateId: added',
      '/components/schemas/Problem/properties/code/enum/15: changed',
      '/components/schemas/Problem/properties/code/enum/16: changed',
      '/components/schemas/Problem/properties/code/enum/17: changed',
      '/components/schemas/Problem/properties/code/enum/18: changed',
      '/components/schemas/Problem/properties/code/enum/19: changed',
      '/components/schemas/Problem/properties/code/enum/20: changed',
      '/components/schemas/Problem/properties/code/enum/21: changed',
      '/components/schemas/Problem/properties/code/enum/22: added',
      '/components/schemas/Problem/properties/code/enum/23: added',
      '/components/schemas/Problem/properties/code/enum/24: added',
      '/components/schemas/Problem/properties/code/enum/25: added',
      '/components/schemas/Problem/properties/code/enum/26: added',
      '/components/schemas/Problem/properties/code/enum/27: added',
      '/components/schemas/Problem/properties/code/enum/28: added',
      '/components/schemas/Problem/properties/code/enum/29: added',
      '/components/schemas/Problem/properties/code/enum/30: added',
      '/components/schemas/Problem/properties/code/enum/31: added',
      '/components/schemas/Problem/properties/code/enum/32: added',
      '/components/schemas/Problem/properties/code/enum/33: added',
      '/components/schemas/Problem/properties/code/enum/34: added',
      '/components/schemas/Problem/properties/code/enum/35: added',
      '/components/schemas/Problem/properties/code/enum/36: added',
      '/components/schemas/Problem/properties/code/enum/37: added',
      '/components/schemas/Problem/properties/code/enum/38: added',
      '/components/schemas/Problem/properties/code/enum/39: added',
      '/components/schemas/Problem/properties/code/enum/40: added',
      '/components/schemas/Problem/properties/code/enum/41: added',
      '/components/schemas/Problem/properties/code/enum/42: added',
      '/components/schemas/Problem/properties/code/enum/43: added',
      '/components/schemas/Problem/properties/code/enum/44: added',
      '/components/schemas/Problem/properties/code/enum/45: added',
      '/components/schemas/Problem/properties/code/enum/46: added',
      '/components/schemas/Problem/properties/code/enum/47: added',
      '/components/schemas/Problem/properties/code/enum/48: added',
      '/components/schemas/Problem/properties/code/enum/49: added',
      '/components/schemas/Problem/properties/code/enum/50: added',
      '/components/schemas/Problem/properties/code/enum/51: added',
      '/components/schemas/ProjectSummaryFields/required/13: added',
      '/components/schemas/ProjectSummaryFields/required/14: added',
      '/components/schemas/ProjectSummaryFields/properties/latestRunStatus: added',
      '/components/schemas/ProjectSummaryFields/properties/sportsContext: added',
      '/components/schemas/Project/allOf/1/required/6: added',
      '/components/schemas/Project/allOf/1/properties/visualTemplates: added',
      // PD-ARCH-01E-B: matches not played yet (calendar, upcoming matches and previews).
      '/components/schemas/LeftOutMatch/properties/reason/enum/3: added',
      '/components/schemas/LeftOutMatch/properties/reason/enum/4: added',
      '/components/schemas/Element/properties/slideType/enum/4: changed',
      '/components/schemas/Element/properties/slideType/enum/5: added',
      '/components/schemas/Element/properties/slideType/enum/6: added',
      '/components/schemas/Element/properties/slideType/enum/7: added',
      '/components/schemas/TextField/properties/field/enum/12: added',
      '/components/schemas/TextField/properties/field/enum/13: added',
      '/components/schemas/TextField/properties/field/enum/14: added',
      '/components/schemas/TextField/properties/field/enum/15: added',
      '/components/schemas/TextField/properties/field/enum/16: added',
      '/components/schemas/ContentFlag/properties/code/enum/4: added',
      '/components/schemas/QaResult/oneOf/5: added',
      // PD-ARCH-01G-E.1: the team_badges warning variant (decision DE-E4).
      '/components/schemas/QaResult/oneOf/6: added',
      // REVIEW-APPROVAL-01 (amendment of PD-33): the approved editorial copy in the export.
      '/components/schemas/ExportFields/properties/files/items/properties/fileName/pattern: changed',
      '/components/schemas/ExportFields/properties/files/items/properties/kind/enum/3: added',
      '/components/schemas/BrandAssetKind/enum/3: added',
      '/components/schemas/BrandAssetKind/enum/4: added',
      '/components/schemas/BrandAsset/required/3: changed',
      '/components/schemas/BrandAsset/required/4: changed',
      '/components/schemas/BrandAsset/required/5: changed',
      '/components/schemas/BrandAsset/required/6: changed',
      '/components/schemas/BrandAsset/required/7: changed',
      '/components/schemas/BrandAsset/required/8: changed',
      '/components/schemas/BrandAsset/required/9: added',
      '/components/schemas/BrandAsset/required/10: added',
      '/components/schemas/BrandAsset/required/11: added',
      '/components/schemas/BrandAsset/required/12: added',
      '/components/schemas/BrandAsset/required/13: added',
      '/components/schemas/BrandAsset/required/14: added',
      '/components/schemas/BrandAsset/required/15: added',
      '/components/schemas/BrandAsset/required/16: added',
      '/components/schemas/BrandAsset/required/17: added',
      '/components/schemas/BrandAsset/properties/mime/enum/2: added',
      '/components/schemas/BrandAsset/properties/byteSize: added',
      '/components/schemas/BrandAsset/properties/usagePolicy: added',
      '/components/schemas/BrandAsset/properties/official: added',
      '/components/schemas/BrandAsset/properties/primary: added',
      '/components/schemas/BrandAsset/properties/variant: added',
      '/components/schemas/BrandAsset/properties/pose: added',
      '/components/schemas/BrandAsset/properties/expression: added',
      '/components/schemas/BrandAsset/properties/updatedAt: added',
      '/components/schemas/Template/properties/slideType/enum/4: added',
      '/components/schemas/Template/properties/slideType/enum/5: added',
      '/components/schemas/Template/properties/slideType/enum/6: added',
      '/components/schemas/Competition: added',
      '/components/schemas/SportsProvider: added',
      '/components/schemas/ExternalCompetition: added',
      '/components/schemas/CompetitionProviderBinding: added',
      '/components/schemas/CompetitionProviderBindingResponse: added',
      '/components/schemas/ImportResource: added',
      '/components/schemas/ExternalSeasonId: added',
      '/components/schemas/ExternalSeasonOption: added',
      '/components/schemas/ExternalSeasonListResponse: added',
      '/components/schemas/ImportResourceCapability: added',
      '/components/schemas/ImportCapabilitiesResponse: added',
      '/components/schemas/ImportOperation: added',
      '/components/schemas/ImportOperationResponse: added',
      '/components/schemas/ImportOperationStartResponse: added',
      '/components/schemas/ImportPreviewRequest: added',
      '/components/schemas/ImportPreviewItem: added',
      '/components/schemas/ImportPreviewSummary: added',
      '/components/schemas/ImportExternalReference: added',
      '/components/schemas/ImportPreviewWarning: added',
      '/components/schemas/ImportPreview: added',
      '/components/schemas/ImportPreviewResponse: added',
      '/components/schemas/ImportApplyDecision: added',
      '/components/schemas/ImportApplyPlanRequest: added',
      '/components/schemas/ImportApplyStartRequest: added',
      '/components/schemas/ImportApplyCounts: added',
      '/components/schemas/ImportApplyPlanItem: added',
      '/components/schemas/ImportApplyBlocker: added',
      '/components/schemas/ImportApplyPlan: added',
      '/components/schemas/ImportApplyPlanResponse: added',
      '/components/schemas/ImportApplication: added',
      '/components/schemas/ImportApplyOperation: added',
      '/components/schemas/ImportApplyOperationResponse: added',
      '/components/schemas/ImportApplyOperationStartResponse: added',
      '/components/schemas/SportsFieldProvenance: added',
      '/components/schemas/SportsFieldProvenanceResponse: added',
      '/components/schemas/ImportApplicationHistoryResponse: added',
      '/components/schemas/ManagedSeason: added',
      '/components/schemas/TeamBadge: added',
      '/components/schemas/ManagedTeam: added',
      '/components/schemas/CompetitionTeam: added',
      '/components/schemas/SeasonParticipant: added',
      '/components/schemas/CompetitionStage: added',
      '/components/schemas/CompetitionRound: added',
      '/components/schemas/CompetitionMatchStatus: added',
      '/components/schemas/CompetitionMatch: added',
      '/components/schemas/MatchResultHistory: added',
      '/components/schemas/ProjectSportsContext: added',
      '/components/schemas/ContentBatchSelection: added',
      '/components/schemas/ContentBatchCreate: added',
      '/components/schemas/ContentBatchContext: added',
      '/components/schemas/ContentBatchMatch: added',
      '/components/schemas/ContentPiecePlan: added',
      '/components/schemas/ContentBatchPreview: added',
      '/components/schemas/ContentBatchItem: added',
      '/components/schemas/ContentBatch: added',
      '/components/schemas/BrandAssetUsagePolicy: added',
      '/components/schemas/BrandAssetUsage: added',
      '/components/schemas/BrandAssetDetail: added',
      '/components/schemas/BrandIdentity: added',
      '/components/schemas/DesignMode: added',
      '/components/schemas/DesignContentType: added',
      '/components/schemas/DesignFormat: added',
      '/components/schemas/DesignReferenceRole: added',
      '/components/schemas/DesignGenerationStatus: added',
      '/components/schemas/DesignProposalStatus: added',
      '/components/schemas/DesignGenerationErrorCode: added',
      '/components/schemas/EditorialDeliverable: added',
      '/components/schemas/EditorialField: added',
      '/components/schemas/EditorialFlag: added',
      '/components/schemas/EditorialEvidence: added',
      '/components/schemas/EditorialEvent: added',
      '/components/schemas/EditorialContext: added',
      '/components/schemas/EditorialWriter: added',
      '/components/schemas/EditorialVersion: added',
      '/components/schemas/EditorialGeneration: added',
      '/components/schemas/EditorialPackage: added',
      '/components/schemas/EditorialGenerationCreate: added',
      '/components/schemas/EditorialGenerationResult: added',
      '/components/schemas/EditorialEditCreate: added',
      '/components/schemas/DesignPricing: added',
      '/components/schemas/DesignModel: added',
      '/components/schemas/DesignCapabilities: added',
      '/components/schemas/DesignGenerationInput: added',
      '/components/schemas/DesignGenerationCreate: added',
      '/components/schemas/DesignReference: added',
      '/components/schemas/DesignCostEstimate: added',
      '/components/schemas/DesignEstimate: added',
      '/components/schemas/DesignGeneration: added',
      '/components/schemas/DesignGenerationEvent: added',
      '/components/schemas/DesignProposal: added',
      '/components/schemas/DesignProposalDetail: added',
      '/components/schemas/VisualTemplateStatus: added',
      '/components/schemas/VisualTemplateVersionStatus: added',
      '/components/schemas/VisualTemplateBinding: added',
      '/components/schemas/VisualTemplateTextEffect: added',
      '/components/schemas/VisualTemplateTextStyle: added',
      '/components/schemas/VisualTemplateImageFit: added',
      '/components/schemas/VisualTemplateTextLayer: added',
      '/components/schemas/VisualTemplateSportsDataLayer: added',
      '/components/schemas/VisualTemplateImageLayer: added',
      '/components/schemas/VisualTemplateBrandAssetLayer: added',
      '/components/schemas/VisualTemplateContentType: added',
      '/components/schemas/VisualTemplateBadgeBinding: added',
      '/components/schemas/VisualTemplateTeamBadgeLayer: added',
      // PD-ARCH-01G-E.2: the match list of a round calendar.
      '/components/schemas/VisualTemplateFixtureRowBadge: added',
      '/components/schemas/VisualTemplateFixtureRowText: added',
      '/components/schemas/VisualTemplateFixtureListLayer: added',
      '/components/schemas/VisualTemplateLayer: added',
      '/components/schemas/VisualTemplateBackgroundSource: added',
      '/components/schemas/VisualTemplateBackgroundInput: added',
      '/components/schemas/VisualTemplateBackground: added',
      '/components/schemas/VisualTemplateAssetRef: added',
      '/components/schemas/VisualTemplateIssueCode: added',
      '/components/schemas/VisualTemplateIssue: added',
      '/components/schemas/VisualTemplateValidation: added',
      '/components/schemas/VisualTemplate: added',
      '/components/schemas/VisualTemplateVersionSummary: added',
      '/components/schemas/VisualTemplateDetail: added',
      '/components/schemas/VisualTemplateVersion: added',
      '/components/schemas/VisualTemplateVersionRef: added',
      '/components/schemas/VisualTemplateUsage: added',
      '/components/schemas/VisualTemplateCreate: added',
      '/components/schemas/VisualTemplateUpdate: added',
      '/components/schemas/VisualTemplateVersionSave: added',
      '/components/schemas/VisualTemplateVersionCreate: added',
      '/components/schemas/VisualTemplatePublish: added',
      '/components/schemas/VisualTemplatePreviewSelection: added',
      '/components/schemas/VisualTemplatePreviewRequest: added',
      '/components/schemas/VisualTemplatePreview: added',
    ]);
  });

  it('finds a change outside those (the comparison is effective)', async () => {
    const proposal = await loadDocument(PROPOSAL_PATH);
    const changed = structuredClone(proposal);
    child(changed, 'components', 'schemas', 'Uuid').maxLength = 37;
    expect(differences(normative(proposal), normative(changed))).toEqual([
      '/components/schemas/Uuid/maxLength: changed',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Closed per-kind fact values and per-check QA details (T10-F17)
// ---------------------------------------------------------------------------------------------------------------

describe('closed fact values and QA details (T10-F17)', () => {
  it('closes every fact value schema, every context item variant and every QA check variant with its details', () => {
    const schemas = child(document, 'components', 'schemas');
    const values = [
      'MatchTeamsValue',
      'MatchKickoffValue',
      'MatchStatusValue',
      'MatchScoreValue',
      'StandingRowValue',
      'MatchdayInfoValue',
      'TeamOfficialNameValue',
    ];
    for (const name of values) {
      expect(child(schemas, name).additionalProperties, name).toBe(false);
    }
    for (const variant of child(schemas, 'ContextItemValue').oneOf as JsonObject[]) {
      expect(variant.additionalProperties).toBe(false);
    }
    const kinds = (child(schemas, 'FactKindValue').oneOf as JsonObject[]).map(
      (variant) => child(variant, 'properties', 'kind').const,
    );
    expect(kinds).toEqual(child(schemas, 'FactKind').enum);
    expect(child(schemas, 'Fact').unevaluatedProperties).toBe(false);
    for (const variant of child(schemas, 'QaResult').oneOf as JsonObject[]) {
      const check = String(child(variant, 'properties', 'check').const);
      expect(variant.additionalProperties, check).toBe(false);
      expect(child(variant, 'properties', 'details').additionalProperties, check).toBe(false);
    }
  });
});
