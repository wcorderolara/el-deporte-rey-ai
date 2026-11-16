/**
 * Editorial domain (PD-ARCH-01H): the typed context of a draft from its facts (only confirmed matches reach the
 * writer; unverified and disputed ones are listed), the round state (local round, selection, unknown), the
 * deterministic key events and their ranking, the deterministic checks of the deliverables (numbers, hook, lengths,
 * hashtags, claims about unfinished rounds and standings, references), operator edits and the cost figures. Synthetic
 * data only; the writer is the stub.
 */
import { EDITORIAL_DELIVERABLES } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import {
  type EditorialRequest,
  type EditorialWriterDescription,
  parseEditorialRequest,
  parseEditorialResponse,
  stubEditorialAnswer,
} from '../../providers/ai/index.js';
import { FactIndex, draftContextOf } from '../content/index.js';
import { Facts, PROJECT_ID, contentInput, leagueFacts } from '../content/test/support.js';

import { composeDeliverable, countWords, rawDeliverables, rawOfEdit, retokenize } from './compose.js';
import {
  EDITORIAL_LIMITS,
  type EditorialCore,
  type EditorialInput,
  buildEditorialCore,
  buildEditorialRequest,
  roundStateOf,
} from './core.js';
import { computedCost, estimateCost, utcDayStart, utcMonthStart } from './cost.js';

const DRAFT_ID = '44444444-4444-4444-8444-444444444444';

function editorialInput(facts: Facts, overrides: Partial<EditorialInput> = {}): EditorialInput {
  const content = contentInput(
    facts,
    overrides.contentKind === undefined ? {} : { contentKind: overrides.contentKind },
  );
  return {
    projectId: PROJECT_ID,
    draft: { id: DRAFT_ID, createdAt: '2026-11-10T10:00:00.000Z', excludedMatchKeys: [] },
    language: 'es',
    contentKind: 'results',
    draftContext: draftContextOf(content),
    facts: facts.facts,
    teamAliases: facts.aliases,
    standings: { available: false, reason: 'not_provided_for_stage' },
    local: null,
    localRound: null,
    sourceName: 'Datos locales de la competición',
    ...overrides,
  };
}

function requestOf(core: EditorialCore, input: EditorialInput, instructions: string | null = null): EditorialRequest {
  return parseEditorialRequest(buildEditorialRequest(core, input, EDITORIAL_DELIVERABLES, instructions));
}

/** Composes the stub's answer (or an override of one deliverable's raw text). */
function compose(
  core: EditorialCore,
  request: EditorialRequest,
  deliverable: (typeof EDITORIAL_DELIVERABLES)[number],
  raw?: Record<string, unknown>,
) {
  const response = parseEditorialResponse(stubEditorialAnswer(request), request);
  const raws = rawDeliverables(request, response);
  return composeDeliverable(deliverable, (raw ?? raws.get(deliverable) ?? {}) as never, core, {
    eventIds: response.keyEventIds,
    evidenceIds: response.evidenceIds,
  });
}

function fiveMatches(): Facts {
  return new Facts()
    .team('a', 'Equipo Alfa')
    .team('b', 'Equipo Beta')
    .team('c', 'Equipo Gama')
    .team('d', 'Equipo Delta')
    .team('e', 'Equipo Épsilon')
    .team('f', 'Equipo Zeta')
    .team('g', 'Equipo Eta')
    .team('h', 'Equipo Theta')
    .team('i', 'Equipo Iota')
    .team('j', 'Equipo Kappa')
    .match('k-1', { home: 'a', away: 'b', score: [2, 1] })
    .match('k-2', { home: 'c', away: 'd', score: [4, 0] })
    .match('k-3', { home: 'e', away: 'f', score: [1, 3] })
    .match('k-4', { home: 'g', away: 'h', score: [3, 3] })
    .match('k-5', { home: 'i', away: 'j', score: [0, 0] });
}

describe('editorial context (encargo sections 3, 4 and 6)', () => {
  it('builds the context of a draft with confirmed matches, evidence and placeholders only for them', () => {
    const input = editorialInput(leagueFacts());
    const core = buildEditorialCore(input);
    expect(core.context).toMatchObject({
      competitionName: 'Liga Demo',
      seasonLabel: '2026/27',
      contentKind: 'results',
      matchCount: 2,
      confirmedMatchCount: 2,
      standingsAvailable: false,
      roundState: { status: 'complete', basis: 'selection', total: 2, finished: 2 },
    });
    expect(core.evidence.map((item) => [item.id, item.verification, item.source.kind, item.source.url])).toEqual([
      ['ev-m1', 'CONFIRMED', 'local', null],
      ['ev-m2', 'CONFIRMED', 'local', null],
    ]);
    expect(core.evidence[0]?.description).toBe('Atlético Río Ébano 2-1 Real Brisamar');
    expect(core.bindings.get('{{f:m1:score}}')?.text).toBe('2-1');
    expect(core.bindings.get('{{f:m1:result}}')?.provenance).toBe('template_text');
    const request = requestOf(core, input);
    expect(request.matches.map((match) => match.ref)).toEqual(['m1', 'm2']);
    expect(request.research).toEqual({ mode: 'local_context' });
    expect(request.evidence.every((item) => item.verification === 'CONFIRMED')).toBe(true);
    expect(JSON.stringify(request)).not.toMatch(/liga-demo-1-a|football-data|https?:/u);
  });

  it('keeps unverified and disputed matches out of the writer request and lists them for the operator', () => {
    const facts = new Facts()
      .team('a', 'Equipo Alfa')
      .team('b', 'Equipo Beta')
      .team('c', 'Equipo Gama')
      .team('d', 'Equipo Delta')
      .team('e', 'Equipo Épsilon')
      .team('f', 'Equipo Zeta')
      .match('m-ok', { home: 'a', away: 'b', score: [1, 0] })
      .match('m-candidate', { home: 'c', away: 'd', score: [2, 2], mode: 'candidate' })
      .match('m-disputed', { home: 'e', away: 'f', score: [5, 1], scoreMode: 'disputed' });
    const input = editorialInput(facts);
    const core = buildEditorialCore(input);
    expect(core.context.confirmedMatchCount).toBe(1);
    expect(core.unverified.map((item) => item.matchKey)).toEqual(['m-candidate']);
    expect(core.conflicts.map((item) => item.matchKey)).toEqual(['m-disputed']);
    expect(core.conflicts[0]?.conflicts[0]).toContain('no coinciden');
    const request = requestOf(core, input);
    expect(request.matches).toHaveLength(1);
    expect(request.facts.map((fact) => fact.display)).not.toContain('5-1');
    expect(request.facts.map((fact) => fact.display)).not.toContain('Equipo Gama');
    // The disputed thrashing is not an event: events come from confirmed scores only.
    expect(core.keyEvents.map((event) => event.kind)).toEqual(['home_win']);
  });

  it('ranks at most three match events by editorial potential', () => {
    const core = buildEditorialCore(editorialInput(fiveMatches()));
    expect(core.keyEvents.map((event) => [event.kind, event.matchKey])).toEqual([
      ['thrashing', 'k-2'],
      ['high_scoring', 'k-4'],
      ['away_win', 'k-3'],
    ]);
    expect(core.keyEvents[0]?.description).toBe('Goleada: Equipo Gama 4-0 Equipo Delta');
    // Match references follow the plan's order (kickoff, then home team name by code point).
    expect(core.keyEvents[0]?.evidenceIds).toEqual(['ev-m3']);
  });

  it('reads the round state from the local round and marks an unfinished round', () => {
    const input = editorialInput(leagueFacts(), {
      local: {
        competitionId: '11111111-1111-4111-8111-111111111111',
        seasonId: '55555555-5555-4555-8555-555555555555',
        roundId: '66666666-6666-4666-8666-666666666666',
        roundName: 'Jornada 1',
      },
      localRound: { total: 5, finished: 2, inProgress: 1, scheduled: 1, postponed: 1, cancelled: 0 },
    });
    const core = buildEditorialCore(input);
    expect(core.context.roundState).toEqual({
      status: 'incomplete',
      basis: 'local_round',
      total: 5,
      finished: 2,
      inProgress: 1,
      pending: 1,
      postponed: 1,
      cancelled: 0,
    });
    expect(core.context.roundLabel).toBe('Jornada 1');
    expect(core.keyEvents.map((event) => event.kind)).toContain('round_incomplete');
    expect(core.keyEvents.map((event) => event.kind)).toContain('postponed_matches');
    expect(core.bindings.get('{{f:round:pending}}')?.text).toBe('2');
    expect(core.evidence[0]?.roundId).toBe('66666666-6666-4666-8666-666666666666');
    const request = requestOf(core, input);
    expect(request.round).toMatchObject({ status: 'incomplete', pending: '{{f:round:pending}}' });
  });

  it('derives the round from the selection statuses, never from dates, and is unknown without them', () => {
    const facts = leagueFacts().match('liga-demo-1-c', {
      home: 'atletico-rio-ebano',
      away: 'penas-nandu-sur',
      status: 'scheduled',
      score: null,
      kickoff: '2020-01-01T00:00:00Z',
    });
    expect(roundStateOf(new FactIndex(facts.facts), null)).toMatchObject({
      status: 'incomplete',
      basis: 'selection',
      pending: 1,
    });
    expect(roundStateOf(new FactIndex([]), null)).toMatchObject({ status: 'unknown', basis: 'none', total: null });
  });

  it('describes matches not played yet without scores or results', () => {
    const facts = new Facts()
      .team('a', 'Equipo Alfa')
      .team('b', 'Equipo Beta')
      .match('f-1', { home: 'a', away: 'b', status: 'scheduled', score: null, kickoff: '2026-11-20T20:00:00Z' });
    const input = editorialInput(facts, { contentKind: 'upcoming' });
    const core = buildEditorialCore(input);
    const request = requestOf(core, input);
    expect(request.matches).toEqual([
      expect.objectContaining({ ref: 'm1', played: false, score: null, result: null, status: '{{f:m1:status}}' }),
    ]);
    expect(core.keyEvents.map((event) => event.kind)).toEqual(['upcoming_matches', 'round_incomplete']);
    expect(core.checks.unplayed).toBe(true);
  });

  it('offers standings placeholders only when every row is confirmed', () => {
    const facts = leagueFacts().standing('atletico-rio-ebano', 1, 3).standing('real-brisamar', 2, 0);
    const standings = { available: true, reason: null } as const;
    const core = buildEditorialCore(editorialInput(facts, { standings: standings as never }));
    expect(core.standingsAvailable).toBe(true);
    expect(core.bindings.get('{{f:row:atletico-rio-ebano:points}}')?.text).toBe('3');
    const unverified = leagueFacts().standing('atletico-rio-ebano', 1, 3, 'candidate');
    expect(buildEditorialCore(editorialInput(unverified, { standings: standings as never })).standingsAvailable).toBe(
      false,
    );
  });
});

describe('editorial checks (encargo sections 10 and 11)', () => {
  const input = editorialInput(leagueFacts());
  const core = buildEditorialCore(input);
  const request = requestOf(core, input);

  it('composes the stub answer of every deliverable without flags and with the final values', () => {
    for (const deliverable of EDITORIAL_DELIVERABLES) {
      const version = compose(core, request, deliverable);
      expect(version.flags, deliverable).toEqual([]);
    }
    const main = compose(core, request, 'facebook_instagram');
    const body = main.fields.find((field) => field.name === 'body');
    expect(body?.text).toContain('Atlético Río Ébano y Real Brisamar dejaron 2-1');
    expect(body?.words).toBeGreaterThanOrEqual(EDITORIAL_LIMITS.bodyMinWords);
    expect(body?.words).toBeLessThanOrEqual(EDITORIAL_LIMITS.bodyMaxWords);
    expect(main.fields.map((field) => field.name)).toEqual(['headline', 'body', 'question', 'hashtags']);
    expect(main.factIds.length).toBeGreaterThan(0);
    expect(main.evidenceIds.every((id) => id.startsWith('ev-'))).toBe(true);
  });

  it('flags numbers outside placeholders but not the articles a narrative needs', () => {
    const flagged = compose(core, request, 'tiktok_reels', {
      copy: '{{t:real-brisamar}} cayó 3-0 y recibió dos goles.',
    });
    expect(flagged.flags.filter((flag) => flag.code === 'UNVERIFIED_NUMBER').map((flag) => flag.excerpt)).toEqual(
      expect.arrayContaining(['dos']),
    );
    expect(flagged.flags.some((flag) => flag.code === 'UNVERIFIED_NUMBER' && flag.excerpt.includes('3'))).toBe(true);
    const articles = compose(core, request, 'tiktok_reels', {
      copy: 'Una jornada con un {{t:real-brisamar}} que se quedó en {{f:m1:score}}: uno de esos golpes que duelen.',
    });
    expect(articles.flags).toEqual([]);
  });

  it('applies the format rules: hook in capitals, question mark, hashtag count, lengths, different headlines', () => {
    const main = compose(core, request, 'facebook_instagram', {
      headline: 'Gancho en minúsculas',
      body: 'Muy corto.',
      question: 'Sin pregunta',
      hashtags: ['#ElDeporteRey', '#Futbol'],
    });
    const codes = main.flags.map((flag) => `${flag.code}:${flag.field}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        'FORMAT_RULE:headline',
        'LENGTH_OUT_OF_RANGE:body',
        'FORMAT_RULE:question',
        'FORMAT_RULE:hashtags',
      ]),
    );
    const viral = compose(core, request, 'viral_headlines', {
      headline_1: 'Igual',
      headline_2: 'igual',
      headline_3: 'Otro',
    });
    expect(viral.flags.map((flag) => flag.code)).toContain('FORMAT_RULE');
    const tiktok = compose(core, request, 'tiktok_reels', {
      copy: Array.from({ length: 80 }, () => 'palabra').join(' '),
    });
    expect(tiktok.flags.map((flag) => flag.code)).toEqual(['LENGTH_OUT_OF_RANGE']);
  });

  it('flags claims the data does not support: an unfinished round, standings, unknown references, links', () => {
    const open = editorialInput(leagueFacts(), {
      localRound: { total: 4, finished: 2, inProgress: 0, scheduled: 2, postponed: 0, cancelled: 0 },
      local: {
        competitionId: '11111111-1111-4111-8111-111111111111',
        seasonId: '55555555-5555-4555-8555-555555555555',
        roundId: '66666666-6666-4666-8666-666666666666',
        roundName: 'Jornada 1',
      },
    });
    const openCore = buildEditorialCore(open);
    const openRequest = requestOf(openCore, open);
    const claims = compose(openCore, openRequest, 'debate_question', {
      question: '¿Con la jornada terminada, quién es el líder? Míralo en www.ejemplo.com',
    });
    expect(claims.flags.map((flag) => flag.code)).toEqual(
      expect.arrayContaining(['INCOMPLETE_ROUND_CLAIM', 'STANDINGS_CLAIM_WITHOUT_DATA', 'FORBIDDEN_CONTENT']),
    );
    const unknown = composeDeliverable('debate_question', { question: '¿Y {{f:m9:score}}?' }, core, {
      eventIds: ['evt-inventado'],
      evidenceIds: ['ev-inventada'],
    });
    expect(unknown.flags.map((flag) => flag.code)).toEqual(
      expect.arrayContaining(['UNKNOWN_FACT_REFERENCE', 'UNKNOWN_EVENT_REFERENCE', 'UNKNOWN_EVIDENCE_REFERENCE']),
    );
    expect(unknown.eventIds).toEqual([]);
  });

  it('flags result words in content about matches not played yet', () => {
    const facts = new Facts()
      .team('a', 'Equipo Alfa')
      .team('b', 'Equipo Beta')
      .match('f-1', { home: 'a', away: 'b', status: 'scheduled', score: null });
    const upcoming = editorialInput(facts, { contentKind: 'upcoming' });
    const upcomingCore = buildEditorialCore(upcoming);
    const version = compose(upcomingCore, requestOf(upcomingCore, upcoming), 'tiktok_reels', {
      copy: '{{t:a}} es favorito y ganará ante {{t:b}}.',
    });
    expect(version.flags.map((flag) => flag.code)).toContain('UNPLAYED_RESULT_CLAIM');
  });

  it('turns an operator edit back into placeholders, so only confirmed values pass as numbers', () => {
    expect(retokenize('Atlético Río Ébano 2-1 Real Brisamar, sin Municipalidad.', core)).toBe(
      '{{t:atletico-rio-ebano}} {{f:m1:score}} {{t:real-brisamar}}, sin Municipalidad.',
    );
    const current = compose(core, request, 'tiktok_reels').fields;
    const confirmed = composeDeliverable(
      'tiktok_reels',
      rawOfEdit(
        'tiktok_reels',
        new Map([['copy', 'Atlético Río Ébano 2-1 Real Brisamar: golpe de autoridad.']]),
        current,
        core,
      ),
      core,
      { eventIds: [], evidenceIds: [] },
    );
    expect(confirmed.flags).toEqual([]);
    expect(confirmed.fields[0]?.text).toBe('Atlético Río Ébano 2-1 Real Brisamar: golpe de autoridad.');
    expect(confirmed.factIds.length).toBeGreaterThan(0);
    const invented = composeDeliverable(
      'tiktok_reels',
      rawOfEdit('tiktok_reels', new Map([['copy', 'Atlético Río Ébano 4-0 Real Brisamar.']]), current, core),
      core,
      { eventIds: [], evidenceIds: [] },
    );
    expect(invented.flags.map((flag) => flag.code)).toContain('UNVERIFIED_NUMBER');
  });

  it('counts words as runs holding a letter or a digit', () => {
    expect(countWords('Hola — mundo 2-1 · ¿qué?')).toBe(4);
  });
});

describe('editorial cost (PD-30)', () => {
  const billed: EditorialWriterDescription = {
    adapter: 'openai-compatible',
    kind: 'hosted_ai',
    model: 'gpt-test',
    ready: true,
    billed: true,
    pricing: {
      currency: 'USD',
      inputPerMillionTokens: 2,
      outputPerMillionTokens: 10,
      source: 'x',
      checkedOn: '2026-11-10',
    },
    limits: { maxGenerationsPerDay: 30, monthlySpendLimit: 5, maxConcurrentGenerations: 1 },
    maxOutputTokens: 4000,
    reasoningEffort: 'medium',
  };

  it('reserves an upper bound before the request and computes the reported usage after it', () => {
    // 10000 bytes at most 10000 input tokens, 4000 output tokens: (10000 × 2 + 4000 × 10) / 1e6.
    expect(estimateCost(billed, 10000)).toBe(0.06);
    expect(computedCost(billed, { inputTokens: 1200, outputTokens: 800 })).toBe(0.0104);
    expect(computedCost(billed, { inputTokens: 1200, outputTokens: null })).toBeNull();
    expect(estimateCost({ ...billed, pricing: null }, 10000)).toBeNull();
    expect(estimateCost({ ...billed, billed: false }, 10000)).toBe(0);
  });

  it('counts days and months in UTC', () => {
    const now = new Date('2026-11-10T03:30:00-06:00');
    expect(utcDayStart(now)).toBe('2026-11-10T00:00:00.000Z');
    expect(utcMonthStart(now)).toBe('2026-11-01T00:00:00.000Z');
  });
});
