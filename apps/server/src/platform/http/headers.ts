/**
 * Security headers on every response (architecture-delta.md section 4 TB-1 and TB-4; T10-F04, T10-F12; R-262).
 *
 * The CSP's explicit `connect-src 'self'` means the browser can only call this server, never a provider (R-262).
 * One `onSend` hook on the root instance sets the headers on every reply (API, problems, static files, SPA
 * fallback) and removes any `Access-Control-*` header, so no response ever grants CORS (T10-F04).
 */
import type { FastifyInstance, FastifyReply } from 'fastify';

/** Content Security Policy of every response. */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'";

/**
 * Stricter policy for operator-supplied files served by API handlers (brand assets, T10-F12). A handler opts in by
 * setting this exact value; any other value set by a handler is replaced by `CONTENT_SECURITY_POLICY`.
 */
export const SANDBOXED_FILE_CONTENT_SECURITY_POLICY = "default-src 'none'; sandbox";

/** Headers set on every response. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'x-frame-options': 'DENY',
});

/** Applies the security headers to a reply and removes CORS headers. */
export function applySecurityHeaders(reply: FastifyReply): void {
  for (const name of Object.keys(reply.getHeaders())) {
    if (name.toLowerCase().startsWith('access-control-')) {
      reply.removeHeader(name);
    }
  }
  if (reply.getHeader('content-security-policy') !== SANDBOXED_FILE_CONTENT_SECURITY_POLICY) {
    reply.header('content-security-policy', CONTENT_SECURITY_POLICY);
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    reply.header(name, value);
  }
}

/** Installs the headers as an `onSend` hook of the root instance (before any route or plugin is registered). */
export function installSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    applySecurityHeaders(reply);
    return payload;
  });
}
