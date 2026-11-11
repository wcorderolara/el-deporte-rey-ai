/**
 * Stub editorial writer (PD-ARCH-01H): the default configuration and every test. No network I/O and no AI: it builds
 * a deterministic test text from the request's placeholders only (no digits, number words, team names, persons or
 * venues), clearly marked as test text, with the structure and lengths of the real deliverables so that the whole
 * flow (generation, checks, review, edition, approval) can be exercised for free.
 *
 * Scenarios (`providers.editorial.options.scenario`): `default`; `invalid-json` (an answer that is not JSON, which
 * fails with `ai_response_invalid` like a real one); `unavailable`; `timeout`; `flagged` (an answer with an invented
 * score, which the editorial checks flag). It never claims research and never returns a URL.
 */
import type { EditorialDeliverable } from '@edr/contracts';

import { AiProviderError } from './errors.js';
import {
  type EditorialStubOptions,
  type AiEditorialWriter,
  type EditorialWriteContext,
  type EditorialWriterDescription,
  parseEditorialStubOptions,
} from './editorial-port.js';
import {
  type EditorialMatch,
  type EditorialRequest,
  type EditorialResult,
  RESPONSE_KEY,
  parseEditorialRequest,
  parseEditorialResponse,
  parseEditorialResponseText,
} from './editorial-schemas.js';

interface StubTexts {
  readonly headline: (stage: string) => string;
  readonly intro: (competition: string, stage: string) => string;
  readonly result: (match: EditorialMatch) => string;
  readonly fixture: (match: EditorialMatch) => string;
  readonly incomplete: string;
  readonly filler: string;
  readonly question: (stage: string) => string;
  readonly hashtags: readonly string[];
  readonly short: (stage: string) => string;
  readonly viral: readonly ((stage: string, competition: string) => string)[];
  readonly title: (stage: string) => string;
  readonly description: (competition: string, season: string) => string;
  readonly debate: (stage: string) => string;
}

const TEXTS: Readonly<Record<'es' | 'en', StubTexts>> = {
  es: {
    headline: (stage) => `TEXTO DE PRUEBA SIN IA: ASÍ LLEGA ${stage}`,
    intro: (competition, stage) =>
      `Texto de prueba generado sin IA con los datos confirmados de ${competition}, ${stage}.`,
    result: (match) => `${match.home} y ${match.away} dejaron ${match.score ?? ''}: ${match.result ?? ''}.`,
    fixture: (match) => `${match.home} contra ${match.away}, ${match.kickoff ?? ''}, con estado ${match.status ?? ''}.`,
    incomplete: 'La jornada todavía no ha terminado: quedan partidos por jugarse.',
    filler:
      'Este párrafo existe para revisar el flujo completo de generación, revisión, edición y aprobación del copy ' +
      'editorial de El Deporte Rey sin llamar a ningún modelo de lenguaje. El texto definitivo lo escribirá la IA ' +
      'configurada con el prompt editorial versionado, usando solo los datos deportivos confirmados de la selección ' +
      'y los acontecimientos que detecta el sistema. Aquí no hay opinión, ni tono provocador, ni investigación ' +
      'externa: solo la estructura con la longitud correcta para comprobar las reglas de formato, los hashtags y la ' +
      'pregunta que cierra el texto.',
    question: (stage) => `¿Qué partido de ${stage} te deja más dudas?`,
    hashtags: ['#ElDeporteRey', '#Futbol', '#TextoDePrueba', '#CopyEditorial', '#FutbolChapin'],
    short: (stage) =>
      `TEXTO DE PRUEBA SIN IA. ${stage} trae tela que cortar y aquí va la versión corta para TikTok y Reels. ` +
      '¿Tú qué opinas? Déjalo en comentarios.',
    viral: [
      (stage) => `Prueba sin IA: lo que nadie dice de ${stage}`,
      (_stage, competition) => `Prueba sin IA: ${competition} pide debate`,
      (stage) => `Prueba sin IA: la pregunta incómoda de ${stage}`,
    ],
    title: (stage) => `Prueba sin IA: análisis de ${stage}`,
    description: (competition, season) =>
      `Texto de prueba generado sin IA con los datos confirmados de ${competition}, ${season}. ` +
      'La descripción definitiva la escribirá la IA configurada.',
    debate: (stage) => `¿Qué acontecimiento de ${stage} merece más debate?`,
  },
  en: {
    headline: (stage) => `TEST TEXT WITHOUT AI: HERE COMES ${stage}`,
    intro: (competition, stage) => `Test text written without AI from the confirmed data of ${competition}, ${stage}.`,
    result: (match) => `${match.home} and ${match.away} left ${match.score ?? ''}: ${match.result ?? ''}.`,
    fixture: (match) => `${match.home} against ${match.away}, ${match.kickoff ?? ''}, status ${match.status ?? ''}.`,
    incomplete: 'The matchday is not over yet: there are matches still to be played.',
    filler:
      'This paragraph exists to check the whole flow of generating, reviewing, editing and approving the editorial ' +
      'copy of El Deporte Rey without calling any language model. The final text will be written by the configured ' +
      'AI with the versioned editorial prompt, using only the confirmed sports data of the selection and the events ' +
      'the system detects. There is no opinion here, no provocative tone and no external research: only a structure ' +
      'with the right length to check the format rules, the hashtags and the question that closes the text.',
    question: (stage) => `Which match of ${stage} leaves you with more doubts?`,
    hashtags: ['#ElDeporteRey', '#Futbol', '#TestText', '#EditorialCopy', '#Football'],
    short: (stage) =>
      `TEST TEXT WITHOUT AI. ${stage} gives plenty to talk about, and this is the short version for TikTok and ` +
      'Reels. What do you think? Tell us in the comments.',
    viral: [
      (stage) => `Test without AI: what nobody says about ${stage}`,
      (_stage, competition) => `Test without AI: ${competition} calls for debate`,
      (stage) => `Test without AI: the awkward question of ${stage}`,
    ],
    title: (stage) => `Test without AI: analysis of ${stage}`,
    description: (competition, season) =>
      `Test text written without AI from the confirmed data of ${competition}, ${season}. ` +
      'The final description will be written by the configured AI.',
    debate: (stage) => `Which event of ${stage} deserves more debate?`,
  },
};

function body(request: EditorialRequest, texts: StubTexts): string {
  const { competition, stage } = request.selection;
  const sentences = [texts.intro(competition, stage)];
  for (const match of request.matches.slice(0, 2)) {
    sentences.push(match.played ? texts.result(match) : texts.fixture(match));
  }
  if (request.round.status === 'incomplete') {
    sentences.push(texts.incomplete);
  }
  sentences.push(texts.filler);
  return sentences.join(' ');
}

function deliverable(request: EditorialRequest, texts: StubTexts, which: EditorialDeliverable): unknown {
  const { competition, stage, season } = request.selection;
  switch (which) {
    case 'facebook_instagram':
      return {
        headline: texts.headline(stage),
        body: body(request, texts),
        question: texts.question(stage),
        hashtags: [...texts.hashtags],
      };
    case 'tiktok_reels':
      return { copy: texts.short(stage) };
    case 'viral_headlines':
      return {
        headline_1: texts.viral[0]?.(stage, competition) ?? '',
        headline_2: texts.viral[1]?.(stage, competition) ?? '',
        headline_3: texts.viral[2]?.(stage, competition) ?? '',
      };
    case 'youtube':
      return { title: texts.title(stage), description: texts.description(competition, season) };
    case 'debate_question':
      return { question: texts.debate(stage) };
  }
}

/** The stub's answer to a validated request. */
export function stubEditorialAnswer(request: EditorialRequest, flagged = false): Record<string, unknown> {
  const texts = TEXTS[request.language];
  const answer: Record<string, unknown> = {};
  for (const which of request.deliverables) {
    answer[RESPONSE_KEY[which]] = deliverable(request, texts, which);
  }
  if (flagged && request.deliverables.includes('tiktok_reels')) {
    // An invented score: the editorial checks flag it as UNVERIFIED_NUMBER.
    answer[RESPONSE_KEY.tiktok_reels] = { copy: `${texts.short(request.selection.stage)} 3-0.` };
  }
  const events = request.keyEvents.slice(0, 3);
  const matches = new Set(events.map((event) => event.matchRef).filter((ref) => ref !== null));
  answer['keyEventIds'] = events.map((event) => event.id);
  answer['evidenceIds'] = request.evidence
    .filter((item) => item.matchRef !== null && matches.has(item.matchRef))
    .map((item) => item.id);
  return answer;
}

class StubEditorialWriterImpl implements AiEditorialWriter {
  readonly id = 'stub' as const;
  readonly #options: EditorialStubOptions;
  /** The last validated request (test assertions). */
  lastRequest: EditorialRequest | null = null;

  constructor(options: EditorialStubOptions) {
    this.#options = options;
  }

  describe(): EditorialWriterDescription {
    return {
      adapter: 'stub',
      kind: 'test',
      model: null,
      ready: true,
      billed: false,
      pricing: null,
      limits: this.#options.limits,
      maxOutputTokens: null,
      reasoningEffort: null,
    };
  }

  async write(req: EditorialRequest, ctx: EditorialWriteContext): Promise<EditorialResult> {
    const request = parseEditorialRequest(req);
    this.lastRequest = request;
    if (ctx.signal.aborted) {
      throw new AiProviderError('timeout');
    }
    switch (this.#options.scenario) {
      case 'unavailable':
        throw new AiProviderError('unavailable');
      case 'timeout':
        throw new AiProviderError('timeout');
      case 'invalid-json':
        return { response: parseEditorialResponseText('{"facebookInstagram": {', request), usage: null };
      default: {
        const answer = stubEditorialAnswer(request, this.#options.scenario === 'flagged');
        return { response: parseEditorialResponse(answer, request), usage: null };
      }
    }
  }
}

export type StubEditorialWriter = AiEditorialWriter & { lastRequest: EditorialRequest | null };

/** Creates the stub writer; invalid options stop startup with a `ConfigError`. */
export function createStubEditorialWriter(options: unknown): StubEditorialWriter {
  return new StubEditorialWriterImpl(parseEditorialStubOptions(options));
}
