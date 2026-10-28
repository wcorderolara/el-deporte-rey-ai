/**
 * Routes of the `imports` tag (contract `http-api` 1.0.0: listImports, createImport, getImport, getImportOriginal,
 * listManualSelections, getManualVersion; architecture.md section 15.3).
 *
 * - `POST /imports` is JSON only with the 1.5 MiB route limit; the platform guards (Host, Origin, client header,
 *   media type) run before the body is read, and the platform's depth scan (64) runs before Fastify's JSON parser, so
 *   a deeply nested envelope is refused quickly with 400 (NV-9). The envelope is checked here (`VALIDATION_FAILED`);
 *   everything about the imported content is an `IMPORT_REJECTED` problem with every error (R-274).
 * - `GET /imports/{importId}/original` serves the stored bytes as an attachment under a server-generated ASCII name,
 *   `application/octet-stream`, with the sandbox CSP; `nosniff` and CORP `same-origin` come from the platform headers
 *   (T11H-F11). The stored file name is never reflected in a header.
 * - No handler logs a request body (T11H-F12).
 */
import {
  FileNameSchema,
  ImportParamsSchema,
  LabelSchema,
  ManualSelectionsQuerySchema,
  VersionParamsSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AppContainer } from '../../container.js';
import {
  HttpProblem,
  IMPORT_BODY_LIMIT,
  SANDBOXED_FILE_CONTENT_SECURITY_POLICY,
  routeBodyLimit,
} from '../../platform/http/index.js';

import { ORIGINAL_EXTENSIONS, readOriginal } from './originals.js';
import { type ImportRequest, ImportService, ManualSeasonNotFoundError, NoManualSourceError } from './service.js';

/** Envelope of a file import: the content is checked by the import pipeline, not here (T11H-F01). */
const FileEnvelopeSchema = z.strictObject({
  channel: z.enum(['json_file', 'csv_file']),
  fileName: FileNameSchema,
  declaredSource: LabelSchema.nullable(),
  contentBase64: z.string(),
});

/** Envelope of a form import: the document is checked by the import pipeline. */
const FormEnvelopeSchema = z.strictObject({
  channel: z.literal('form'),
  declaredSource: LabelSchema.nullable(),
  document: z.unknown(),
});

const EnvelopeSchema = z.discriminatedUnion('channel', [FileEnvelopeSchema, FormEnvelopeSchema]);

function notFound(): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', 'The requested resource does not exist.');
}

/** Checks the request envelope; throws a `ZodError` or a problem answered as 400 `VALIDATION_FAILED`. */
export function parseEnvelope(body: unknown): ImportRequest {
  const envelope = EnvelopeSchema.parse(body);
  if (envelope.channel === 'form') {
    if (envelope.document === undefined) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'The request is invalid.', {
        errors: [{ path: '/document', message: 'is required' }],
      });
    }
    return { channel: 'form', declaredSource: envelope.declaredSource, document: envelope.document };
  }
  return {
    channel: envelope.channel,
    fileName: envelope.fileName,
    declaredSource: envelope.declaredSource,
    contentBase64: envelope.contentBase64,
  };
}

/** Registers the import routes (under `/api/v1`). */
export async function registerImportRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
  const service = new ImportService({
    db: container.db,
    clock: container.clock,
    dataDir: container.paths.dataDir,
    logger: container.logger,
    sources: container.config.providers.sports.sources,
    catalogue: container.config.catalogue,
  });

  app.get('/imports', async () => ({ imports: service.listImports() }));

  app.post('/imports', { bodyLimit: routeBodyLimit(IMPORT_BODY_LIMIT) }, async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    let outcome;
    try {
      outcome = service.createImport(envelope);
    } catch (error) {
      if (error instanceof NoManualSourceError) {
        throw new HttpProblem(400, 'VALIDATION_FAILED', 'No MANUAL_DATA source is enabled in the configuration.');
      }
      throw error;
    }
    if (!outcome.ok) {
      throw new HttpProblem(
        400,
        'IMPORT_REJECTED',
        `The import was rejected with ${String(outcome.total)} errors; nothing was stored.`,
        { importErrors: outcome.errors },
      );
    }
    return reply.code(201).send(outcome.summary);
  });

  app.get('/imports/:importId', async (request) => {
    const { importId } = ImportParamsSchema.parse(request.params);
    const summary = service.getImport(importId);
    if (summary === undefined) {
      throw notFound();
    }
    return summary;
  });

  app.get('/imports/:importId/original', async (request, reply) => {
    const { importId } = ImportParamsSchema.parse(request.params);
    const record = service.importRecord(importId);
    if (record === undefined) {
      throw notFound();
    }
    const bytes = readOriginal(container.paths.dataDir, record);
    return reply
      .header('content-type', 'application/octet-stream')
      .header(
        'content-disposition',
        `attachment; filename="original-${record.id}.${ORIGINAL_EXTENSIONS[record.channel]}"`,
      )
      .header('content-security-policy', SANDBOXED_FILE_CONTENT_SECURITY_POLICY)
      .header('cache-control', 'no-store')
      .send(bytes);
  });

  app.get('/manual-data/selections', async (request) => {
    const { competitionId, seasonId } = ManualSelectionsQuerySchema.parse(request.query);
    try {
      return service.listSelections(competitionId, seasonId);
    } catch (error) {
      if (error instanceof ManualSeasonNotFoundError) {
        throw notFound();
      }
      throw error;
    }
  });

  app.get('/manual-data/versions/:versionId', async (request) => {
    const { versionId } = VersionParamsSchema.parse(request.params);
    const version = service.getVersion(versionId);
    if (version === undefined) {
      throw notFound();
    }
    return version;
  });
}
