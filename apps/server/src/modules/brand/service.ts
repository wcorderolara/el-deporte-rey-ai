/**
 * Brand library (architecture.md section 4 `modules/brand`; R-033, R-034, R-228, R-231; PD-03, PD-10, PD-15, OD-07,
 * OD-08; T10-F12, T10-F13; PD-ARCH-01G-A).
 *
 * Registration order (each step refuses before the next one runs):
 * 1. the body is present and within the 5 MiB cap (the route limit refuses larger bodies before they are read);
 * 2. the file signature is PNG, JPEG or WebP (415 otherwise: SVG, GIF, fonts, text and renamed files are refused);
 * 3. the declared `Content-Type` equals the detected type (415 otherwise);
 * 4. the metadata rules hold (400): WebP only for style references, a style reference is `reference_only`, pose and
 *    expression only for the mascot;
 * 5. the header is well formed and the dimensions are at most 4096 x 4096 (400), read without decoding; a WebP file
 *    is also checked as a RIFF container;
 * 6. no library asset with the same SHA-256 exists (409 `DUPLICATE_ASSET`); a deleted asset with the same content is
 *    restored with the new metadata instead (its preserved file is the same);
 * 7. a PNG or JPEG decodes with resvg, the renderer's decoder (400 otherwise);
 * 8. the file is written under a generated name with the exclusive flag, then the row is inserted in one
 *    transaction that repeats the duplicate check. The new asset is active and not primary.
 *
 * The usage policy defaults by category (`protected` logos and mascot, `reference_only` style references, `reusable`
 * otherwise); `transformable` is only ever set explicitly. The renderer draws the primary logo and mascot; without a
 * primary it keeps the former rule (the most recently registered active asset), and it never draws a style reference
 * or a `reference_only` asset. Assets are never removed (OD-08): a deletion is logical and refused while a rendered
 * slide version uses the asset.
 */
import { createHash, randomUUID } from 'node:crypto';

import type {
  BrandAsset,
  BrandAssetDetail,
  BrandAssetKind,
  BrandAssetMime,
  BrandAssetUsagePolicy,
} from '@edr/contracts';

import type { Clock } from '../../container.js';
import { BRAND_UPLOAD_BODY_LIMIT, HttpProblem } from '../../platform/http/index.js';

import type { ImageDecodeCheck } from './decode.js';
import { MAX_IMAGE_DIMENSION, detectImageType, readImageHeader } from './image.js';
import {
  type BrandAssetMetadata,
  type BrandAssetRecord,
  type BrandAssetRepository,
  toBrandAsset,
} from './repository.js';
import { type BrandFileStore, brandRelativePath } from './storage.js';

/** The optional metadata of a registration. */
export interface BrandAssetRegistrationMetadata {
  readonly description?: string | undefined;
  readonly usagePolicy?: BrandAssetUsagePolicy | undefined;
  readonly official?: boolean | undefined;
  readonly variant?: string | undefined;
  readonly pose?: string | undefined;
  readonly expression?: string | undefined;
}

/** A registration request after query validation. */
export interface RegisterBrandAsset extends BrandAssetRegistrationMetadata {
  readonly kind: BrandAssetKind;
  readonly label: string;
  /** The declared body media type (lowercase, without parameters), or null. */
  readonly declaredMediaType: string | null;
  /** The request body as parsed by the platform (a Buffer for the image media types). */
  readonly content: unknown;
}

/** An update request after body validation (absent fields keep their value; null clears a nullable field). */
export interface UpdateBrandAsset {
  readonly active?: boolean | undefined;
  readonly label?: string | undefined;
  readonly description?: string | null | undefined;
  readonly usagePolicy?: BrandAssetUsagePolicy | undefined;
  readonly official?: boolean | undefined;
  readonly primary?: boolean | undefined;
  readonly variant?: string | null | undefined;
  readonly pose?: string | null | undefined;
  readonly expression?: string | null | undefined;
}

/** An asset the renderer can draw: PNG or JPEG (resvg decodes both). */
export type DrawableBrandAsset = BrandAsset & { readonly mime: 'image/png' | 'image/jpeg' };

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
    new HttpProblem(415, 'UNSUPPORTED_MEDIA_TYPE', 'The file is not a PNG, JPEG or WebP image (file signature).'),
  typeMismatch: (): HttpProblem =>
    new HttpProblem(415, 'UNSUPPORTED_MEDIA_TYPE', 'The declared Content-Type does not match the file signature.'),
  webpNotAllowed: (): HttpProblem =>
    new HttpProblem(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'WebP is accepted for style references only; the renderer cannot draw it.',
    ),
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
  rule: (detail: string): HttpProblem => new HttpProblem(400, 'VALIDATION_FAILED', detail),
  inUse: (versions: number, projects: number, exports: number): HttpProblem =>
    new HttpProblem(
      409,
      'ASSET_IN_USE',
      `The asset is drawn by ${String(versions)} rendered slide versions of ${String(projects)} projects ` +
        `(${String(exports)} exports); deactivate it instead.`,
    ),
};

/** The usage policy of a category when none is given (`transformable` is never a default). */
export const DEFAULT_USAGE_POLICY: Readonly<Record<BrandAssetKind, BrandAssetUsagePolicy>> = Object.freeze({
  brand_logo: 'protected',
  mascot: 'protected',
  decoration: 'reusable',
  background: 'reusable',
  style_reference: 'reference_only',
});

/** The kinds the renderer draws in an image slot, and so the kinds that can be primary. */
export const PRIMARY_KINDS: ReadonlySet<BrandAssetKind> = new Set(['brand_logo', 'mascot']);

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/** The metadata rules of PD-ARCH-01G-A; null when they hold, otherwise the fixed reason. */
function metadataRefusal(
  kind: BrandAssetKind,
  policy: BrandAssetUsagePolicy,
  values: { readonly pose: string | null; readonly expression: string | null; readonly primary: boolean },
  active: boolean,
): string | null {
  if (kind === 'style_reference' && policy !== 'reference_only') {
    return 'A style reference is reference_only: it is never placed in content.';
  }
  if (kind !== 'mascot' && (values.pose !== null || values.expression !== null)) {
    return 'Pose and expression describe the mascot only.';
  }
  if (values.primary && !PRIMARY_KINDS.has(kind)) {
    return 'Only a logo or the mascot can be primary.';
  }
  if (values.primary && (!active || policy === 'reference_only')) {
    return 'The primary asset must be active and drawable (not reference_only).';
  }
  return null;
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

  /** Every asset of the library (deleted ones left out) in registration order (R-033). */
  list(): BrandAsset[] {
    return this.#repository.list().map(toBrandAsset);
  }

  /** The active assets of a kind in registration order (R-034, R-228). */
  activeByKind(kind: BrandAssetKind): BrandAsset[] {
    return this.#repository.activeByKind(kind).map(toBrandAsset);
  }

  /**
   * The assets the renderer may draw in the slot of a kind, the one to draw last (the renderer takes the last): the
   * active, drawable assets (PNG or JPEG, not `reference_only`) in registration order, with the primary moved to the
   * end. Without a primary, the most recently registered one is drawn, as before PD-ARCH-01G-A.
   */
  drawableByKind(kind: BrandAssetKind): DrawableBrandAsset[] {
    if (!PRIMARY_KINDS.has(kind)) {
      return [];
    }
    const drawable = this.activeByKind(kind).filter(
      (asset): asset is DrawableBrandAsset => asset.usagePolicy !== 'reference_only' && asset.mime !== 'image/webp',
    );
    return [...drawable.filter((asset) => !asset.primary), ...drawable.filter((asset) => asset.primary)];
  }

  /** An asset of the library with its usage; 404 for an unknown or deleted asset. */
  detail(id: string): BrandAssetDetail {
    const record = this.#library(id);
    return { asset: toBrandAsset(record), usage: this.#repository.usage(id) };
  }

  /** Registers an operator-supplied brand file (see the module comment for the order of checks). */
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
    if (detected === 'image/webp' && request.kind !== 'style_reference') {
      throw brandProblems.webpNotAllowed();
    }
    const policy = request.usagePolicy ?? DEFAULT_USAGE_POLICY[request.kind];
    const values = {
      description: request.description ?? null,
      official: request.official ?? false,
      variant: request.variant ?? null,
      pose: request.pose ?? null,
      expression: request.expression ?? null,
    };
    const refusal = metadataRefusal(request.kind, policy, { ...values, primary: false }, true);
    if (refusal !== null) {
      throw brandProblems.rule(refusal);
    }
    const inspected = readImageHeader(content, detected);
    if (!inspected.ok) {
      throw inspected.reason === 'dimensions_too_large' ? brandProblems.tooLarge() : brandProblems.headerInvalid();
    }
    const hash = sha256(content);
    const existing = this.#repository.bySha256(hash);
    if (existing !== null && existing.deletedAt === null) {
      throw brandProblems.duplicate(existing.id);
    }
    if (existing !== null) {
      return this.#restore(existing, { kind: request.kind, label: request.label, usagePolicy: policy, ...values });
    }
    if (detected !== 'image/webp' && !(await this.#decodeCheck(content, inspected.header))) {
      throw brandProblems.notDecodable();
    }

    const id = this.#newId();
    const mime: BrandAssetMime = inspected.header.mime;
    const filePath = await this.#files.create(id, mime, content);
    try {
      return this.#repository.transaction(() => {
        const concurrent = this.#repository.bySha256(hash);
        if (concurrent !== null) {
          throw new DuplicateInTransaction(concurrent.id);
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
          byteSize: content.length,
          usagePolicy: policy,
          registeredAt: this.#now(),
          ...values,
        });
        return toBrandAsset(this.#require(id));
      });
    } catch (error) {
      await this.#files.discardUnregistered(id, mime);
      throw error instanceof DuplicateInTransaction ? brandProblems.duplicate(error.existingId) : error;
    }
  }

  /** Activates or deactivates an asset for future renders. Idempotent. */
  setActive(id: string, active: boolean): BrandAsset {
    return this.update(id, { active });
  }

  /**
   * Edits the metadata, usage policy, marks or state of an asset; the file never changes. Deactivating the primary
   * asset, or making it `reference_only`, clears the primary mark; marking an asset primary moves the mark from the
   * previous primary of its kind.
   */
  update(id: string, patch: UpdateBrandAsset): BrandAsset {
    if (Object.values(patch).every((value) => value === undefined)) {
      throw brandProblems.rule('The request changes nothing: give at least one field.');
    }
    return this.#repository.transaction(() => {
      const record = this.#library(id);
      const active = patch.active ?? record.active;
      const usagePolicy = patch.usagePolicy ?? record.usagePolicy;
      const keepsPrimary = record.primary && active && usagePolicy !== 'reference_only';
      const metadata: BrandAssetMetadata = {
        kind: record.kind,
        label: patch.label ?? record.label,
        description: patch.description === undefined ? record.description : patch.description,
        usagePolicy,
        official: patch.official ?? record.official,
        primary: patch.primary ?? keepsPrimary,
        variant: patch.variant === undefined ? record.variant : patch.variant,
        pose: patch.pose === undefined ? record.pose : patch.pose,
        expression: patch.expression === undefined ? record.expression : patch.expression,
        active,
        deactivatedAt: active ? null : (record.deactivatedAt ?? this.#now()),
        updatedAt: this.#now(),
      };
      const refusal = metadataRefusal(record.kind, usagePolicy, metadata, active);
      if (refusal !== null) {
        throw brandProblems.rule(refusal);
      }
      this.#repository.updateMetadata(id, metadata);
      return toBrandAsset(this.#require(id));
    });
  }

  /**
   * Deletes an asset logically (OD-08: the row and the file are kept) when no rendered slide version draws it;
   * otherwise 409 `ASSET_IN_USE` with its usage. Deleting a deleted asset is accepted again; an unknown one is 404.
   */
  delete(id: string): void {
    this.#repository.transaction(() => {
      const record = this.#repository.get(id);
      if (record === null) {
        throw brandProblems.notFound();
      }
      if (record.deletedAt !== null) {
        return;
      }
      const usage = this.#repository.usage(id);
      if (usage.renderedVersions > 0) {
        throw brandProblems.inUse(usage.renderedVersions, usage.projects, usage.exports);
      }
      this.#repository.markDeleted(id, this.#now());
    });
  }

  /**
   * The stored file of a library asset, read from the path built from the validated ID and MIME type, confined to
   * the brand directory and checked against the recorded SHA-256. A deleted asset is 404.
   */
  async readFile(id: string): Promise<BrandAssetFile> {
    const record = this.#library(id);
    return { asset: toBrandAsset(record), content: await this.#verifiedContent(record) };
  }

  /**
   * Measures the file size of the assets registered before PD-ARCH-01G-A (startup). A missing or altered file is
   * left unmeasured and counted; nothing else changes.
   */
  async measureLegacyFiles(): Promise<{ measured: number; failed: number }> {
    let measured = 0;
    let failed = 0;
    for (const record of this.#repository.unmeasured()) {
      try {
        const content = await this.#verifiedContent(record);
        this.#repository.setByteSize(record.id, content.length);
        measured += 1;
      } catch {
        failed += 1;
      }
    }
    return { measured, failed };
  }

  async #verifiedContent(record: BrandAssetRecord): Promise<Buffer> {
    if (record.filePath !== brandRelativePath(record.id, record.mime)) {
      throw new BrandFileIntegrityError();
    }
    const content = await this.#files.read(record.id, record.mime);
    if (sha256(content) !== record.sha256) {
      throw new BrandFileIntegrityError();
    }
    return content;
  }

  async #restore(
    record: BrandAssetRecord,
    metadata: Parameters<BrandAssetRepository['restore']>[1],
  ): Promise<BrandAsset> {
    // The preserved file must still be the one recorded before the asset returns to the library.
    await this.#verifiedContent(record);
    return this.#repository.transaction(() => {
      this.#repository.restore(record.id, metadata, this.#now());
      return toBrandAsset(this.#require(record.id));
    });
  }

  #now(): string {
    return this.#clock.now().toISOString();
  }

  /** A library asset (not deleted), or 404. */
  #library(id: string): BrandAssetRecord {
    const record = this.#repository.get(id);
    if (record === null || record.deletedAt !== null) {
      throw brandProblems.notFound();
    }
    return record;
  }

  #require(id: string): BrandAssetRecord {
    const record = this.#repository.get(id);
    if (record === null) {
      throw brandProblems.notFound();
    }
    return record;
  }
}
