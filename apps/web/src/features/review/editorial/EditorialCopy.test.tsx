/**
 * Editorial copy of the review (PD-ARCH-01H) over the fake server: the labels of who wrote the text and how, the
 * generation of the five deliverables, the tabs, copying, approval bound to the version, flags, the cost
 * confirmation of a billed writer, edits, regeneration with an instruction and the "Investigación y fuentes" panel.
 */
import type { EditorialPackage, EditorialVersion } from '@edr/contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DRAFT_PATH,
  PROJECT_ID,
  draftResponse,
  editorialPackage,
  fakeServer,
  json,
  openCopyTab,
  openMode,
  renderApp,
} from '../test/support';

import { editorialFileName, editorialText } from './download';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const REVIEW = `/projects/${PROJECT_ID}/review`;
const EDITORIAL = `/api/v1/projects/${PROJECT_ID}/editorial`;
const T1 = '2026-11-10T10:00:00Z';

function version(
  overrides: Partial<EditorialVersion> & Pick<EditorialVersion, 'deliverable' | 'fields'>,
): EditorialVersion {
  return {
    id: 'b0000000-0000-4000-8000-000000000001',
    versionNumber: 1,
    origin: 'generated',
    state: 'ready',
    flags: [],
    generationId: 'b0000000-0000-4000-8000-0000000000aa',
    instructions: null,
    eventIds: [],
    evidenceIds: ['ev-m1'],
    createdAt: T1,
    approvedAt: null,
    ...overrides,
  };
}

const MAIN = version({
  deliverable: 'facebook_instagram',
  fields: [
    { name: 'headline', text: 'NADIE LO VIO VENIR', words: 4, characters: 18 },
    { name: 'body', text: 'Equipo Norte 3-0 Equipo Sur y la jornada ardió.', words: 9, characters: 47 },
    { name: 'question', text: '¿Fue goleada o paseo?', words: 4, characters: 21 },
    { name: 'hashtags', text: '#ElDeporteRey #Futbol', words: 2, characters: 21 },
  ],
});
const TIKTOK = version({
  id: 'b0000000-0000-4000-8000-000000000002',
  deliverable: 'tiktok_reels',
  fields: [{ name: 'copy', text: 'Corto y al pie: 3-0.', words: 5, characters: 20 }],
});

function withVersions(
  overrides: Partial<EditorialPackage> = {},
  current: EditorialVersion[] = [MAIN, TIKTOK],
): EditorialPackage {
  const base = editorialPackage(overrides);
  return {
    ...base,
    deliverables: base.deliverables.map((entry) => {
      const found = current.find((item) => item.deliverable === entry.deliverable) ?? null;
      // The server's export eligibility (REVIEW-APPROVAL-01): here every approved fixture keeps publishable data.
      return {
        ...entry,
        current: found,
        versionCount: found === null ? 0 : 1,
        exportable: found?.state === 'approved',
      };
    }),
  };
}

const generation = {
  id: 'b0000000-0000-4000-8000-0000000000aa',
  status: 'succeeded',
  deliverables: ['facebook_instagram', 'tiktok_reels', 'viral_headlines', 'youtube', 'debate_question'],
  instructions: null,
  adapter: 'stub',
  writerKind: 'test',
  model: null,
  promptVersion: 'edr-editorial-v1',
  researchMode: 'local_context',
  errorCode: null,
  errorMessage: null,
  estimatedCost: null,
  computedCost: null,
  createdAt: T1,
  completedAt: T1,
};

/** The editorial section once its package is loaded (the loading state is replaced), in the «Copy editorial» mode. */
async function section() {
  await openMode('Copy editorial');
  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Copy editorial' }).getAttribute('aria-busy')).toBeNull();
  });
  return screen.getByRole('region', { name: 'Copy editorial' });
}

describe('Editorial copy of the review (PD-ARCH-01H)', () => {
  it('says who wrote the text and how, and generates the five deliverables', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [`GET ${EDITORIAL}`]: [() => json(editorialPackage()), () => json(withVersions())],
      [`POST ${EDITORIAL}/generations`]: () => json({ generation, package: withVersions() }, 201),
    });
    renderApp(REVIEW, server);
    const region = await section();
    expect(within(region).getByText('Texto de prueba (sin IA)')).toBeTruthy();
    expect(within(region).getByText('Generado con contexto local')).toBeTruthy();
    expect(within(region).queryByText('Enriquecido con investigación verificada')).toBeNull();
    expect(within(region).getByText('Todavía no hay copy editorial para este borrador.')).toBeTruthy();

    await userEvent.click(within(region).getByRole('button', { name: 'Generar copy editorial' }));
    // Only the deliverables that exist get a tab, then the carousel's own text (UX-REVIEW-01).
    const tabs = await within(region).findByRole('tablist', { name: 'Entregables del copy editorial' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Facebook / Instagram', 'TikTok / Reels', 'Texto del carrusel']);
    const post = server.callsTo('POST', `${EDITORIAL}/generations`)[0];
    expect(post?.body).toEqual({ requestKey: expect.stringMatching(/^[0-9a-f-]{36}$/u) });
    expect(within(region).getByText('NADIE LO VIO VENIR')).toBeTruthy();
    expect(within(region).getByText('Listo para aprobar')).toBeTruthy();
    expect(server.unexpected).toEqual([]);
  });

  it('copies one field or the whole deliverable and switches deliverables with the tabs', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(), [`GET ${EDITORIAL}`]: () => json(withVersions()) });
    renderApp(REVIEW, server);
    const region = await section();
    await within(region).findByText('NADIE LO VIO VENIR');
    await user.click(within(region).getByRole('button', { name: 'Copiar Gancho' }));
    expect(await navigator.clipboard.readText()).toBe('NADIE LO VIO VENIR');
    expect(await within(region).findByText('Copiado al portapapeles.')).toBeTruthy();
    await user.click(within(region).getByRole('button', { name: 'Copiar texto' }));
    expect(await navigator.clipboard.readText()).toContain('¿Fue goleada o paseo?');
    await openCopyTab('TikTok / Reels');
    expect(within(region).getByText('Corto y al pie: 3-0.')).toBeTruthy();
  });

  it('approves the exact current version and shows the flags that block an approval', async () => {
    const flagged = {
      ...TIKTOK,
      state: 'flagged' as const,
      flags: [{ code: 'UNVERIFIED_NUMBER' as const, field: 'copy', excerpt: '3-0' }],
    };
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [`GET ${EDITORIAL}`]: [
        () => json(withVersions({}, [MAIN, flagged])),
        () => json(withVersions({}, [{ ...MAIN, state: 'approved', approvedAt: T1 }, flagged])),
      ],
      [`PUT ${EDITORIAL}/deliverables/facebook_instagram/approval`]: () =>
        json({ ...MAIN, state: 'approved', approvedAt: T1 }),
    });
    renderApp(REVIEW, server);
    const region = await section();
    await within(region).findByText('NADIE LO VIO VENIR');
    await userEvent.click(within(region).getByRole('button', { name: 'Aprobar copy' }));
    expect(await within(region).findByRole('button', { name: 'Retirar aprobación' })).toBeTruthy();
    expect(server.callsTo('PUT', `${EDITORIAL}/deliverables/facebook_instagram/approval`)[0]?.body).toEqual({
      versionId: MAIN.id,
    });
    await openCopyTab('TikTok / Reels');
    const alert = within(region).getByRole('alert');
    expect(alert.textContent).toContain('Número que no es un dato confirmado: «3-0»');
    expect((within(region).getByRole('button', { name: 'Aprobar copy' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('needs an explicit cost confirmation before a billed generation', async () => {
    const billed = editorialPackage({
      writer: {
        adapter: 'openai-compatible',
        kind: 'hosted_ai',
        model: 'gpt-test-mini',
        status: 'ready',
        requiresCostConfirmation: true,
        pricing: {
          currency: 'USD',
          inputPerMillionTokens: 2,
          outputPerMillionTokens: 10,
          source: 'x',
          checkedOn: '2026-11-10',
        },
        maxGenerationsPerDay: 30,
        generationsToday: 3,
        monthlySpendLimit: 5,
        spentThisMonth: 0.12,
        estimate: { status: 'estimated', total: 0.0815 },
      },
    });
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [`GET ${EDITORIAL}`]: () => json(billed),
      [`POST ${EDITORIAL}/generations`]: () => json({ generation, package: withVersions() }, 201),
    });
    renderApp(REVIEW, server);
    const region = await section();
    expect(within(region).getByText('Escrito por IA (gpt-test-mini)')).toBeTruthy();
    expect(within(region).getByText('Costo estimado: hasta US$ 0.0815 por generación.')).toBeTruthy();
    expect(within(region).getByText(/Generaciones hoy: 3 de 30/u)).toBeTruthy();
    const button = within(region).getByRole('button', { name: 'Generar copy editorial' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(
      within(region).getByRole('checkbox', { name: 'Confirmo el costo estimado de esta generación' }),
    );
    expect(button.disabled).toBe(false);
    await userEvent.click(button);
    await waitFor(() => expect(server.callsTo('POST', `${EDITORIAL}/generations`)).toHaveLength(1));
    expect(server.callsTo('POST', `${EDITORIAL}/generations`)[0]?.body).toMatchObject({ confirmCost: true });
  });

  it('edits the changed fields only and regenerates one deliverable with an instruction', async () => {
    const user = userEvent.setup();
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [`GET ${EDITORIAL}`]: () => json(withVersions()),
      [`POST ${EDITORIAL}/deliverables/facebook_instagram/edits`]: () => json({ ...MAIN, origin: 'edited' }, 201),
      [`POST ${EDITORIAL}/generations`]: () => json({ generation, package: withVersions() }, 201),
    });
    renderApp(REVIEW, server);
    const region = await section();
    await within(region).findByText('NADIE LO VIO VENIR');
    await user.click(within(region).getByRole('button', { name: 'Editar texto' }));
    const question = within(region).getByRole('textbox', { name: 'Pregunta' });
    await user.clear(question);
    await user.type(question, '¿Paseo o goleada?');
    await user.click(within(region).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(server.callsTo('POST', `${EDITORIAL}/deliverables/facebook_instagram/edits`)).toHaveLength(1),
    );
    expect(server.callsTo('POST', `${EDITORIAL}/deliverables/facebook_instagram/edits`)[0]?.body).toEqual({
      baseVersionId: MAIN.id,
      fields: [{ name: 'question', text: '¿Paseo o goleada?' }],
    });

    await user.type(
      within(region).getByRole('textbox', { name: /Instrucciones para regenerar/u }),
      'Reduce el sarcasmo',
    );
    // The stub writer is never presented as AI.
    await user.click(within(region).getByRole('button', { name: 'Regenerar texto de prueba' }));
    await waitFor(() => expect(server.callsTo('POST', `${EDITORIAL}/generations`)).toHaveLength(1));
    expect(server.callsTo('POST', `${EDITORIAL}/generations`)[0]?.body).toMatchObject({
      deliverable: 'facebook_instagram',
      instructions: 'Reduce el sarcasmo',
    });
  });

  it('lists the events, sources, unverified information and discrepancies apart from the copy', async () => {
    const evidence = {
      id: 'ev-m1',
      factType: 'match_result' as const,
      description: 'Equipo Norte 3-0 Equipo Sur',
      competitionId: null,
      seasonId: null,
      roundId: null,
      matchKey: 'm-1',
      factIds: [],
      source: { kind: 'local' as const, name: 'Datos locales de la competición', url: null },
      publishedAt: null,
      retrievedAt: T1,
      verification: 'CONFIRMED' as const,
      conflicts: [],
    };
    const pkg = editorialPackage({
      research: {
        mode: 'local_context',
        retrievedAt: T1,
        keyEvents: [
          {
            id: 'evt-m1-thrashing',
            kind: 'thrashing',
            description: 'Goleada: Equipo Norte 3-0 Equipo Sur',
            matchKey: 'm-1',
            evidenceIds: ['ev-m1'],
          },
        ],
        evidence: [evidence],
        unverified: [
          { ...evidence, id: 'ev-out-1', description: 'Equipo Este - Equipo Oeste', verification: 'UNVERIFIED' },
        ],
        conflicts: [
          {
            ...evidence,
            id: 'ev-out-2',
            description: 'Equipo Uno - Equipo Dos',
            verification: 'CONFLICTING',
            conflicts: ['Las fuentes no coinciden.'],
          },
        ],
      },
      context: {
        ...(editorialPackage().context as NonNullable<EditorialPackage['context']>),
        roundState: {
          status: 'incomplete',
          basis: 'local_round',
          total: 5,
          finished: 3,
          inProgress: 1,
          pending: 1,
          postponed: 0,
          cancelled: 0,
        },
      },
    });
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(), [`GET ${EDITORIAL}`]: () => json(pkg) });
    renderApp(REVIEW, server);
    const region = await section();
    expect(within(region).getByRole('note').textContent).toContain('Jornada sin terminar: 3 de 5 partidos finalizados');
    await userEvent.click(within(region).getByText('Investigación y fuentes'));
    expect(within(region).getByText('Goleada: Equipo Norte 3-0 Equipo Sur')).toBeTruthy();
    expect(within(region).getByText('Equipo Norte 3-0 Equipo Sur')).toBeTruthy();
    expect(within(region).getByText('Equipo Este - Equipo Oeste')).toBeTruthy();
    expect(within(region).getByText('Las fuentes no coinciden.')).toBeTruthy();
    expect(within(region).getAllByText(/Fecha de consulta/u).length).toBeGreaterThan(0);
    expect(within(region).getByText(/No se consultaron fuentes externas/u)).toBeTruthy();
  });

  it('explains why nothing can be generated without confirmed facts', async () => {
    const server = fakeServer({
      [DRAFT_PATH]: draftResponse(),
      [`GET ${EDITORIAL}`]: () => json(editorialPackage({ available: false, unavailableReason: 'no_confirmed_facts' })),
    });
    renderApp(REVIEW, server);
    const region = await section();
    expect(within(region).getByText(/Ningún partido del borrador tiene datos confirmados/u)).toBeTruthy();
    expect(within(region).queryByRole('button', { name: 'Generar copy editorial' })).toBeNull();
  });
});

describe('Download of the editorial copy (PD-ARCH-01H)', () => {
  const youtube = version({
    id: 'b0000000-0000-4000-8000-000000000003',
    deliverable: 'youtube',
    state: 'approved',
    approvedAt: T1,
    fields: [
      { name: 'title', text: 'Mestalla se apagó', words: 3, characters: 17 },
      { name: 'description', text: 'Análisis de la jornada.', words: 4, characters: 23 },
    ],
  });

  it('writes one paste-ready text per network with its review status, and no sources', () => {
    const flagged = { ...TIKTOK, state: 'flagged' as const };
    const text = editorialText(withVersions({}, [MAIN, flagged, youtube]), new Date(T1)) ?? '';
    expect(text.startsWith('COPY EDITORIAL · Liga de Prueba · Fase regular · Jornada 3 · 2026/27\n\n')).toBe(true);
    expect(text).toContain('Texto de prueba (sin IA) · Generado con contexto local');
    expect(text).toContain(
      '=== FACEBOOK E INSTAGRAM (Listo para aprobar · Versión 1) ===\n\nNADIE LO VIO VENIR\n\n' +
        'Equipo Norte 3-0 Equipo Sur y la jornada ardió.\n\n¿Fue goleada o paseo?\n\n#ElDeporteRey #Futbol',
    );
    expect(text).toContain('=== TIKTOK Y REELS (Con avisos · Versión 1) ===\n\nCorto y al pie: 3-0.');
    expect(text).toContain(
      '=== YOUTUBE (Aprobado · Versión 1) ===\n\nTítulo:\nMestalla se apagó\n\nDescripción:\nAnálisis de la jornada.',
    );
    expect(text).not.toContain('PREGUNTA DE DEBATE');
    expect(text).not.toMatch(/Datos locales|https?:|ev-m1/u);
    expect(editorialText(editorialPackage(), new Date(T1))).toBeNull();
  });

  it('names the file after the competition and the stage', () => {
    expect(editorialFileName(editorialPackage())).toBe('copy-editorial-liga-de-prueba-fase-regular-jornada-3.txt');
    expect(editorialFileName(editorialPackage({ context: null }))).toBe('copy-editorial.txt');
  });

  it('downloads the file from the review once there is copy', async () => {
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:editorial-download';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const server = fakeServer({ [DRAFT_PATH]: draftResponse(), [`GET ${EDITORIAL}`]: () => json(withVersions()) });
    renderApp(REVIEW, server);
    const region = await section();
    await within(region).findByText('NADIE LO VIO VENIR');
    await userEvent.click(within(region).getByRole('button', { name: 'Descargar copys (.txt)' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]?.type).toBe('text/plain;charset=utf-8');
    expect(await blobs[0]?.text()).toContain('=== TIKTOK Y REELS (Listo para aprobar · Versión 1) ===');
    expect(await within(region).findByText('Copys descargados.')).toBeTruthy();
    expect(server.unexpected).toEqual([]);
  });

  it('offers no download before any copy exists', async () => {
    const server = fakeServer({ [DRAFT_PATH]: draftResponse() });
    renderApp(REVIEW, server);
    const region = await section();
    expect(within(region).queryByRole('button', { name: 'Descargar copys (.txt)' })).toBeNull();
  });
});
