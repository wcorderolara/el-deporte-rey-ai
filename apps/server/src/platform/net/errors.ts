/**
 * Egress failures (contracts/provider-ports.md section 4). Every failure has a closed `kind` and a fixed message;
 * no message contains a URL, a header, a request or response body or a credential (T10-F10).
 *
 * Mapping for adapters (provider-ports section 1.4): `denied`, `redirect`, `too_large` and `invalid_request` are
 * egress refusals (`invalid`, never retried); `timeout` is `timeout`; `network` is `unavailable`; `aborted` is the
 * caller's own cancellation.
 */
export const EGRESS_FAILURE_KINDS = [
  'denied',
  'invalid_request',
  'timeout',
  'aborted',
  'too_large',
  'redirect',
  'network',
] as const;

export type EgressFailureKind = (typeof EGRESS_FAILURE_KINDS)[number];

export class EgressError extends Error {
  override readonly name: string = 'EgressError';

  constructor(
    readonly kind: EgressFailureKind,
    message: string,
  ) {
    super(message);
  }
}

/** The request was refused before any connection was opened (foreign origin, scheme, user information). */
export class EgressDenied extends EgressError {
  override readonly name: string = 'EgressDenied';

  constructor(message: string) {
    super('denied', message);
  }
}
