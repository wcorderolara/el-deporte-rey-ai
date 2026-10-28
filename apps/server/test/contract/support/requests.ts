/**
 * Well-formed requests of every contract operation for the protection and validation tests: path parameters of the
 * right shape that name nothing, the contract request sample as the body, a synthetic PNG for the brand upload and the
 * required query parameters. All values are synthetic.
 */
import { deflateSync } from 'node:zlib';

import type { OperationId } from '@edr/contracts';

import { requestSamples } from './samples.js';
import { type CallOptions, type ContractSpec, wellFormedParams } from './served.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC-32 of a PNG chunk (type and data). */
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** A synthetic 8-bit RGBA PNG of one colour; `note` makes otherwise equal images differ. */
export function syntheticPng(width = 8, height = 8, note = 'contract'): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      raw.writeUInt32BE(0x5b2a86ff, y * stride + 1 + x * 4);
    }
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('tEXt', Buffer.from(`Comment\u0000${note}`, 'latin1')),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The contract operation IDs in document order, listed statically so that `describe.each` can enumerate them before
 * the contract is loaded; a test checks the list against the document.
 */
export const OPERATION_IDS = [
  'getHealth',
  'getSettings',
  'listCompetitions',
  'listSeasons',
  'listStages',
  'listProjects',
  'createProject',
  'getProject',
  'updateProject',
  'listRuns',
  'startRun',
  'getRun',
  'listFacts',
  'approveFactManually',
  'revokeManualFactApproval',
  'getActiveDraft',
  'setExcludedMatches',
  'getSlideImage',
  'regenerateElement',
  'approveElement',
  'withdrawElementApproval',
  'acknowledgeQaWarnings',
  'approveCarousel',
  'exportCarousel',
  'listProjectExports',
  'getExport',
  'traceExportedSlide',
  'listImports',
  'createImport',
  'getImport',
  'getImportOriginal',
  'listManualSelections',
  'getManualVersion',
  'listBrandAssets',
  'registerBrandAsset',
  'updateBrandAsset',
  'getBrandAssetFile',
  'listTemplates',
  'previewTemplate',
] as const;

/** Required query parameters of the operations that have them. */
export const VALID_QUERY: Partial<Record<OperationId, Record<string, string>>> = {
  listManualSelections: { competitionId: 'sin-registro', seasonId: '2026' },
  registerBrandAsset: { kind: 'decoration', label: 'Adorno de prueba' },
};

/** A well-formed request of an operation (it may still answer 404 or 409: the IDs name nothing). */
export function validRequest(spec: ContractSpec, operationId: string): CallOptions {
  const id = operationId as OperationId;
  const query = VALID_QUERY[id];
  const base: CallOptions = {
    params: wellFormedParams(spec, operationId),
    ...(query === undefined ? {} : { query }),
  };
  if (!spec.hasBody(operationId)) {
    return base;
  }
  if (operationId === 'registerBrandAsset') {
    return { ...base, payload: syntheticPng(), contentType: 'image/png' };
  }
  const sample = requestSamples[id];
  if (sample === undefined) {
    throw new Error(`no request sample for ${operationId}`);
  }
  return { ...base, json: sample };
}

/** Route body limits (body.ts): 64 KiB by default, 1.5 MiB for imports, 5 MiB for the brand upload. */
export const BODY_LIMITS: Partial<Record<OperationId, number>> & { readonly default: number } = {
  default: 64 * 1024,
  createImport: 1536 * 1024,
  registerBrandAsset: 5 * 1024 * 1024,
};

/** A body one byte over the route limit, in the route's own media type. */
export function oversizedRequest(spec: ContractSpec, operationId: string): CallOptions {
  const limit = BODY_LIMITS[operationId as OperationId] ?? BODY_LIMITS.default;
  const base = validRequest(spec, operationId);
  if (operationId === 'registerBrandAsset') {
    const png = syntheticPng();
    return { ...base, payload: Buffer.concat([png, Buffer.alloc(limit + 1 - png.length)]), contentType: 'image/png' };
  }
  const prefix = '{"padding":"';
  const suffix = '"}';
  const padding = 'a'.repeat(limit + 1 - prefix.length - suffix.length);
  const { json: _json, ...rest } = base;
  return { ...rest, payload: `${prefix}${padding}${suffix}`, contentType: 'application/json' };
}
