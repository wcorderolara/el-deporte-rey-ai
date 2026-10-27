/**
 * Shared Zod schemas and TypeScript types mirroring the HTTP contract (contracts/http-api.openapi.yaml) and the
 * provider-neutral domain (contracts/provider-ports.md section 1.3).
 *
 * Stub created by T15; T20 replaces it with the schemas of every operation and of the domain.
 */
import { z } from 'zod';

/** Response body of `GET /api/v1/health` (operation getHealth). */
export const HealthResponseSchema = z.strictObject({ status: z.literal('ok') });

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
