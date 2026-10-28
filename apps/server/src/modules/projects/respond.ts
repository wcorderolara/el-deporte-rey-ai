/**
 * Response check: every success body is parsed with its contract schema before it is sent, so a response never
 * carries an undocumented field (the schemas are closed). A mismatch is a server defect: it is thrown as a plain
 * error, which the platform answers with 500 `INTERNAL` and fixed text (never as a validation problem of the
 * request).
 */
import type { z } from 'zod';

export class ContractResponseError extends Error {
  override readonly name = 'ContractResponseError';

  constructor() {
    super('a response does not match its contract schema');
  }
}

export function contractResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ContractResponseError();
  }
  return parsed.data;
}
