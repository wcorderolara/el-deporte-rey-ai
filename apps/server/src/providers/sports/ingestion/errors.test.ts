/**
 * SourceError (contracts/provider-ports.md section 1.2; T10-F10): closed codes, sanitized parameters, and a stored
 * failure that never carries the message, a body, a credential or a file path.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../vitest.setup.js';
import { EgressError } from '../../../platform/net/index.js';

import {
  SOURCE_ERROR_CODES,
  SourceError,
  availabilityReasonOf,
  sourceErrorFromEgress,
  toSourceError,
  toSourceFailure,
} from './errors.js';

describe('SourceError', () => {
  it('has the closed code list of the contract Failure schema for sources', () => {
    expect([...SOURCE_ERROR_CODES]).toEqual([
      'unavailable',
      'rate_limited',
      'timeout',
      'no_data',
      'invalid',
      'access_refused',
      'not_available',
      'bad_request',
    ]);
  });

  it('stores only the code, source ID, validation path and HTTP status (T10-F10)', () => {
    const error = new SourceError('access_refused', `refused with ${TEST_MARKER_TOKEN}`, 'live-a', '/items/0', 401);
    const failure = toSourceFailure(error);
    expect(failure).toEqual({ code: 'access_refused', sourceId: 'live-a', path: '/items/0', httpStatus: 401 });
    expect(Object.keys(failure).sort()).toEqual(['code', 'httpStatus', 'path', 'sourceId']);
    expect(JSON.stringify(error)).not.toContain(TEST_MARKER_TOKEN);
    expect(JSON.stringify(failure)).not.toContain(TEST_MARKER_TOKEN);
  });

  it('drops a file path, a URL or control characters given as the path', () => {
    for (const path of [
      '/srv/edr/fixtures/sports/default/demo-a.json',
      'https://x.example.test/a?b=c',
      '/a\u0000b',
      'x',
    ]) {
      expect(new SourceError('invalid', 'fixed', 'demo-a', path).path).toBeNull();
    }
    expect(new SourceError('invalid', 'fixed', 'demo-a', '/matches/0/score').path).toBe('/matches/0/score');
    expect(new SourceError('invalid', 'fixed', 'demo-a', '/'.repeat(1) + 'a'.repeat(300)).path).toBeNull();
  });

  it('drops out-of-range HTTP statuses and waits, and an invalid source ID in the stored failure', () => {
    const error = new SourceError('rate_limited', 'fixed', 'Not A Source', null, 99, -1);
    expect(error.httpStatus).toBeNull();
    expect(error.retryAfterSeconds).toBeNull();
    expect(new SourceError('rate_limited', 'fixed', 'demo-a', null, 429, 1.5).retryAfterSeconds).toBeNull();
    expect(new SourceError('rate_limited', 'fixed', 'demo-a', null, 429, 30).retryAfterSeconds).toBe(30);
    expect(toSourceFailure(error).sourceId).toBeNull();
  });

  it('strips control and format characters from the debug message and caps its length', () => {
    const error = new SourceError('invalid', `a\u0007b\u200Bc${'x'.repeat(500)}`, 'demo-a');
    expect(error.message).not.toMatch(/[\p{Cc}\p{Cf}]/u);
    expect(error.message.length).toBeLessThanOrEqual(200);
  });

  it('maps egress failures to closed codes without reusing the egress message', () => {
    const cases: Array<[EgressError['kind'], string]> = [
      ['timeout', 'timeout'],
      ['network', 'unavailable'],
      ['aborted', 'unavailable'],
      ['denied', 'invalid'],
      ['redirect', 'invalid'],
      ['too_large', 'invalid'],
      ['invalid_request', 'invalid'],
    ];
    for (const [kind, code] of cases) {
      const mapped = sourceErrorFromEgress(new EgressError(kind, 'https://host.example.test/secret?q=1'), 'live-a');
      expect(mapped.code).toBe(code);
      expect(mapped.message).not.toContain('example.test');
    }
  });

  it('normalizes unknown errors to unavailable with fixed text, and re-attributes a SourceError', () => {
    const unknown = toSourceError(new Error('/Users/someone/secret/path'), 'demo-a');
    expect(unknown.code).toBe('unavailable');
    expect(unknown.message).not.toContain('/Users');
    const other = toSourceError(new SourceError('no_data', 'fixed', 'demo-b', '/x', 404, 5), 'demo-a');
    expect(toSourceFailure(other)).toEqual({ code: 'no_data', sourceId: 'demo-a', path: '/x', httpStatus: 404 });
  });

  it('gives each code its availability reason (R-286)', () => {
    const reason = (code: SourceError['code'], status: number | null = null): string =>
      availabilityReasonOf(new SourceError(code, 'fixed', 'demo-a', null, status));
    expect(reason('not_available')).toBe('subscription_restricted');
    expect(reason('not_available', 404)).toBe('not_found');
    expect(reason('access_refused')).toBe('access_refused');
    expect(reason('rate_limited')).toBe('rate_limited');
    expect(reason('no_data')).toBe('not_provided');
    expect(reason('unavailable')).toBe('source_unavailable');
    expect(reason('timeout')).toBe('source_unavailable');
    expect(reason('invalid')).toBe('source_unavailable');
    expect(reason('bad_request')).toBe('source_unavailable');
  });
});
