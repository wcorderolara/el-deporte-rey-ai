/**
 * Response check: every success body is parsed with its contract schema before it is sent, so a response never
 * carries an undocumented field (the schemas are closed). A mismatch is a server defect: it is thrown as a plain
 * error, which the platform answers with 500 `INTERNAL` and fixed text (never as a validation problem of the
 * request).
 */
import type { z } from 'zod';

export class ContractResponseError extends Error {
  override readonly name = 'ContractResponseError';
  readonly contract: string;
  readonly paths: readonly string[];

  constructor(contract = 'response', paths: readonly string[] = []) {
    super('a response does not match its contract schema');
    this.contract = contract;
    this.paths = paths.map((path) => path.replace(/[^A-Za-z0-9.]/g, '*').slice(0, 120));
  }
}

export function contractResponse<T>(schema: z.ZodType<T>, value: unknown, contract?: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ContractResponseError(contract, parsed.error.issues.slice(0, 12).map((issue) => issue.path.join('.') || 'root'));
  }
  return parsed.data;
}
