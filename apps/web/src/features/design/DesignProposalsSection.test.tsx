/**
 * AI design proposals inside Plantillas (PD-ARCH-01G-B): the provider status, the creation dialog with the usage
 * policies of the brand assets, the scope and cost review with the explicit confirmation, a single generation request
 * with its request key, the progress confirmed by the server, the library (table by default, cards, status filter),
 * comparison, review decisions and variants. A fake fetch answers every request; no network is used.
 */
import type {
  DesignCapabilities,
  DesignEstimate,
  DesignGeneration,
  DesignProposal,
  DesignProposalDetail,
} from '@edr/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBrandApi } from '../brand/brandApi';
import {
  ASSET_LOGO,
  ASSET_MASCOT,
  ASSET_REFERENCE,
  asset,
  deferred,
  fakeFetch,
  jsonResponse,
  problemResponse,
  type Handler,
} from '../brand/testSupport';
import { createDesignApi } from './designApi';
import { DesignProposalsSection } from './DesignProposalsSection';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  readonly listeners = new Map<string, (event: Event) => void>();
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }
  emit(type: string, generationId: string) {
    this.listeners.get(type)?.(
      new MessageEvent(type, {
        data: JSON.stringify({
          id: 3,
          type,
          generationId,
          status: 'generating',
          imageIndex: 1,
          proposalId: null,
          timestamp: '2026-11-05T12:00:00.000Z',
        }),
      }),
    );
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T = '2026-11-05T12:00:00.000Z';
const BACKGROUND = asset({
  id: uuid(90),
  kind: 'background',
  label: 'Fondo transformable',
  usagePolicy: 'transformable',
});

const CAPABILITIES: DesignCapabilities = {
  adapter: 'openai',
  status: 'ready',
  defaultModel: 'gpt-image-2.5-flare',
  models: [
    {
      id: 'gpt-image-2.5-flare',
      label: 'GPT Image 2.5 Flare',
      flexibleSizes: true,
      qualities: ['low', 'medium', 'high'],
      pricing: {
        currency: 'USD',
        textInputPerMillionTokens: 5,
        imageInputPerMillionTokens: 8,
        imageOutputPerMillionTokens: 30,
        textOutputPerMillionTokens: null,
        source: 'Lista de precios de OpenAI',
        checkedOn: '2026-11-05',
      },
      estimable: false,
    },
  ],
  contentTypes: ['match_preview', 'round_overview', 'fixture', 'match_result'],
  formats: ['1:1', '4:5', '9:16'],
  policyRoles: [
    { policy: 'protected', roles: ['reserved_placement'] },
    { policy: 'reference_only', roles: ['style_reference'] },
    { policy: 'reusable', roles: ['style_reference', 'reserved_placement'] },
    { policy: 'transformable', roles: ['style_reference', 'transform_base', 'reserved_placement'] },
  ],
  limits: {
    maxImagesPerRequest: 4,
    maxReferences: 4,
    maxImagesPerDay: 20,
    imagesUsedToday: 2,
    monthlySpendLimit: null,
    spentThisMonth: 0.25,
    maxConcurrentRequests: 1,
  },
  promptVersion: 'edr-design-prompt/1',
};

function estimate(values: Partial<DesignEstimate> = {}): DesignEstimate {
  return {
    provider: 'openai',
    mode: 'guided',
    model: 'gpt-image-2.5-flare',
    quality: 'low',
    count: 2,
    requestSize: '1024x1280',
    outputWidth: 1024,
    outputHeight: 1280,
    adaptation: 'none',
    references: [
      {
        assetId: ASSET_LOGO.id,
        label: ASSET_LOGO.label,
        kind: 'brand_logo',
        usagePolicy: 'protected',
        role: 'reserved_placement',
        sent: false,
      },
    ],
    prompt: 'Design the visual background composition.',
    promptVersion: 'edr-design-prompt/1',
    cost: {
      status: 'unavailable',
      currency: null,
      perImage: null,
      total: null,
      basis: 'none',
      pricingSource: null,
      pricingCheckedOn: null,
    },
    imagesUsedToday: 2,
    maxImagesPerDay: 20,
    spentThisMonth: null,
    monthlySpendLimit: null,
    ...values,
  };
}

function generation(values: Partial<DesignGeneration> = {}): DesignGeneration {
  return {
    id: uuid(70),
    mode: 'guided',
    status: 'generating',
    contentType: 'match_preview',
    format: '4:5',
    model: 'gpt-image-2.5-flare',
    quality: 'low',
    requestedCount: 2,
    completedCount: 0,
    currentIndex: 1,
    parentProposalId: null,
    proposalIds: [],
    errorCode: null,
    errorMessage: null,
    retryAfterSeconds: null,
    cost: null,
    createdAt: T,
    startedAt: T,
    updatedAt: T,
    completedAt: null,
    ...values,
  };
}

function proposal(n: number, values: Partial<DesignProposal> = {}): DesignProposal {
  return {
    id: uuid(n),
    generationId: uuid(70),
    mode: 'guided',
    name: `Previa individual · 4:5 · ${String(n)}/2`,
    contentType: 'match_preview',
    format: '4:5',
    width: 1024,
    height: 1280,
    mime: 'image/png',
    status: 'pending_review',
    model: 'gpt-image-2.5-flare',
    quality: 'low',
    parentProposalId: null,
    references: [],
    decisionNote: null,
    decidedAt: null,
    createdAt: T,
    ...values,
  };
}

const P1 = proposal(1);
const P2 = proposal(2, { status: 'approved', decidedAt: T });
const P3 = proposal(3, {
  status: 'rejected',
  name: 'Calendario · 9:16 · 1/1',
  contentType: 'round_overview',
  format: '9:16',
});

function detail(value: DesignProposal): DesignProposalDetail {
  return {
    proposal: value,
    generation: {
      id: uuid(70),
      mode: 'guided',
      style: 'Épico',
      instructions: 'Estadio de noche.',
      inheritedInstructions: null,
      requestSize: '1024x1280',
      adaptation: 'none',
      prompt: 'Design the visual background composition.',
      promptVersion: 'edr-design-prompt/1',
      estimate: estimate().cost,
      requestedCount: 2,
      createdAt: T,
    },
    usage: {
      inputTextTokens: 120,
      inputImageTokens: 0,
      outputImageTokens: 1600,
      outputTextTokens: null,
      totalTokens: 1720,
    },
    cost: 0.0486,
    decisions: [],
    variantIds: [],
    layers: [],
    hasBackground: false,
  };
}

function renderSection(routes: Record<string, Handler | Handler[]> = {}) {
  const fake = fakeFetch({
    'GET /design/capabilities': () => jsonResponse(CAPABILITIES),
    'GET /design/proposals': () => jsonResponse({ proposals: [P1, P2, P3] }),
    'GET /brand/assets': () => jsonResponse({ assets: [ASSET_LOGO, ASSET_MASCOT, ASSET_REFERENCE, BACKGROUND] }),
    ...routes,
  });
  render(
    <DesignProposalsSection
      api={createDesignApi({ fetch: fake.fetch })}
      brandApi={createBrandApi({ fetch: fake.fetch })}
    />,
  );
  return fake;
}

function section(): HTMLElement {
  return screen.getByRole('region', { name: 'Propuestas visuales con IA' });
}

async function table(): Promise<HTMLElement> {
  return within(section()).findByRole('table', { name: 'Propuestas visuales generadas con IA' });
}

describe('DesignProposalsSection: provider status', () => {
  it('disables creation and explains when the provider is not configured or the key is missing', async () => {
    renderSection({
      'GET /design/capabilities': () =>
        jsonResponse({ ...CAPABILITIES, adapter: 'disabled', status: 'disabled', models: [] }),
    });
    expect(await screen.findByText('La generación de imágenes no está configurada en el servidor.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Crear diseño con IA/ }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    renderSection({ 'GET /design/capabilities': () => jsonResponse({ ...CAPABILITIES, status: 'missing_api_key' }) });
    expect(await screen.findByText(/EDR_IMAGE_API_KEY/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Crear diseño con IA/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the usage of the day and checks the model access on request only', async () => {
    const user = userEvent.setup();
    const fake = renderSection({
      'POST /design/capabilities/check': () =>
        jsonResponse({ model: 'gpt-image-2.5-flare', access: 'not_authorized', errorCode: 'ACCOUNT_NOT_AUTHORIZED' }),
    });
    expect(await screen.findByText('2 de 20 imágenes hoy')).toBeTruthy();
    expect(fake.requests.some((request) => request.url.includes('/check'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Comprobar acceso al modelo' }));
    expect(await screen.findByText(/La cuenta no está autorizada para el modelo/)).toBeTruthy();
  });
});

describe('DesignProposalsSection: creation, review and confirmation', () => {
  it('offers only the roles each usage policy allows and only active assets', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });

    const logoRoles = within(dialog).getByRole('combobox', { name: `Uso de «${ASSET_LOGO.label}»` });
    expect(
      within(logoRoles)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['No usar', 'Colocar el original en el diseño']);
    const referenceRoles = within(dialog).getByRole('combobox', { name: `Uso de «${ASSET_REFERENCE.label}»` });
    expect(
      within(referenceRoles)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['No usar', 'Inspiración de estilo (se envía a la IA)']);
    const backgroundRoles = within(dialog).getByRole('combobox', { name: `Uso de «${BACKGROUND.label}»` });
    expect(within(backgroundRoles).getAllByRole('option')).toHaveLength(4);
    expect(within(dialog).queryByRole('combobox', { name: `Uso de «${ASSET_MASCOT.label}»` })).toBeNull();
    for (const select of [logoRoles, referenceRoles, backgroundRoles]) {
      expect((select as HTMLSelectElement).value).toBe('');
    }
  });

  it('reviews the scope and cost, needs the confirmation, and starts one generation with a request key', async () => {
    const user = userEvent.setup();
    const created = deferred<Response>();
    const fake = renderSection({
      'POST /design/estimates': () => jsonResponse(estimate()),
      'POST /design/generations': () => created.promise,
      'GET /design/generations/00000000-0000-4000-8000-000000000070': () => jsonResponse(generation()),
    });
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Formato' }), '4:5');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Cantidad de propuestas/ }), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Épico' }));
    await user.type(within(dialog).getByRole('textbox', { name: /^Instrucciones/ }), 'Estadio de noche.');
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: `Uso de «${ASSET_LOGO.label}»` }),
      'reserved_placement',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }));

    const estimateRequest = fake.requests.find((request) => request.url.endsWith('/design/estimates'));
    expect(JSON.parse(String(estimateRequest?.body))).toEqual({
      mode: 'guided',
      contentType: 'match_preview',
      format: '4:5',
      model: 'gpt-image-2.5-flare',
      quality: 'low',
      count: 2,
      style: 'Épico',
      instructions: 'Estadio de noche.',
      references: [{ assetId: ASSET_LOGO.id, role: 'reserved_placement' }],
    });

    expect(await within(dialog).findByText('1024x1280')).toBeTruthy();
    expect(within(dialog).getByText('No se envía')).toBeTruthy();
    expect(within(dialog).getByText(/No hay una estimación confiable/)).toBeTruthy();
    const generate = within(dialog).getByRole('button', { name: 'Generar 2 propuestas' }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);

    await user.click(within(dialog).getByRole('checkbox', { name: /puede generar costos/ }));
    await user.click(generate);
    await user.click(generate);
    const creations = fake.requests.filter((request) => request.url.endsWith('/design/generations'));
    expect(creations).toHaveLength(1);
    const body = JSON.parse(String(creations[0]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ confirmCost: true, count: 2 });
    expect(String(body['requestKey'])).toMatch(/^[0-9a-f-]{36}$/);

    created.resolve(
      jsonResponse(
        {
          generation: generation({ status: 'queued', currentIndex: null }),
          statusUrl: `/api/v1/design/generations/${uuid(70)}`,
          eventsUrl: `/api/v1/design/generations/${uuid(70)}/events`,
        },
        202,
      ),
    );
    expect(await screen.findByText('Imagen 1 de 2 · Generando · 0 de 2 propuestas guardadas')).toBeTruthy();
    expect(screen.getByText(/no se muestran porcentajes/)).toBeTruthy();
    expect(FakeEventSource.instances[0]?.url).toBe(`/api/v1/design/generations/${uuid(70)}/events`);
  });

  it('shows the published estimate when there is one and keeps the server refusal visible', async () => {
    const user = userEvent.setup();
    renderSection({
      'POST /design/estimates': [
        () =>
          problemResponse(409, 'DESIGN_REFERENCE_REFUSED', {
            detail: 'La política «Protegido» de «Logo» no lo permite.',
          }),
        () =>
          jsonResponse(
            estimate({
              cost: {
                status: 'estimated',
                currency: 'USD',
                perImage: 0.05,
                total: 0.1,
                basis: 'published_output_cost',
                pricingSource: 'Lista de precios',
                pricingCheckedOn: '2026-11-05',
              },
            }),
          ),
      ],
    });
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });
    await user.click(within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }));
    expect(await within(dialog).findByText(/USD 0[.,]10/)).toBeTruthy();
    expect(within(dialog).getByText(/costo publicado de salida/)).toBeTruthy();
  });

  it('refuses invalid text before asking the server', async () => {
    const user = userEvent.setup();
    const fake = renderSection();
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Estilo/ }), { target: { value: 'Épico\u0007' } });
    expect(within(dialog).getByText('Usa solo texto imprimible.')).toBeTruthy();
    expect(
      (within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fake.requests.some((request) => request.url.endsWith('/design/estimates'))).toBe(false);
  });
});

describe('DesignProposalsSection: progress', () => {
  it('follows the server statuses and reloads the proposals when the generation ends', async () => {
    const fake = renderSection({
      'POST /design/estimates': () => jsonResponse(estimate()),
      'POST /design/generations': () =>
        jsonResponse(
          {
            generation: generation({ status: 'queued' }),
            statusUrl: `/api/v1/design/generations/${uuid(70)}`,
            eventsUrl: `/api/v1/design/generations/${uuid(70)}/events`,
          },
          202,
        ),
      'GET /design/generations/00000000-0000-4000-8000-000000000070': [
        () => jsonResponse(generation()),
        () =>
          jsonResponse(
            generation({
              status: 'failed',
              currentIndex: null,
              completedCount: 1,
              errorCode: 'RATE_LIMITED',
              errorMessage: 'El proveedor limitó las solicitudes.',
              retryAfterSeconds: 30,
              completedAt: T,
            }),
          ),
      ],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });
    await user.click(within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }));
    await user.click(await within(dialog).findByRole('checkbox', { name: /puede generar costos/ }));
    await user.click(within(dialog).getByRole('button', { name: /Generar/ }));
    await screen.findByText(/Imagen 1 de 2/);
    const listsBefore = fake.requests.filter((request) => request.url.endsWith('/design/proposals')).length;

    FakeEventSource.instances[0]?.emit('generation.failed', uuid(70));
    expect(
      await screen.findByText(/El proveedor limitó las solicitudes\. El proveedor pide esperar 30 segundos\./),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'La generación falló' })).toBeTruthy();
    await waitFor(() =>
      expect(fake.requests.filter((request) => request.url.endsWith('/design/proposals')).length).toBeGreaterThan(
        listsBefore,
      ),
    );
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });
});

describe('DesignProposalsSection: library, comparison and review', () => {
  it('lists the proposals in a table by default, with cards and a status filter', async () => {
    const user = userEvent.setup();
    renderSection();
    const list = await table();
    expect(within(list).getAllByRole('row')).toHaveLength(4);
    expect(within(list).getByRole('rowheader', { name: P1.name })).toBeTruthy();
    expect(within(section()).getByText('3 propuestas')).toBeTruthy();

    await user.selectOptions(within(section()).getByRole('combobox', { name: 'Estado' }), 'approved');
    expect(within(list).getAllByRole('row')).toHaveLength(2);
    expect(within(section()).getByText('1 de 3 propuestas')).toBeTruthy();

    await user.click(within(section()).getByRole('button', { name: 'Vista de tarjetas' }));
    const cards = within(section()).getByRole('list', { name: 'Propuestas visuales' });
    expect(
      within(cards)
        .getAllByRole('article')
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual([P2.name]);
  });

  it('compares two to four selected proposals', async () => {
    const user = userEvent.setup();
    renderSection();
    await table();
    const compare = within(section()).getByRole('button', { name: 'Comparar (0)' }) as HTMLButtonElement;
    expect(compare.disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: `Seleccionar ${P1.name} para comparar` }));
    await user.click(screen.getByRole('checkbox', { name: `Seleccionar ${P3.name} para comparar` }));
    await user.click(within(section()).getByRole('button', { name: 'Comparar (2)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Comparar propuestas' });
    expect(
      within(dialog)
        .getAllByRole('img')
        .map((image) => image.getAttribute('src')),
    ).toEqual([`/api/v1/design/proposals/${P1.id}/file`, `/api/v1/design/proposals/${P3.id}/file`]);
  });

  it('opens a proposal, approves it and updates the list', async () => {
    const user = userEvent.setup();
    const fake = renderSection({
      [`GET /design/proposals/${P1.id}`]: () => jsonResponse(detail(P1)),
      [`POST /design/proposals/${P1.id}/decisions`]: () =>
        jsonResponse({ ...P1, status: 'approved', decisionNote: null, decidedAt: T }),
    });
    await table();
    await user.click(screen.getByRole('button', { name: `Ver detalle de ${P1.name}` }));
    const dialog = await screen.findByRole('dialog', { name: `Propuesta: ${P1.name}` });
    expect(await within(dialog).findByText('Estadio de noche.')).toBeTruthy();
    expect(within(dialog).getByText('Aprobar una propuesta no crea ni cambia ninguna plantilla.')).toBeTruthy();
    expect(within(dialog).getByText('Generada con las instrucciones edr-design-prompt/1.')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Aprobar' }));
    const decisions = fake.requests.filter((request) => request.url.endsWith('/decisions'));
    expect(decisions.map((request) => JSON.parse(String(request.body)))).toEqual([{ decision: 'approved' }]);
    expect(await within(dialog).findByText('Propuesta marcada como: Aprobada.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: /Cerrar/ }));
    const row = within(await table())
      .getByRole('rowheader', { name: P1.name })
      .closest('tr') as HTMLElement;
    expect(within(row).getByText('Aprobada')).toBeTruthy();
  });

  it('turns a change request into a variant with the note as its new instructions', async () => {
    const user = userEvent.setup();
    const fake = renderSection({
      [`GET /design/proposals/${P1.id}`]: () => jsonResponse(detail(P1)),
      [`POST /design/proposals/${P1.id}/decisions`]: () =>
        jsonResponse({ ...P1, status: 'changes_requested', decisionNote: 'Más contraste.', decidedAt: T }),
      'POST /design/estimates': () => jsonResponse(estimate({ count: 1 })),
    });
    await table();
    await user.click(screen.getByRole('button', { name: `Ver detalle de ${P1.name}` }));
    const dialog = await screen.findByRole('dialog', { name: `Propuesta: ${P1.name}` });
    const request = await within(dialog).findByRole('button', { name: 'Solicitar cambios y generar variante' });
    await user.click(request);
    expect(within(dialog).getByText('Indica qué cambios necesita la propuesta.')).toBeTruthy();
    expect(fake.requests.some((entry) => entry.url.endsWith('/decisions'))).toBe(false);

    await user.type(within(dialog).getByRole('textbox', { name: /Qué debe cambiar/ }), 'Más contraste.');
    await user.click(within(dialog).getByRole('button', { name: 'Solicitar cambios y generar variante' }));
    const variant = await screen.findByRole('dialog', { name: 'Solicitar variante' });
    expect(within(variant).getByText(/La propuesta original no cambia/)).toBeTruthy();
    expect((within(variant).getByRole('textbox', { name: /Nuevas instrucciones/ }) as HTMLTextAreaElement).value).toBe(
      'Más contraste.',
    );
    await user.click(within(variant).getByRole('button', { name: 'Revisar alcance y costo' }));
    const body = JSON.parse(
      String(fake.requests.find((entry) => entry.url.endsWith('/design/estimates'))?.body),
    ) as Record<string, unknown>;
    expect(body).toMatchObject({ parentProposalId: P1.id, instructions: 'Más contraste.' });
    expect(fake.requests.some((entry) => entry.url.endsWith('/design/generations'))).toBe(false);
  });

  it('warns that a proposal made with older instructions does not change and needs a variant', async () => {
    const user = userEvent.setup();
    const old = detail(P1);
    renderSection({
      'GET /design/capabilities': () => jsonResponse({ ...CAPABILITIES, promptVersion: 'edr-design-prompt/2' }),
      [`GET /design/proposals/${P1.id}`]: () => jsonResponse(old),
    });
    await table();
    await user.click(screen.getByRole('button', { name: `Ver detalle de ${P1.name}` }));
    const dialog = await screen.findByRole('dialog', { name: `Propuesta: ${P1.name}` });
    expect(
      await within(dialog).findByText(/versión anterior de las instrucciones \(edr-design-prompt\/1\)/),
    ).toBeTruthy();
  });

  it('requests a variant from a proposal: the parent is sent and no asset can be a second base', async () => {
    const user = userEvent.setup();
    const parent = {
      ...detail(P1),
      proposal: {
        ...P1,
        references: [
          {
            assetId: BACKGROUND.id,
            label: BACKGROUND.label,
            kind: 'background' as const,
            usagePolicy: 'transformable' as const,
            role: 'style_reference' as const,
            sent: true,
          },
        ],
      },
    };
    const fake = renderSection({
      [`GET /design/proposals/${P1.id}`]: () => jsonResponse(parent),
      'POST /design/estimates': () => jsonResponse(estimate({ count: 1 })),
    });
    await table();
    await user.click(screen.getByRole('button', { name: `Ver detalle de ${P1.name}` }));
    const detailDialog = await screen.findByRole('dialog', { name: `Propuesta: ${P1.name}` });
    await user.click(await within(detailDialog).findByRole('button', { name: 'Solicitar variante' }));
    const dialog = await screen.findByRole('dialog', { name: 'Solicitar variante' });
    expect(within(dialog).getByText('Estadio de noche.')).toBeTruthy();
    const backgroundRoles = within(dialog).getByRole('combobox', {
      name: `Uso de «${BACKGROUND.label}»`,
    }) as HTMLSelectElement;
    expect(backgroundRoles.value).toBe('style_reference');
    expect(
      within(backgroundRoles).queryByRole('option', { name: 'Base para transformar (se envía a la IA)' }),
    ).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: /Nuevas instrucciones/ }), 'Más dorado.');
    await user.click(within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }));
    const body = JSON.parse(
      String(fake.requests.find((request) => request.url.endsWith('/design/estimates'))?.body),
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      parentProposalId: P1.id,
      instructions: 'Más dorado.',
      style: 'Épico',
      references: [{ assetId: BACKGROUND.id, role: 'style_reference' }],
    });
  });

  it('shows an empty library and a load failure with a retry', async () => {
    renderSection({ 'GET /design/proposals': () => jsonResponse({ proposals: [] }) });
    expect(await screen.findByRole('heading', { level: 3, name: 'Todavía no hay propuestas visuales.' })).toBeTruthy();
    cleanup();
    renderSection({ 'GET /design/proposals': () => problemResponse(500, 'INTERNAL') });
    const alert = await within(section()).findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar las propuestas');
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('DesignProposalsSection: original layers and deletion', () => {
  it('lists the originals placed without AI apart from the images sent, and allows one original per zone', async () => {
    const user = userEvent.setup();
    const secondLogo = asset({ id: uuid(91), kind: 'brand_logo', label: 'Logo alterno' });
    const fake = renderSection({
      'GET /brand/assets': () => jsonResponse({ assets: [ASSET_LOGO, secondLogo, ASSET_REFERENCE] }),
      'POST /design/estimates': () =>
        jsonResponse(
          estimate({
            references: [
              ...estimate().references,
              {
                assetId: ASSET_REFERENCE.id,
                label: ASSET_REFERENCE.label,
                kind: 'style_reference',
                usagePolicy: 'reference_only',
                role: 'style_reference',
                sent: true,
              },
            ],
          }),
        ),
    });
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });
    for (const label of [ASSET_LOGO.label, secondLogo.label]) {
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: `Uso de «${label}»` }),
        'reserved_placement',
      );
    }
    expect(within(dialog).getByRole('alert').textContent).toContain('un original por zona');
    expect(
      (within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: `Uso de «${secondLogo.label}»` }), '');
    await user.click(within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }));
    const placed = await within(dialog).findByRole('list', { name: 'Se colocan sin IA, tal como están en Mi marca' });
    expect(placed.textContent).toContain(ASSET_LOGO.label);
    const sent = within(dialog).getByRole('list', { name: 'Se envían a la IA' });
    expect(sent.textContent).toContain(ASSET_REFERENCE.label);
    expect(fake.requests.filter((request) => request.url.endsWith('/design/estimates'))).toHaveLength(1);
  });

  it('shows the placed originals and switches between the composed preview and the generated background', async () => {
    const user = userEvent.setup();
    renderSection({
      [`GET /design/proposals/${P1.id}`]: () =>
        jsonResponse({
          ...detail(P1),
          hasBackground: true,
          layers: [
            {
              assetId: ASSET_LOGO.id,
              label: ASSET_LOGO.label,
              kind: 'brand_logo',
              x: 369,
              y: 38,
              width: 287,
              height: 154,
            },
          ],
        }),
    });
    await table();
    await user.click(screen.getByRole('button', { name: `Ver detalle de ${P1.name}` }));
    const dialog = await screen.findByRole('dialog', { name: `Propuesta: ${P1.name}` });
    const layers = await within(dialog).findByRole('region', { name: 'Originales colocados sin IA' });
    expect(layers.textContent).toContain(ASSET_LOGO.label);
    expect(within(dialog).getByRole('img').getAttribute('src')).toBe(`/api/v1/design/proposals/${P1.id}/file`);
    await user.click(within(dialog).getByRole('button', { name: 'Ver solo el fondo generado' }));
    expect(within(dialog).getByRole('img').getAttribute('src')).toBe(`/api/v1/design/proposals/${P1.id}/background`);
  });

  it('deletes an unwanted proposal after a confirmation, from the list or from its detail', async () => {
    const user = userEvent.setup();
    const fake = renderSection({
      [`DELETE /design/proposals/${P3.id}`]: () => new Response(null, { status: 204 }),
      [`GET /design/proposals/${P1.id}`]: () => jsonResponse(detail(P1)),
      [`DELETE /design/proposals/${P1.id}`]: () =>
        problemResponse(409, 'RUN_IN_PROGRESS', { detail: 'Hay una variante de esta propuesta en generación.' }),
    });
    const list = await table();
    await user.click(within(list).getByRole('button', { name: `Eliminar ${P3.name}` }));
    const confirm = await screen.findByRole('dialog', { name: 'Eliminar propuesta' });
    expect(fake.requests.some((request) => request.method === 'DELETE')).toBe(false);
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(within(list).queryByRole('rowheader', { name: P3.name })).toBeNull());
    expect(screen.getByText(`Propuesta «${P3.name}» eliminada.`)).toBeTruthy();
    expect(within(section()).getByText('2 propuestas')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: `Ver detalle de ${P1.name}` }));
    const dialog = await screen.findByRole('dialog', { name: `Propuesta: ${P1.name}` });
    await user.click(await within(dialog).findByRole('button', { name: `Eliminar ${P1.name}` }));
    const second = await screen.findByRole('dialog', { name: 'Eliminar propuesta' });
    await user.click(within(second).getByRole('button', { name: 'Eliminar' }));
    expect(await within(second).findByRole('alert')).toBeTruthy();
    expect(within(list).getByRole('rowheader', { name: P1.name })).toBeTruthy();
  });
});

describe('DesignProposalsSection: the two generation modes', () => {
  const MASTER = `# MASTER PROMPT\n\nCreate a poster with "EQUIPO A".\n${'- Detail with floodlights.\n'.repeat(250)}`;

  it('explains both modes side by side', async () => {
    renderSection();
    const guide = await within(section()).findByRole('table', { name: '¿Qué modo uso?' });
    expect(within(guide).getByRole('columnheader', { name: 'Diseño de plantilla (guiado)' })).toBeTruthy();
    expect(within(guide).getByRole('columnheader', { name: 'Prompt propio (inspiración)' })).toBeTruthy();
    expect(guide.textContent).toContain('podrá usarse como base de plantilla en la siguiente fase');
    expect(guide.textContent).toContain('«Transformable»');
  });

  it('sends an own prompt longer than 2000 characters whole, without the style field, and shows its counter', async () => {
    const user = userEvent.setup();
    const fake = renderSection({
      'POST /design/estimates': () => jsonResponse(estimate({ mode: 'own_prompt', prompt: MASTER })),
    });
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });
    expect(within(dialog).getByRole('textbox', { name: /^Estilo/ })).toBeTruthy();

    await user.click(within(dialog).getByRole('radio', { name: /Prompt propio \(inspiración\)/ }));
    expect(within(dialog).queryByRole('textbox', { name: /^Estilo/ })).toBeNull();
    expect(within(dialog).getByText(/Para que la IA dibuje a Ketsi, sube en Mi marca una copia/)).toBeTruthy();
    const logoRoles = within(dialog).getByRole('combobox', { name: `Uso de «${ASSET_LOGO.label}»` });
    expect(
      within(logoRoles)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['No usar', 'Colocar el original en el diseño']);
    const referenceRoles = within(dialog).getByRole('combobox', { name: `Uso de «${ASSET_REFERENCE.label}»` });
    expect(
      within(referenceRoles).getByRole('option', { name: 'Enviar como imagen (se usa según tu prompt)' }),
    ).toBeTruthy();

    expect(
      (within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Tu prompt \(se envía tal cual\)/ }), {
      target: { value: MASTER },
    });
    expect(MASTER.length).toBeGreaterThan(5000);
    expect(within(dialog).getByText(/de 12[.,]000 caracteres/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }));
    const body = JSON.parse(
      String(fake.requests.find((entry) => entry.url.endsWith('/design/estimates'))?.body),
    ) as Record<string, unknown>;
    expect(body['mode']).toBe('own_prompt');
    expect(body['instructions']).toBe(MASTER.trim());
    expect(body).not.toHaveProperty('style');
    expect(await within(dialog).findByText('Prompt propio · inspiración')).toBeTruthy();
    expect(within(dialog).getByText(/Se envía tu prompt tal cual/)).toBeTruthy();
  });

  it('refuses a prompt over 12000 characters instead of cutting it', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole('button', { name: /Crear diseño con IA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Crear diseño con IA' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Instrucciones/ }), {
      target: { value: 'x'.repeat(12001) },
    });
    expect((within(dialog).getByRole('textbox', { name: /^Instrucciones/ }) as HTMLTextAreaElement).value).toHaveLength(
      12001,
    );
    expect(within(dialog).getByText('Admite como máximo 12000 caracteres.')).toBeTruthy();
    expect(
      (within(dialog).getByRole('button', { name: 'Revisar alcance y costo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows the mode of each proposal and filters by mode', async () => {
    const user = userEvent.setup();
    renderSection({
      'GET /design/proposals': () => jsonResponse({ proposals: [P1, { ...P2, mode: 'own_prompt' }, P3] }),
    });
    const list = await table();
    expect(within(list).getAllByText('Prompt propio · inspiración')).toHaveLength(1);
    await user.selectOptions(within(section()).getByRole('combobox', { name: 'Modo' }), 'own_prompt');
    expect(within(list).getAllByRole('row')).toHaveLength(2);
    expect(within(list).getByRole('rowheader', { name: P2.name })).toBeTruthy();
  });

  it('turns a change request on an own prompt proposal into the whole prompt plus the changes, from the image or from scratch', async () => {
    const user = userEvent.setup();
    const own = { ...P1, mode: 'own_prompt' as const };
    const base = detail(own);
    const fake = renderSection({
      'GET /design/proposals': () => jsonResponse({ proposals: [own] }),
      [`GET /design/proposals/${P1.id}`]: () =>
        jsonResponse({
          ...base,
          generation: { ...base.generation, mode: 'own_prompt', style: null, instructions: 'MASTER\nLínea 2' },
        }),
      [`POST /design/proposals/${P1.id}/decisions`]: () =>
        jsonResponse({ ...own, status: 'changes_requested', decisionNote: 'Ketsi a la derecha.', decidedAt: T }),
      'POST /design/estimates': () => jsonResponse(estimate({ mode: 'own_prompt', count: 1 })),
    });
    await table();
    await user.click(screen.getByRole('button', { name: `Ver detalle de ${P1.name}` }));
    const dialog = await screen.findByRole('dialog', { name: `Propuesta: ${P1.name}` });
    const note = await within(dialog).findByRole('textbox', { name: /Qué debe cambiar/ });
    fireEvent.change(note, { target: { value: 'x'.repeat(1201) } });
    expect((note as HTMLTextAreaElement).value).toHaveLength(1201);
    expect(within(dialog).getByText(/^1[.,]201 de 1[.,]200 caracteres$/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Solicitar cambios y generar variante' }));
    expect(within(dialog).getByText(/como máximo 1[.,]200 caracteres: describe solo lo que cambia/)).toBeTruthy();
    expect(fake.requests.some((entry) => entry.url.endsWith('/decisions'))).toBe(false);

    fireEvent.change(note, { target: { value: 'Ketsi a la derecha.' } });
    await user.click(within(dialog).getByRole('button', { name: 'Solicitar cambios y generar variante' }));
    const variant = await screen.findByRole('dialog', { name: 'Solicitar variante' });
    expect(
      (within(variant).getByRole('textbox', { name: /Cambios para la imagen anterior/ }) as HTMLTextAreaElement).value,
    ).toBe('Ketsi a la derecha.');
    expect(within(variant).queryByText('Instrucciones originales (se conservan)')).toBeNull();
    expect(within(variant).getByRole('radio', { name: /Editar la imagen anterior/ })).toHaveProperty('checked', true);
    await user.click(within(variant).getByRole('button', { name: 'Revisar alcance y costo' }));
    const estimates = () =>
      fake.requests
        .filter((entry) => entry.url.endsWith('/design/estimates'))
        .map((entry) => JSON.parse(String(entry.body)) as Record<string, unknown>);
    expect(estimates()[0]).toMatchObject({
      mode: 'own_prompt',
      parentProposalId: P1.id,
      instructions: 'Ketsi a la derecha.',
    });

    await user.click(within(variant).getByRole('button', { name: 'Volver a editar' }));
    await user.click(within(variant).getByRole('radio', { name: /Generar desde cero con este prompt/ }));
    expect(within(variant).getByText(/sin partir de la anterior/)).toBeTruthy();
    expect((within(variant).getByRole('textbox', { name: /Tu prompt/ }) as HTMLTextAreaElement).value).toBe(
      'MASTER\nLínea 2\n\nCAMBIOS SOLICITADOS:\nKetsi a la derecha.',
    );
    await user.click(within(variant).getByRole('button', { name: 'Revisar alcance y costo' }));
    expect(estimates()[1]).toMatchObject({
      mode: 'own_prompt',
      instructions: 'MASTER\nLínea 2\n\nCAMBIOS SOLICITADOS:\nKetsi a la derecha.',
    });
    expect(estimates()[1]).not.toHaveProperty('parentProposalId');
  });
});
