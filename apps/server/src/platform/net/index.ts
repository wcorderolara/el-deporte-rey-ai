/**
 * Egress client (contracts/provider-ports.md section 4): every outbound request goes through it. It is the only
 * module allowed to open network connections (T10-F08).
 */
export {
  EgressAllowList,
  MAX_URL_LENGTH,
  buildEgressAllowList,
  buildImageEgressAllowList,
  isLoopbackHostname,
} from './allow-list.js';
export {
  DEFAULT_AI_MAX_RESPONSE_BYTES,
  DEFAULT_EGRESS_LIMITS,
  DEFAULT_SPORTS_MAX_RESPONSE_BYTES,
  type EgressLimits,
  IMAGE_EGRESS_LIMITS,
  type EgressClient,
  type EgressRequestInit,
  type EgressResponse,
  MAX_REQUEST_BODY_CHARACTERS,
  MAX_RESPONSE_BYTES_LIMIT,
  MAX_TIMEOUT_MS,
  createEgressClient,
} from './egress-client.js';
export { EGRESS_FAILURE_KINDS, EgressDenied, EgressError, type EgressFailureKind } from './errors.js';
