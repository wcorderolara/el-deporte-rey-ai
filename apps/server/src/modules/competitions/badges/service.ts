/**
 * Team badges (PD-ARCH-01G-D; PD-28): the operator uploads the badge of a local team as a PNG or JPEG file, with the
 * declared source and a confirmed authorization. Nothing is downloaded from a provider or a URL, and no SVG is
 * accepted.
 *
 * - Checks, in order (as the brand upload): a non-empty body within 5 MiB, the file signature, the declared media type
 *   equal to the signature, the header (at most 4096 x 4096 pixels), and a full decode. Only then is the file stored.
 * - Files go to `<dataDir>/team-badges/<id>.png|jpg` through the confined brand file store (generated names, mode
 *   0600, exclusive creation, `realpath` containment) and are read back only with their hash checked.
 * - Replacing a badge adds a row and retires the previous one; retiring keeps the row and the file. A project keeps
 *   the badge IDs it was created with, so it is drawn the same later (reproducibility).
 */
import { createHash, randomUUID } from 'node:crypto';

import type { Clock } from '../../../container.js';
import { BRAND_UPLOAD_BODY_LIMIT, HttpProblem } from '../../../platform/http/index.js';
import type { BrandFileStore } from '../../brand/index.js';
import { BrandFileIntegrityError, type ImageDecodeCheck, detectImageType, readImageHeader } from '../../brand/index.js';

import type { TeamBadgeRepository } from './repository.js';
import { type TeamBadgeRecord } from './repository.js';

/** Directory of the badge files inside the data directory. */
export const TEAM_BADGE_DIRECTORY = 'team-badges';

export interface TeamBadgeServiceDeps {
  readonly repository: TeamBadgeRepository;
  readonly files: BrandFileStore;
  readonly clock: Clock;
  readonly decodeCheck: ImageDecodeCheck;
  readonly newId?: () => string;
}

export interface TeamBadgeUpload {
  readonly teamId: string;
  readonly source: string;
  readonly declaredMediaType: string | null;
  readonly content: unknown;
}

const problems = {
  team: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'El equipo no existe.'),
  none: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'El equipo no tiene escudo.'),
  empty: (): HttpProblem => new HttpProblem(400, 'VALIDATION_FAILED', 'El cuerpo de la solicitud debe ser la imagen.'),
  tooLarge: (): HttpProblem =>
    new HttpProblem(413, 'PAYLOAD_TOO_LARGE', 'El escudo supera el tamaño máximo de esta operación.'),
  notAnImage: (): HttpProblem =>
    new HttpProblem(415, 'UNSUPPORTED_MEDIA_TYPE', 'El archivo no es una imagen PNG o JPEG (firma del archivo).'),
  mismatch: (): HttpProblem =>
    new HttpProblem(415, 'UNSUPPORTED_MEDIA_TYPE', 'El Content-Type declarado no coincide con la firma del archivo.'),
  header: (): HttpProblem => new HttpProblem(400, 'VALIDATION_FAILED', 'La cabecera de la imagen no es válida.'),
  dimensions: (): HttpProblem => new HttpProblem(400, 'VALIDATION_FAILED', 'La imagen supera 4096 x 4096 píxeles.'),
  decode: (): HttpProblem =>
    new HttpProblem(400, 'VALIDATION_FAILED', 'La imagen no se puede decodificar (dañada, vacía o no admitida).'),
};

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

export class TeamBadgeService {
  readonly #repository: TeamBadgeRepository;
  readonly #files: BrandFileStore;
  readonly #clock: Clock;
  readonly #decodeCheck: ImageDecodeCheck;
  readonly #newId: () => string;

  constructor(deps: TeamBadgeServiceDeps) {
    this.#repository = deps.repository;
    this.#files = deps.files;
    this.#clock = deps.clock;
    this.#decodeCheck = deps.decodeCheck;
    this.#newId = deps.newId ?? randomUUID;
  }

  /** Stores a new active badge for a team and retires the previous one (see the module notes for the checks). */
  async upload(input: TeamBadgeUpload): Promise<TeamBadgeRecord> {
    if (!this.#repository.teamExists(input.teamId)) {
      throw problems.team();
    }
    const { content } = input;
    if (!Buffer.isBuffer(content) || content.length === 0) {
      throw problems.empty();
    }
    if (content.length > BRAND_UPLOAD_BODY_LIMIT) {
      throw problems.tooLarge();
    }
    const detected = detectImageType(content);
    if (detected === null || detected === 'image/webp') {
      throw problems.notAnImage();
    }
    if (input.declaredMediaType !== detected) {
      throw problems.mismatch();
    }
    const inspected = readImageHeader(content, detected);
    if (!inspected.ok) {
      throw inspected.reason === 'dimensions_too_large' ? problems.dimensions() : problems.header();
    }
    if (!(await this.#decodeCheck(content, inspected.header))) {
      throw problems.decode();
    }
    const id = this.#newId();
    const mime = detected;
    const filePath = await this.#files.create(id, mime, content);
    const now = this.#clock.now().toISOString();
    try {
      this.#repository.transaction(() => {
        if (!this.#repository.teamExists(input.teamId)) {
          throw problems.team();
        }
        this.#repository.retire(input.teamId, now);
        this.#repository.insert({
          id,
          teamId: input.teamId,
          filePath,
          sha256: sha256(content),
          mime,
          width: inspected.header.width,
          height: inspected.header.height,
          byteSize: content.length,
          source: input.source,
          createdAt: now,
        });
      });
    } catch (error) {
      await this.#files.discardUnregistered(id, mime).catch(() => undefined);
      throw error;
    }
    const stored = this.#repository.badge(id);
    if (stored === null) {
      throw new Error('the badge was not stored');
    }
    return stored;
  }

  /** Retires the active badge of a team; the row and the file are kept. 404 when the team has none. */
  retire(teamId: string): void {
    if (!this.#repository.teamExists(teamId)) {
      throw problems.team();
    }
    const retired = this.#repository.transaction(() =>
      this.#repository.retire(teamId, this.#clock.now().toISOString()),
    );
    if (!retired) {
      throw problems.none();
    }
  }

  /** The active badge of a team, or null. */
  active(teamId: string): TeamBadgeRecord | null {
    return this.#repository.active(teamId);
  }

  /** Any badge by its ID (active or retired), or null. */
  badge(id: string): TeamBadgeRecord | null {
    return this.#repository.badge(id);
  }

  /** The bytes of a badge, read from its confined path and checked against the recorded hash. */
  async read(record: TeamBadgeRecord): Promise<Buffer> {
    if (record.filePath !== this.#files.relativePath(record.id, record.mime)) {
      throw new BrandFileIntegrityError();
    }
    const content = await this.#files.read(record.id, record.mime);
    if (sha256(content) !== record.sha256) {
      throw new BrandFileIntegrityError();
    }
    return content;
  }

  /** The active badge file of a team (getTeamBadgeFile); 404 when the team or its badge does not exist. */
  async activeFile(teamId: string): Promise<{ record: TeamBadgeRecord; content: Buffer }> {
    if (!this.#repository.teamExists(teamId)) {
      throw problems.team();
    }
    const record = this.#repository.active(teamId);
    if (record === null) {
      throw problems.none();
    }
    return { record, content: await this.read(record) };
  }
}
