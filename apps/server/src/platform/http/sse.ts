/**
 * Server-sent events of a persisted asynchronous operation (the convention of the competition import operations,
 * PD-ARCH-01D; moved here unchanged so the design generations of PD-ARCH-01G-B use the same stream).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodType } from 'zod';

import { HttpProblem } from './problem.js';

/**
 * Streams the persisted events of an operation as SSE. SQLite stays authoritative: every wake-up re-reads events
 * after the last sent sequence (`Last-Event-ID` resumes after a reconnect) and the stream ends at a terminal status.
 * Used by the competition import operations and the AI design generations (PD-ARCH-01G-B).
 */
export function streamEvents<Event extends { id: number; type: string }>(
  request: FastifyRequest,
  reply: FastifyReply,
  source: {
    eventsSince: (after: number) => unknown[];
    status: () => string;
    subscribe: (listener: () => void) => () => void;
    schema: ZodType<Event>;
  },
) {
  const last = request.headers['last-event-id'];
  const from = typeof last === 'string' && /^\d+$/.test(last) ? Number(last) : 0;
  if (!Number.isSafeInteger(from))
    throw new HttpProblem(400, 'VALIDATION_FAILED', 'El identificador de evento no es válido.');
  let closed = false;
  let cursor = from;
  let unsubscribe = () => {};
  const flush = () => {
    if (closed) return;
    for (const event of source.eventsSince(cursor)) {
      const checked = source.schema.parse(event);
      cursor = checked.id;
      reply.raw.write(`id: ${checked.id}\nevent: ${checked.type}\ndata: ${JSON.stringify(checked)}\n\n`);
    }
    if (['completed', 'failed', 'cancelled'].includes(source.status())) {
      closed = true;
      unsubscribe();
      clearInterval(heartbeat);
      reply.raw.end();
    }
  };
  unsubscribe = source.subscribe(flush);
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
  });
  const heartbeat = setInterval(() => {
    if (!closed) reply.raw.write(': keep-alive\n\n');
  }, 20000);
  reply.raw.on('close', () => {
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
  });
  flush();
}
