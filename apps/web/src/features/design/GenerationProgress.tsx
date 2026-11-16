import { DesignGenerationEventSchema, type DesignGeneration } from '@edr/contracts';
import { useEffect, useRef, useState } from 'react';

import { Alert, Badge, Button, Card, LoadingState } from '../../ui';
import { generationStatusLabel, progressCopy } from './copy';
import type { DesignApi } from './designApi';

export interface GenerationProgressProps {
  api: DesignApi;
  generationId: string;
  /** Called once when the generation reaches `completed` or `failed`, and every time a proposal is saved. */
  onChange: (generation: DesignGeneration) => void;
  onDismiss: () => void;
}

const TERMINAL = new Set(['completed', 'failed']);

/**
 * Progress of a generation (PD-ARCH-01G-B section 14): the statuses the server recorded, streamed by SSE (the
 * convention of the import operations) and confirmed with the status operation, the image being processed and the
 * proposals saved so far. No percentage is shown: the provider reports none.
 */
export function GenerationProgress({ api, generationId, onChange, onDismiss }: GenerationProgressProps) {
  const [generation, setGeneration] = useState<DesignGeneration | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;

  useEffect(() => {
    let alive = true;
    let version = 0;
    let finished = false;
    let stream: EventSource | null = null;
    const refresh = async () => {
      const current = ++version;
      try {
        const next = await api.getGeneration(generationId);
        if (!alive || current !== version) return;
        setGeneration(next);
        changed.current(next);
        if (TERMINAL.has(next.status)) {
          finished = true;
          stream?.close();
        }
      } catch {
        // A later event or the next refresh brings the status; the stream stays open.
      }
    };
    void refresh();
    if (typeof EventSource !== 'undefined') {
      stream = new EventSource(api.eventsUrl(generationId));
      const onEvent = (message: Event) => {
        if (!alive || finished || !(message instanceof MessageEvent)) return;
        try {
          const event = DesignGenerationEventSchema.safeParse(JSON.parse(String(message.data)));
          if (event.success && event.data.generationId === generationId) void refresh();
        } catch {
          // Ignored: only contract events trigger a refresh.
        }
      };
      for (const type of [
        'generation.started',
        'image.requested',
        'image.generating',
        'image.received',
        'proposal.saved',
        'generation.completed',
        'generation.failed',
      ]) {
        stream.addEventListener(type, onEvent);
      }
    }
    return () => {
      alive = false;
      stream?.close();
    };
  }, [api, generationId]);

  if (generation === null) {
    return (
      <Card>
        <LoadingState label={progressCopy.title} />
      </Card>
    );
  }
  const terminal = TERMINAL.has(generation.status);
  return (
    <Card as="section" aria-label={terminal ? progressCopy.done : progressCopy.title} className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-body-lg font-bold text-text-primary">
            {generation.status === 'completed'
              ? progressCopy.done
              : generation.status === 'failed'
                ? progressCopy.failed
                : progressCopy.title}
          </h3>
          <Badge
            tone={generation.status === 'failed' ? 'danger' : generation.status === 'completed' ? 'success' : 'info'}
          >
            {generationStatusLabel[generation.status]}
          </Badge>
        </div>
        {terminal ? (
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            {progressCopy.dismiss}
          </Button>
        ) : null}
      </div>
      <p className="m-0 text-body-sm text-text-secondary" role="status" aria-live="polite">
        {generation.currentIndex === null || terminal
          ? progressCopy.saved(generation.completedCount, generation.requestedCount)
          : `${progressCopy.image(generation.currentIndex, generation.requestedCount)} · ${generationStatusLabel[generation.status]} · ${progressCopy.saved(generation.completedCount, generation.requestedCount)}`}
      </p>
      {generation.cost === null ? null : (
        <p className="m-0 text-caption text-text-secondary">{progressCopy.cost(generation.cost)}</p>
      )}
      {generation.status === 'failed' && generation.errorMessage !== null ? (
        <Alert tone="danger">
          {generation.errorMessage}
          {generation.retryAfterSeconds === null ? null : ` ${progressCopy.retryAfter(generation.retryAfterSeconds)}`}
        </Alert>
      ) : null}
      {terminal ? null : <p className="m-0 text-caption text-text-subtle">{progressCopy.confirmed}</p>}
    </Card>
  );
}
