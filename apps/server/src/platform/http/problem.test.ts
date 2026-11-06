import { describe, expect, it } from 'vitest';

import {
  HttpProblem,
  type ImportErrorItem,
  PROBLEM_CODES,
  PROBLEM_LIMITS,
  REFUSAL_REASONS,
  problemBody,
  sanitizeText,
} from './problem.js';

describe('HttpProblem', () => {
  it('builds the contract body with type, title, status, code and detail', () => {
    const body = problemBody(new HttpProblem(404, 'NOT_FOUND', 'The project does not exist.'));
    expect(body).toEqual({
      type: 'urn:edr:problem:NOT_FOUND',
      title: 'Not found',
      status: 404,
      code: 'NOT_FOUND',
      detail: 'The project does not exist.',
    });
  });

  it('carries retryAfterSeconds with PROVIDER_RATE_LIMITED (T11G)', () => {
    const body = problemBody(
      new HttpProblem(503, 'PROVIDER_RATE_LIMITED', 'The request budget is exhausted.', { retryAfterSeconds: 42 }),
    );
    expect(body).toMatchObject({ status: 503, code: 'PROVIDER_RATE_LIMITED', retryAfterSeconds: 42 });
    expect(
      problemBody(new HttpProblem(503, 'PROVIDER_RATE_LIMITED', undefined, { retryAfterSeconds: null })),
    ).toHaveProperty('retryAfterSeconds', null);
  });

  it('carries refusalReason with SELECTION_UNAVAILABLE and MANUAL_APPROVAL_REFUSED (T11G)', () => {
    expect(
      problemBody(new HttpProblem(409, 'SELECTION_UNAVAILABLE', undefined, { refusalReason: 'season_unavailable' })),
    ).toMatchObject({ code: 'SELECTION_UNAVAILABLE', refusalReason: 'season_unavailable' });
    expect(
      problemBody(new HttpProblem(409, 'MANUAL_APPROVAL_REFUSED', undefined, { refusalReason: 'not_manual_data' })),
    ).toMatchObject({ code: 'MANUAL_APPROVAL_REFUSED', refusalReason: 'not_manual_data' });
  });

  it('carries importErrors with IMPORT_REJECTED (T11G), capped at 500 and limited to known values', () => {
    const valid: ImportErrorItem = {
      location: 'file',
      record: '3',
      field: 'homeScore',
      problem: 'type_invalid',
      message: 'must be an integer',
    };
    const invalid = { ...valid, problem: 'made_up' } as unknown as ImportErrorItem;
    const many = [invalid, ...Array.from({ length: 600 }, () => valid)];
    const body = problemBody(
      new HttpProblem(400, 'IMPORT_REJECTED', 'The import was rejected.', { importErrors: many }),
    );
    expect(body.importErrors).toHaveLength(PROBLEM_LIMITS.importErrors - 1);
    expect(body.importErrors?.[0]).toEqual(valid);
  });

  it('caps validation errors at 50 and sanitizes their texts', () => {
    const errors = Array.from({ length: 80 }, (_, index) => ({
      path: `/a/${String(index)}\u0000`,
      message: 'bad\u202e',
    }));
    const body = problemBody(new HttpProblem(400, 'VALIDATION_FAILED', undefined, { errors }));
    expect(body.errors).toHaveLength(PROBLEM_LIMITS.errors);
    expect(body.errors?.[0]).toEqual({ path: '/a/0', message: 'bad' });
  });

  it('refuses unknown codes, members with the wrong code, invalid members and non-error statuses', () => {
    expect(() => new HttpProblem(400, 'NOPE' as never)).toThrow(TypeError);
    expect(() => new HttpProblem(400, 'VALIDATION_FAILED', undefined, { retryAfterSeconds: 1 })).toThrow(TypeError);
    expect(() => new HttpProblem(503, 'PROVIDER_RATE_LIMITED', undefined, { retryAfterSeconds: -1 })).toThrow(
      TypeError,
    );
    expect(() => new HttpProblem(503, 'PROVIDER_RATE_LIMITED', undefined, { retryAfterSeconds: 1.5 })).toThrow(
      TypeError,
    );
    expect(
      () => new HttpProblem(409, 'MANUAL_APPROVAL_REFUSED', undefined, { refusalReason: 'whatever' as never }),
    ).toThrow(TypeError);
    expect(() => new HttpProblem(400, 'VALIDATION_FAILED', undefined, { unknown: 1 } as never)).toThrow(TypeError);
    expect(() => new HttpProblem(200, 'INTERNAL')).toThrow(TypeError);
  });

  it('sanitizes and caps the detail', () => {
    const problem = new HttpProblem(400, 'VALIDATION_FAILED', `x\u0007y\u200b${'z'.repeat(600)}`);
    expect(problem.detail).toHaveLength(PROBLEM_LIMITS.detail);
    expect(problem.detail?.startsWith('x y z')).toBe(true);
  });

  it('lists the contract problem codes and refusal reasons', () => {
    expect(PROBLEM_CODES).toHaveLength(45);
    expect(PROBLEM_CODES).toContain('MISDIRECTED_HOST');
    expect(PROBLEM_CODES).toContain('FORBIDDEN_ORIGIN');
    expect(PROBLEM_CODES).toContain('PROVIDER_BINDING_EXISTS');
    expect(PROBLEM_CODES).toContain('PROVIDER_UNAVAILABLE');
    expect(PROBLEM_CODES).toContain('IMPORT_PREVIEW_EXPIRED');
    expect(PROBLEM_CODES).toContain('CONTENT_BATCH_NOT_GENERATABLE');
    expect(PROBLEM_CODES).toContain('REQUEST_KEY_REUSED');
    expect(PROBLEM_CODES).toContain('ASSET_IN_USE');
    expect(REFUSAL_REASONS).toContain('source_not_selectable');
  });
});

describe('sanitizeText', () => {
  it('replaces control, format and separator characters and trims', () => {
    expect(sanitizeText(' a\nb\u2028c\u2066d ', 100)).toBe('a b c d');
  });
});
