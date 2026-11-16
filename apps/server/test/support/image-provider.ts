/**
 * Test-only image provider support (PD-ARCH-01G-B): a scripted egress client that answers the Image API paths with
 * synthetic responses, never opening a connection, and the configuration of the `openai` image adapter pointed at a
 * synthetic origin. No real request reaches OpenAI and no credit is used: the key is the test dummy key.
 */
import type { EgressClient, EgressRequestInit, EgressResponse } from '../../src/platform/net/index.js';
import { png } from '../../src/modules/brand/test/images.js';

/** Synthetic origin of the image adapter in tests (never resolved: the scripted client answers it). */
export const TEST_IMAGE_BASE_URL = 'https://images.test.invalid/v1';

/** The `providers.images` section of a test configuration. */
export function testImageProviderConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    adapter: 'openai',
    options: {
      baseUrl: TEST_IMAGE_BASE_URL,
      defaultModel: 'test-image-flex',
      models: [
        {
          id: 'test-image-flex',
          label: 'Modelo flexible de prueba',
          flexibleSizes: true,
          qualities: ['low', 'medium', 'high'],
          pricing: {
            currency: 'USD',
            textInputPerMillionTokens: 5,
            imageInputPerMillionTokens: 8,
            imageOutputPerMillionTokens: 30,
            textOutputPerMillionTokens: null,
            source: 'synthetic test prices',
            checkedOn: '2026-11-05',
          },
          publishedImageCosts: { low: { square: 0.01, portrait: 0.02 }, medium: { square: 0.04, portrait: 0.05 } },
        },
        {
          id: 'test-image-standard',
          label: 'Modelo estándar de prueba',
          flexibleSizes: false,
          qualities: ['low', 'high'],
        },
      ],
      timeoutMs: 60_000,
      limits: { maxImagesPerRequest: 4, maxReferences: 4, maxImagesPerDay: 20, maxConcurrentRequests: 1 },
      ...overrides,
    },
  };
}

export interface RecordedImageRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Record<string, unknown> | null;
}

/** One scripted answer: an HTTP status and a body, or a thrown error (for example an `EgressError`). */
export type ImageAnswer =
  | { readonly status: number; readonly body: unknown; readonly headers?: Readonly<Record<string, string>> }
  | { readonly error: Error };

export interface ScriptedImageEgress extends EgressClient {
  readonly requests: readonly RecordedImageRequest[];
  /** Queues answers used in order for image requests; afterwards each image request gets a generated image. */
  answer(...answers: ImageAnswer[]): void;
  /** Holds the next image request until `release()` is called. */
  hold(): void;
  release(): void;
}

/** A successful Image API answer with a synthetic PNG of the requested size and token usage. */
export function imageAnswer(width: number, height: number, usage: Record<string, unknown> | null = null): ImageAnswer {
  const image = png({ width, height, rgba: [46, 17, 69, 255] }).toString('base64');
  return {
    status: 200,
    body: {
      created: 1_790_000_000,
      data: [{ b64_json: image }],
      ...(usage === null ? {} : { usage }),
    },
  };
}

export const SAMPLE_USAGE = Object.freeze({
  input_tokens: 120,
  output_tokens: 1600,
  total_tokens: 1720,
  input_tokens_details: { text_tokens: 120, image_tokens: 0 },
});

function sizeOf(body: Record<string, unknown> | null): [number, number] {
  const size = typeof body?.['size'] === 'string' ? body['size'] : '1024x1024';
  const [width, height] = size.split('x').map(Number);
  return [width ?? 1024, height ?? 1024];
}

/** A scripted image egress client; every request is recorded with its parsed JSON body. */
export function scriptedImageEgress(): ScriptedImageEgress {
  const requests: RecordedImageRequest[] = [];
  const queue: ImageAnswer[] = [];
  let held: Promise<void> | null = null;
  let releaseHeld: (() => void) | null = null;

  const request = async (url: string, init: EgressRequestInit): Promise<EgressResponse> => {
    const body = init.body === undefined ? null : (JSON.parse(init.body) as Record<string, unknown>);
    requests.push({ url, method: init.method, headers: { ...(init.headers ?? {}) }, body });
    if (!url.startsWith(TEST_IMAGE_BASE_URL)) {
      throw new Error('scripted image egress: unexpected origin');
    }
    if (url.includes('/models/')) {
      return { status: 200, headers: new Headers(), text: JSON.stringify({ id: 'test-image-flex', object: 'model' }) };
    }
    if (held !== null) {
      await held;
    }
    const answer = queue.shift() ?? imageAnswer(...sizeOf(body), SAMPLE_USAGE);
    if ('error' in answer) {
      throw answer.error;
    }
    return {
      status: answer.status,
      headers: new Headers(answer.headers ?? {}),
      text: typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body),
    };
  };

  return {
    request,
    get requests() {
      return requests;
    },
    answer: (...answers) => {
      queue.push(...answers);
    },
    hold: () => {
      held = new Promise<void>((resolve) => {
        releaseHeld = resolve;
      });
    },
    release: () => {
      releaseHeld?.();
      held = null;
      releaseHeld = null;
    },
  };
}
