/**
 * Brand asset registry (architecture.md section 4 `modules/brand`; R-033, R-034, R-228, R-231; PD-03, PD-10, PD-15,
 * OD-07, OD-08; T10-F12, T10-F13).
 *
 * Registration order (each step refuses before the next one runs):
 * 1. the body is present and within the 5 MiB cap (the route limit refuses larger bodies before they are read);
 * 2. the file signature is PNG or JPEG (415 otherwise: SVG, GIF, text and renamed files are refused);
 * 3. the declared `Content-Type` equals the detected type (415 otherwise);
 * 4. the header is well formed and the dimensions are at most 4096 x 4096 (400), read without decoding;
 * 5. no asset with the same SHA-256 exists (409 `DUPLICATE_ASSET`);
 * 6. the image decodes with resvg, the renderer's decoder (400 otherwise);
 * 7. the file is written under a generated name with the exclusive flag, then the row is inserted in one
 *    transaction that repeats the duplicate check. The new asset is active, so every later project's templates can
 *    use it (R-228).
 *
 * Kinds are `brand_logo`, `mascot` and `decoration` only: no badge or competition-mark kind exists (PD-03, R-049,
 * R-050, R-231). Assets are never deleted; they are activated or deactivated (OD-08).
 */
import { createHash, randomUUID } from 'node:crypto';

import type { BrandAsset, BrandAssetKind, BrandAssetMime } from '@edr/contracts';

import type { Clock } from '../../container.js';
import { BRAND_UPLOAD_BODY_LIMIT, HttpProblem } from '../../platform/http/index.js';

import type { ImageDecodeCheck } from './decode.js';
import { MAX_IMAGE_DIMENSION, detectImageType, readImageHeader } from './image.js';
import { type BrandAssetRecord, type BrandAssetRepository, toBrandAsset } from './repository.js';
import { type BrandFileStore, brandRelativePath } from './storage.js';

/** A registration request after query validation. */
export interface RegisterBrandAsset {
  readonly kind: BrandAssetKind;
  readonly label: string;
  /** The declared body media type (lowercase, without parameters), or null. */
  readonly declaredMediaType: string | null;
  /** The request body as parsed by the platform (a Buffer for the image media types). */
  readonly content: unknown;
}

/** A registered asset with its verified file content. */
export interface BrandAssetFile {
  readonly asset: BrandAsset;
  readonly content: Buffer;
}

export interface BrandAssetServiceDeps {
  readonly repository: BrandAssetRepository;
  readonly files: BrandFileStore;
  readonly clock: Clock;
  readonly decodeCheck: ImageDecodeCheck;
  /** ID generator; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

/** A stored file whose bytes no longer match the recorded hash; a server defect (500 `INTERNAL`). */
export class BrandFileIntegrityError extends Error {
  override readonly name = 'BrandFileIntegrityError';

  constructor() {
    super('a brand file does not match its recorded hash');
  }
}

export const brandProblems = {
  emptyBody: (): HttpProblem => new HttpProblem(400, 'VALIDATION_FAILED', 'The request body must contain the image.'),
  notAnImage: (): HttpProblem =>
    new HttpProblem(415, 'UNSUPPORTED_MEDIA_TYPE', 'The file is not a PNG or JPEG image (file signature).'),
  typeMismatch: (): HttpProblem =>
    new HttpProblem(415, 'UNSUPPORTED_MEDIA_TYPE', 'The declared Content-Type does not match the file signature.'),
  headerInvalid: (): HttpProblem => new HttpProblem(400, 'VALIDATION_FAILED', 'The image header is not valid.'),
  tooLarge: (): HttpProblem =>
    new HttpProblem(
      400,
      'VALIDATION_FAILED',
      `The image exceeds ${String(MAX_IMAGE_DIMENSION)} x ${String(MAX_IMAGE_DIMENSION)} pixels.`,
    ),
  notDecodable: (): HttpProblem =>
    new HttpProblem(400, 'VALIDATION_FAILED', 'The image cannot be decoded (corrupt, unsupported or empty).'),
  duplicate: (existingId: string): HttpProblem =>
    new HttpProblem(409, 'DUPLICATE_ASSET', `An asset with the same content is already registered: ${existingId}.`),
  notFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The brand asset does not exist.'),
  payloadTooLarge: (): HttpProblem =>
    new HttpProblem(413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds the limit of this operation.'),
};

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

class DuplicateInTransaction extends Error {
  constructor(readonly existingId: string) {
    super('duplicate');
  }
}

export class BrandAssetService {
  readonly #repository: BrandAssetRepository;
  readonly #files: BrandFileStore;
  readonly #clock: Clock;
  readonly #decodeCheck: ImageDecodeCheck;
  readonly #newId: () => string;

  constructor(deps: BrandAssetServiceDeps) {
    this.#repository = deps.repository;
    this.#files = deps.files;
    this.#clock = deps.clock;
    this.#decodeCheck = deps.decodeCheck;
    this.#newId = deps.newId ?? randomUUID;
  }

  /** Every registered asset in registration order (R-033). */
  list(): BrandAsset[] {
    return this.#repository.list().map(toBrandAsset);
  }

  /** The active assets of a kind in registration order, for the renderer (R-034, R-228). */
  activeByKind(kind: BrandAssetKind): BrandAsset[] {
    return this.#repository.activeByKind(kind).map(toBrandAsset);
  }

  /** Registers an operator-supplied PNG or JPEG brand file (see the module comment for the order of checks). */
  async register(request: RegisterBrandAsset): Promise<BrandAsset> {
    const { content } = request;
    if (!Buffer.isBuffer(content) || content.length === 0) {
      throw brandProblems.emptyBody();
    }
    if (content.length > BRAND_UPLOAD_BODY_LIMIT) {
      throw brandProblems.payloadTooLarge();
    }
    const detected = detectImageType(content);
    if (detected === null) {
      throw brandProblems.notAnImage();
    }
    if (request.declaredMediaType !== detected) {
      throw brandProblems.typeMismatch();
    }
    const inspected = readImageHeader(content, detected);
    if (!inspected.ok) {
      throw inspected.reason === 'dimensions_too_large' ? brandProblems.tooLarge() : brandProblems.headerInvalid();
    }
    const hash = sha256(content);
    const existing = this.#repository.idBySha256(hash);
    if (existing !== null) {
      throw brandProblems.duplicate(existing);
    }
    if (!(await this.#decodeCheck(content, inspected.header))) {
      throw brandProblems.notDecodable();
    }

    const id = this.#newId();
    const mime: BrandAssetMime = inspected.header.mime;
    const filePath = await this.#files.create(id, mime, content);
    try {
      return this.#repository.transaction(() => {
        const concurrent = this.#repository.idBySha256(hash);
        if (concurrent !== null) {
          throw new DuplicateInTransaction(concurrent);
        }
        this.#repository.insert({
          id,
          kind: request.kind,
          label: request.label,
          mime,
          filePath,
          sha256: hash,
          width: inspected.header.width,
          height: inspected.header.height,
          registeredAt: this.#clock.now().toISOString(),
        });
        return toBrandAsset(this.#require(id));
      });
    } catch (error) {
      await this.#files.discardUnregistered(id, mime);
      throw error instanceof DuplicateInTransaction ? brandProblems.duplicate(error.existingId) : error;
    }
  }

  /** Activates or deactivates an asset for future renders (OD-08: no deletion). Idempotent. */
  setActive(id: string, active: boolean): BrandAsset {
    return this.#repository.transaction(() => {
      const record = this.#repository.get(id);
      if (record === null) {
        throw brandProblems.notFound();
      }
      if (record.active !== active) {
        this.#repository.setActive(id, active, active ? null : this.#clock.now().toISOString());
      }
      return toBrandAsset(this.#require(id));
    });
  }

  /**
   * The stored file of an asset, read from the path built from the validated ID and MIME type, confined to the
   * brand directory and checked against the recorded SHA-256.
   */
  async readFile(id: string): Promise<BrandAssetFile> {
    const record = this.#repository.get(id);
    if (record === null) {
      throw brandProblems.notFound();
    }
    if (record.filePath !== brandRelativePath(record.id, record.mime)) {
      throw new BrandFileIntegrityError();
    }
    const content = await this.#files.read(record.id, record.mime);
    if (sha256(content) !== record.sha256) {
      throw new BrandFileIntegrityError();
    }
    return { asset: toBrandAsset(record), content };
  }

  #require(id: string): BrandAssetRecord {
    const record = this.#repository.get(id);
    if (record === null) {
      throw brandProblems.notFound();
    }
    return record;
  }
}
