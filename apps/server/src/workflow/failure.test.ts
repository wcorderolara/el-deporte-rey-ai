/**
 * Closed failures (T10-F10): only a closed code and sanitized parameters survive; never a message, a provider body,
 * a credential or a file path.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AiProviderError } from '../providers/ai/index.js';
import { SourceError } from '../providers/sports/index.js';

import { StageFailure, failureOf, issuePointer, sanitizeFailure } from './failure.js';

describe('failureOf', () => {
  it('keeps the sanitized parameters of a source error, never its message', () => {
    const error = new SourceError('access_refused', 'token edr-test-marker-token-0000', 'demo-a', '/teams/2', 403);
    const value = failureOf(error);
    expect(value).toEqual({ code: 'access_refused', sourceId: 'demo-a', path: '/teams/2', httpStatus: 403 });
    expect(JSON.stringify(value)).not.toContain('marker');
  });

  it('maps a cancelled run to interrupted unless the error carries its own closed failure', () => {
    expect(failureOf(new Error('aborted'), true).code).toBe('interrupted');
    expect(failureOf(new SourceError('unavailable', 'x', 'demo-a'), true).code).toBe('unavailable');
  });

  it('maps a schema error to invalid with a pointer of field names only', () => {
    const schema = z.strictObject({ matches: z.array(z.strictObject({ score: z.int() })) });
    const parsed = schema.safeParse({ matches: [{ score: 'a' }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(failureOf(parsed.error)).toEqual({
        code: 'invalid',
        sourceId: null,
        path: '/matches/0/score',
        httpStatus: null,
      });
    }
    const keyed = z.record(z.string(), z.int()).safeParse({ '/etc/passwd': 'x' });
    if (!keyed.success) {
      expect(issuePointer(keyed.error)).toBe('/*');
    }
  });

  it('maps AI failures and unknown errors', () => {
    expect(failureOf(new AiProviderError('timeout'))).toEqual({
      code: 'timeout',
      sourceId: null,
      path: null,
      httpStatus: null,
    });
    expect(failureOf(new TypeError('/Users/operator/file.json'))).toEqual({
      code: 'internal',
      sourceId: null,
      path: null,
      httpStatus: null,
    });
    expect(failureOf(undefined).code).toBe('internal');
  });
});

describe('sanitizeFailure', () => {
  it('drops unknown codes, invalid source IDs, file-like paths and out-of-range statuses', () => {
    expect(
      sanitizeFailure({ code: 'EXPLODED', sourceId: 'Demo A', path: '../../etc/passwd', httpStatus: 999 }),
    ).toEqual({ code: 'internal', sourceId: null, path: null, httpStatus: null });
    expect(sanitizeFailure({ code: 'invalid', path: 'C:\\data\\file' }).path).toBeNull();
    expect(sanitizeFailure({ code: 'invalid', path: 'value with spaces' }).path).toBeNull();
  });

  it('caps the path at 200 characters', () => {
    expect(new StageFailure('invalid', { path: `/${'a'.repeat(300)}` }).failure.path).toHaveLength(200);
  });
});
