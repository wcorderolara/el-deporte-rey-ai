/**
 * UI-06.3 regression of the approved editorial copy in the export (PD-ARCH-01H editorial writer; REVIEW-APPROVAL-01;
 * PD-33 Option A, independent approvals; PD-34) with extreme texts, through the real server, workflow, review,
 * editorial routes, export and ZIP download of a temporary app. Synthetic DEMO_DATA only; the writer is the free stub
 * or a scripted local writer behind a fake egress client (the seam of `editorial.int.test.ts`): no provider, no cost,
 * no network.
 *
 * Covered here (the base flow, the edited and withdrawn copy with the stub texts and the "approved but not exportable"
 * package are in `export-editorial-copy.test.ts`; successive exports and history in `editorial-copy-exports.test.ts`):
 * - Spanish project, texts at every editorial limit (encargo section 8, counted in code points and words as the
 *   module counts them) and at the contract's field limit (`MAX_EDITORIAL_FIELD_TEXT`, code points): accepted,
 *   approved and exported byte for byte, with emojis (BMP and non-BMP, skin tones, flags, variation selectors),
 *   combining accents, mathematical letters and line breaks; one more character or word is flagged and cannot be
 *   approved; over the contract limit, and any control or format character (bidi marks, zero-width characters, BOM,
 *   soft hyphen, tag characters, CR, tab), the edit is refused before anything is stored; right-to-left scripts are
 *   flagged (the content languages are Latin-script).
 * - English project: the English texts go into the file unchanged; the file's heading, section titles and the
 *   YouTube labels are the fixed ones of the accepted format; only the approved deliverables are written.
 * - Writer output: zero-width-joiner emoji sequences the checks allow reach the file intact; a writer text with a
 *   bidi mark or another script is flagged, cannot be approved and never reaches the file.
 */
import { MAX_EDITORIAL_FIELD_TEXT, type EditorialDeliverable, type EditorialVersion } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import type { EgressClient } from '../../../src/platform/net/index.js';
import { EDITORIAL_DATA_HEADER, parseEditorialRequest, stubEditorialAnswer } from '../../../src/providers/ai/index.js';
import { cleanups, start } from '../ingestion/support.js';

import {
  type ExpectedSection,
  type FieldTexts,
  approveCopy,
  approveCopyResponse,
  codePoints,
  currentCopies,
  currentCopy,
  deliverableOf,
  deliverableText,
  downloadZip,
  editCopy,
  editedCopy,
  editorialPackage,
  expectExportedCopy,
  fieldTexts,
  generateCopy,
  sectionOf,
  toCodePoints,
  toWords,
  wordCount,
} from './editorial-copy-support.js';
import {
  WORKFLOW_TEST_TIMEOUT,
  approveDraft,
  expectProblem,
  exportDetail,
  exportFile,
  exported,
  ligaDemo,
  projectWithDraft,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

/** The limits of the deliverables (encargo section 8), as the editorial checks apply them. */
const LIMITS = {
  headline: 90,
  bodyMinWords: 100,
  bodyMaxWords: 160,
  question: 200,
  maxHashtags: 8,
  shortCopyWords: 70,
  viralHeadline: 100,
  youtubeTitle: 100,
  youtubeDescription: 1500,
} as const;

// Unicode written as escapes, so the intent of every code point is explicit.
const BALL = '\u26BD'; // BMP pictograph, one UTF-16 unit
const FIRE = '\u{1F525}'; // non-BMP pictograph, two UTF-16 units
const TROPHY = '\u{1F3C6}';
const NOTES = '\u{1F3B6}';
const SCREAM = '\u{1F631}';
const CAMERA = '\u{1F3A5}';
const BELL = '\u{1F514}';
const TRUMPET = '\u{1F3BA}';
const SWEAT = '\u{1F605}';
const MEGAPHONE = '\u{1F4E3}';
const CLAP = '\u{1F44F}\u{1F3FD}'; // with a skin-tone modifier
const PRAY = '\u{1F64F}\u{1F3FD}';
const POINT_DOWN = '\u{1F447}\u{1F3FC}';
const FLAG_GT = '\u{1F1EC}\u{1F1F9}'; // regional indicators
const FLAG_GB = '\u{1F1EC}\u{1F1E7}';
const HEART = '\u2764\uFE0F'; // with a variation selector
const COUCH = '\u{1F6CB}\uFE0F';
const STADIUM = '\u{1F3DF}\uFE0F';
const CLEF = '\u{1D11E}'; // non-BMP symbol
/** Mathematical bold letters (non-BMP; NFKC folds them to Latin letters). */
const BOLD_GOLES = '\u{1D406}\u{1D40E}\u{1D40B}\u{1D404}\u{1D412}';
const BOLD_GOLAZO = '\u{1D420}\u{1D428}\u{1D425}\u{1D41A}\u{1D433}\u{1D428}';
const BOLD_EPICA = '\u{1D41E}\u0301\u{1D429}\u{1D422}\u{1D41C}\u{1D41A}'; // with a combining acute accent
const BOLD_EPIC = '\u{1D41E}\u{1D429}\u{1D422}\u{1D41C}';
/** Zero-width-joiner emoji sequences (allowed by the content checks inside an emoji sequence, T10-A1-05). */
const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
const HEART_ON_FIRE = '\u2764\uFE0F\u200D\u{1F525}';
const RAINBOW_FLAG = '\u{1F3F3}\uFE0F\u200D\u{1F308}';

const FILLER_ES = ['fútbol', 'pasión', 'afición', 'estadio', 'grada', 'bufanda', 'cántico', 'emoción', 'garra'];

// ---------------------------------------------------------------------------------------------------------------
// Spanish texts at the limits
// ---------------------------------------------------------------------------------------------------------------

const HEADLINE_BASE =
  `${BALL}${FIRE} ¡QUÉ JORNADA! ${BOLD_GOLES}, NERVIOS Y E\u0301PICA ${FLAG_GT}${CLAP}${HEART} «PURA PASIÓN» — ` +
  '¿QUIÉN LO PARA?';

const BODY_PARAGRAPHS = [
  `Qué jornada tan intensa en Liga Demo ${FIRE} La afición vivió cada minuto con el corazón en la mano ${HEART} y ` +
    'la garganta encendida.',
  `Hubo pasio\u0301n, nervios y e\u0301pica ${FLAG_GT} en cada rincón del estadio; los cánticos de la hinchada ` +
    `${TRUMPET} sonaron sin pausa y el ${BOLD_GOLAZO} de la tarde quedó grabado en la memoria ${CLEF}.`,
  `«Así se vive el fútbol», decía una aficionada —con la bufanda al cuello— mientras la grada coreaba sin descanso ${CLAP}${CLAP}.`,
  `¿Hubo justicia en el marcador? ¡Que lo decida la afición! ${SWEAT} Comenta, comparte y dinos qué te pareció la tarde.`,
  `Lo mejor:\n– la entrega de la grada ${BALL}\n– el ambiente de la tarde ${FIRE}\n– la emoción hasta el silbatazo ${TROPHY}`,
];

/** Exactly `words` words, then a space and a run of balls (not words) up to exactly `points` code points. */
function bodyText(words: number, points: number): string {
  return toCodePoints(`${toWords(BODY_PARAGRAPHS.join('\n\n'), words, FILLER_ES)} `, points);
}

const QUESTION_BASE =
  `¿Qué momento de la jornada te hizo saltar del sofá ${COUCH}${BALL} y cuál te dejó sin palabras ${SCREAM}? ` +
  'Cuéntanos con emojis, con acentos como e\u0301 y n\u0303 o como quieras: ¡aquí cabe todo!';

const HASHTAGS = [
  '#ElDeporteRey',
  '#Fútbol',
  '#Pasión',
  '#Afición',
  '#Golazo',
  '#Hinchada',
  '#Jornadón',
  `#${'Fútbol'.repeat(10)}`, // the longest hashtag: sixty letters
];

const SHORT_COPY_BASE =
  `¡VAYA JORNADA! ${FIRE}${BALL}\nLa afición no paró de cantar ${NOTES} y la grada tembló de emoción.\n\n` +
  `¿Te lo perdiste? Aquí va lo mejor ${POINT_DOWN}\nSigue`;

const VIRAL_BASES = [
  `${FIRE} Lo que nadie vio venir: la tarde en que la grada cantó más fuerte que nunca ${NOTES}`,
  `¿Fue justo? La pregunta que divide a la afición tras una jornada de infarto ${SCREAM}`,
  `Pasio\u0301n, nervios y ${BOLD_EPICA}: así se vivió la jornada en las gradas ${FLAG_GT}`,
];

const TITLE_BASE = `Análisis ${CAMERA}: pasión, nervios y épica en una jornada para el recuerdo — ¿quién brilló más? ${BALL}`;

const DESCRIPTION_BASE = [
  `Resumen de la jornada ${CAMERA}${FIRE}`,
  '',
  `Pasio\u0301n, nervios y e\u0301pica ${FLAG_GT}: la grada vivió una tarde inolvidable y el ${BOLD_GOLAZO} quedó en la ` +
    `memoria ${CLEF}.`,
  '',
  `Suscríbete, comenta y comparte ${BELL}${CLAP}`,
  '',
  TROPHY.repeat(300),
].join('\n');

const DEBATE_BASE =
  `¿Qué fue lo más emocionante de la jornada: la entrega de la afición ${MEGAPHONE}, el ambiente en la grada ` +
  `${STADIUM} o la e\u0301pica del desenlace? Opina con respeto ${PRAY}`;

/** The accepted texts: every field at its limit. */
const AT_LIMIT: Readonly<Record<EditorialDeliverable, FieldTexts>> = {
  facebook_instagram: {
    headline: toCodePoints(HEADLINE_BASE, LIMITS.headline),
    body: bodyText(LIMITS.bodyMaxWords, MAX_EDITORIAL_FIELD_TEXT),
    question: toCodePoints(QUESTION_BASE, LIMITS.question),
    hashtags: HASHTAGS.join(' '),
  },
  tiktok_reels: { copy: toWords(SHORT_COPY_BASE, LIMITS.shortCopyWords, FILLER_ES) },
  viral_headlines: {
    headline_1: toCodePoints(VIRAL_BASES[0] ?? '', LIMITS.viralHeadline),
    headline_2: toCodePoints(VIRAL_BASES[1] ?? '', LIMITS.viralHeadline),
    headline_3: toCodePoints(VIRAL_BASES[2] ?? '', LIMITS.viralHeadline),
  },
  youtube: {
    title: toCodePoints(TITLE_BASE, LIMITS.youtubeTitle),
    description: toCodePoints(DESCRIPTION_BASE, LIMITS.youtubeDescription),
  },
  debate_question: { question: toCodePoints(DEBATE_BASE, LIMITS.question) },
};

interface FlaggedCase {
  readonly name: string;
  readonly deliverable: EditorialDeliverable;
  readonly fields: FieldTexts;
  readonly flag: { readonly code: string; readonly field: string };
}

/** One character, word, hashtag or line break more than allowed: stored as a flagged version, never approvable. */
const FLAGGED: readonly FlaggedCase[] = [
  {
    name: 'a headline of 91 code points',
    deliverable: 'facebook_instagram',
    fields: { headline: toCodePoints(HEADLINE_BASE, LIMITS.headline + 1) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'headline' },
  },
  {
    name: 'a body of 161 words',
    deliverable: 'facebook_instagram',
    fields: { body: bodyText(LIMITS.bodyMaxWords + 1, MAX_EDITORIAL_FIELD_TEXT) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'body' },
  },
  {
    name: 'a body of 99 words',
    deliverable: 'facebook_instagram',
    fields: { body: toWords(BODY_PARAGRAPHS[0] ?? '', LIMITS.bodyMinWords - 1, FILLER_ES) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'body' },
  },
  {
    name: 'a body with 21 line breaks',
    deliverable: 'facebook_instagram',
    fields: {
      body: Array.from(
        { length: 22 },
        (_unused, line) => `Línea ${FILLER_ES[line % FILLER_ES.length] ?? ''} de la grada ${FIRE}`,
      )
        .map((line) => `${line} y más`)
        .join('\n'),
    },
    flag: { code: 'FORBIDDEN_CONTENT', field: 'body' },
  },
  {
    name: 'a headline with a line break',
    deliverable: 'facebook_instagram',
    fields: { headline: `¡QUÉ JORNADA!\nPURA PASIÓN ${FIRE}` },
    flag: { code: 'FORBIDDEN_CONTENT', field: 'headline' },
  },
  {
    name: 'a question of 201 code points',
    deliverable: 'facebook_instagram',
    fields: { question: toCodePoints(QUESTION_BASE, LIMITS.question + 1) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'question' },
  },
  {
    name: 'nine hashtags',
    deliverable: 'facebook_instagram',
    fields: { hashtags: [...HASHTAGS, '#Garra'].join(' ') },
    flag: { code: 'FORMAT_RULE', field: 'hashtags' },
  },
  {
    name: 'a short copy of 71 words',
    deliverable: 'tiktok_reels',
    fields: { copy: toWords(SHORT_COPY_BASE, LIMITS.shortCopyWords + 1, FILLER_ES) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'copy' },
  },
  {
    name: 'a viral headline of 101 code points',
    deliverable: 'viral_headlines',
    fields: { headline_2: toCodePoints(VIRAL_BASES[1] ?? '', LIMITS.viralHeadline + 1) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'headline_2' },
  },
  {
    name: 'a YouTube title of 101 code points',
    deliverable: 'youtube',
    fields: { title: toCodePoints(TITLE_BASE, LIMITS.youtubeTitle + 1) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'title' },
  },
  {
    name: 'a YouTube description of 1501 code points',
    deliverable: 'youtube',
    fields: { description: toCodePoints(DESCRIPTION_BASE, LIMITS.youtubeDescription + 1) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'description' },
  },
  {
    name: 'a debate question of 201 code points',
    deliverable: 'debate_question',
    fields: { question: toCodePoints(DEBATE_BASE, LIMITS.question + 1) },
    flag: { code: 'LENGTH_OUT_OF_RANGE', field: 'question' },
  },
  {
    // UI-06.3: the contract accepts the joiner; the content checks flag it outside an emoji sequence (T10-A1-05).
    name: 'a zero-width joiner outside an emoji sequence',
    deliverable: 'debate_question',
    fields: { question: '¿Qué opinas de la jor\u200Dnada?' },
    flag: { code: 'FORBIDDEN_CONTENT', field: 'question' },
  },
  {
    name: 'a question in right-to-left scripts (Hebrew and Arabic letters)',
    deliverable: 'debate_question',
    fields: { question: '¿Qué opinas de la jornada? \u05E9\u05DC\u05D5\u05DD \u0645\u0631\u062D\u0628\u0627' },
    flag: { code: 'NON_OFFICIAL_TEAM_NAME', field: 'question' },
  },
];

/**
 * Texts the contract refuses (`EditorialEditField.text`: 1 to 5000 code points, no control or format character other
 * than a line feed and, since UI-06.3, U+200D ZERO WIDTH JOINER).
 */
const REFUSED: readonly { readonly name: string; readonly text: string }[] = [
  { name: 'an empty text', text: '' },
  { name: 'a right-to-left mark (U+200F)', text: '¿Qué opinas\u200F de la jornada?' },
  { name: 'a left-to-right mark (U+200E)', text: '¿Qué opinas\u200E de la jornada?' },
  { name: 'a right-to-left override (U+202E)', text: '\u202E¿Qué opinas de la jornada?' },
  { name: 'a right-to-left isolate (U+2067)', text: '\u2067¿Qué opinas de la jornada?\u2069' },
  { name: 'a zero-width space (U+200B)', text: '¿Qué opinas de la\u200B jornada?' },
  { name: 'a byte order mark (U+FEFF)', text: '\uFEFF¿Qué opinas de la jornada?' },
  { name: 'a soft hyphen (U+00AD)', text: '¿Qué opinas de la jor\u00ADnada?' },
  {
    name: 'tag characters (a subdivision flag)',
    text: '¿Qué opinas? \u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  },
  { name: 'a carriage return', text: '¿Qué opinas\r\nde la jornada?' },
  { name: 'a tab', text: '¿Qué opinas\tde la jornada?' },
];

// ---------------------------------------------------------------------------------------------------------------
// Scripted local writer (fake egress client; no socket, no provider)
// ---------------------------------------------------------------------------------------------------------------

const LOCAL_WRITER_URL = 'http://127.0.0.1:9/v1';

/** A local OpenAI-compatible editorial writer answering with the stub's text, changed by `change`. */
function scriptedWriter(change: (answer: Record<string, Record<string, unknown>>) => void): EgressClient {
  return {
    request(_url, init) {
      const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
      const user = body.messages[1]?.content ?? '';
      const request = parseEditorialRequest(JSON.parse(user.slice(EDITORIAL_DATA_HEADER.length + 1)));
      const answer = stubEditorialAnswer(request) as Record<string, Record<string, unknown>>;
      change(answer);
      const text = JSON.stringify({
        choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }],
      });
      return Promise.resolve({ status: 200, text, headers: new Headers() });
    },
  };
}

/** The distinct (code, field) pairs of a version's flags (one flag per offending excerpt is stored). */
function flagsOf(version: EditorialVersion): { code: string; field: string }[] {
  const pairs = new Set(version.flags.map((flag) => `${flag.code} ${flag.field}`));
  return [...pairs].map((pair) => {
    const [code = '', field = ''] = pair.split(' ');
    return { code, field };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------------------------

describe(
  'extreme editorial copy in the export (UI-06.3; REVIEW-APPROVAL-01, PD-33, PD-34)',
  { timeout: WORKFLOW_TEST_TIMEOUT },
  () => {
    it('Spanish texts at every limit are approved and exported byte for byte; one more is flagged; the contract refuses control and format characters', async () => {
      const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
      const { project } = await projectWithDraft(t, ligaDemo(2));
      expect(project.language).toBe('es');
      const carousel = (await approveDraft(t, project.id)).carousels[0];
      if (carousel === undefined) {
        throw new Error('the draft has no carousel');
      }
      const current = currentCopies(await generateCopy(t, project.id, 'cccccccc-cccc-4ccc-8ccc-000000000001'));

      // Sanity of the synthetic texts: the counts the limits are about, independently of the server.
      const fb = AT_LIMIT.facebook_instagram;
      expect(codePoints(fb.headline ?? '')).toBe(LIMITS.headline);
      expect(wordCount(fb.body ?? '')).toBe(LIMITS.bodyMaxWords);
      // The contract's field limit counts code points (JSON Schema `maxLength`; Zod 4 `max`), not UTF-16 units.
      expect(codePoints(fb.body ?? '')).toBe(MAX_EDITORIAL_FIELD_TEXT);
      expect(fb.body?.length).toBeGreaterThan(MAX_EDITORIAL_FIELD_TEXT);
      expect(codePoints(AT_LIMIT.youtube.description ?? '')).toBe(LIMITS.youtubeDescription);
      // Three hundred non-BMP trophies: more UTF-16 units than code points.
      expect(AT_LIMIT.youtube.description?.length).toBeGreaterThan(LIMITS.youtubeDescription + 300);
      expect(wordCount(AT_LIMIT.tiktok_reels.copy ?? '')).toBe(LIMITS.shortCopyWords);

      // Above a limit (every other field of the deliverable at its own limit): a new version is stored, flagged with
      // that limit only, and it cannot be approved.
      for (const flagged of FLAGGED) {
        const version = await editedCopy(t, project.id, flagged.deliverable, current[flagged.deliverable].id, {
          ...AT_LIMIT[flagged.deliverable],
          ...flagged.fields,
        });
        expect(version.state, flagged.name).toBe('flagged');
        expect(flagsOf(version), flagged.name).toEqual([flagged.flag]);
        const refused = await approveCopyResponse(t, project.id, flagged.deliverable, version.id);
        expectProblem(refused, 409, 'CONTENT_FLAGGED');
        current[flagged.deliverable] = version;
      }

      // Refused by the contract before anything is stored: over 5000 code points, control and format characters.
      const before = await editorialPackage(t, project.id);
      const tooLong = await editCopy(t, project.id, 'facebook_instagram', current.facebook_instagram.id, {
        body: `${fb.body ?? ''}${BALL}`,
      });
      expectProblem(tooLong, 400, 'VALIDATION_FAILED');
      for (const refused of REFUSED) {
        const response = await editCopy(t, project.id, 'debate_question', current.debate_question.id, {
          question: refused.text,
        });
        expect(response.statusCode, refused.name).toBe(400);
        expectProblem(response, 400, 'VALIDATION_FAILED');
      }
      const after = await editorialPackage(t, project.id);
      expect(after.deliverables.map((entry) => [entry.deliverable, entry.versionCount, entry.current?.id])).toEqual(
        before.deliverables.map((entry) => [entry.deliverable, entry.versionCount, entry.current?.id]),
      );

      // At every limit: accepted without any flag, stored exactly as sent, counted in code points and words.
      const approved: Partial<Record<EditorialDeliverable, EditorialVersion>> = {};
      for (const deliverable of Object.keys(AT_LIMIT) as EditorialDeliverable[]) {
        const fields = AT_LIMIT[deliverable];
        const version = await editedCopy(t, project.id, deliverable, current[deliverable].id, fields);
        expect(flagsOf(version), deliverable).toEqual([]);
        expect(version.state).toBe('ready');
        expect(fieldTexts(version)).toEqual(fields);
        for (const field of version.fields) {
          const text = fields[field.name] ?? '';
          expect(field.characters, `${deliverable}.${field.name}`).toBe(codePoints(text));
          if (field.name !== 'hashtags') {
            expect(field.words, `${deliverable}.${field.name}`).toBe(wordCount(text));
          }
        }
        approved[deliverable] = await approveCopy(t, project.id, version);
      }
      const pkg = await editorialPackage(t, project.id);
      expect(pkg.deliverables.map((entry) => entry.exportable)).toEqual([true, true, true, true, true]);

      // The export writes the five texts, in the contract's order, exactly as the operator wrote them.
      const written = await exported(t, carousel.id);
      const zip = await downloadZip(t, written.id);
      const sections: ExpectedSection[] = (Object.keys(AT_LIMIT) as EditorialDeliverable[]).map((deliverable) => {
        const version = approved[deliverable];
        if (version === undefined) {
          throw new Error(`${deliverable} was not approved`);
        }
        return { deliverable, version, text: deliverableText(deliverable, AT_LIMIT[deliverable]) };
      });
      const text = expectExportedCopy(t, written, zip, project, sections);
      // The paste-ready layout of the accepted format, written out once by hand for the longest deliverables.
      expect(text).toContain(
        `${fb.headline ?? ''}\n\n${fb.body ?? ''}\n\n${fb.question ?? ''}\n\n${HASHTAGS.join(' ')}\n\n${'='.repeat(40)}\n`,
      );
      expect(text).toContain(
        `Título:\n${AT_LIMIT.youtube.title ?? ''}\n\nDescripción:\n${AT_LIMIT.youtube.description ?? ''}\n\n`,
      );
      expect(text).toContain(
        `1. ${AT_LIMIT.viral_headlines.headline_1 ?? ''}\n2. ${AT_LIMIT.viral_headlines.headline_2 ?? ''}\n3. ` +
          `${AT_LIMIT.viral_headlines.headline_3 ?? ''}\n`,
      );
      expect(text.endsWith(`${AT_LIMIT.debate_question.question ?? ''}\n`)).toBe(true);
      // Nothing of the flagged or refused versions, and no stub text, is in the file.
      for (const flagged of FLAGGED) {
        for (const value of Object.values(flagged.fields)) {
          expect(text.includes(value), flagged.name).toBe(false);
        }
      }
      expect(text).not.toContain('TEXTO DE PRUEBA');
      expect(text).not.toMatch(/[\u0590-\u06FF\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD\r\t]/u);
      // The history lists the file.
      expect((await exportDetail(t, written.id)).files).toEqual(written.files);
      expect(t.egress.requests).toHaveLength(0);
    });

    it('an English project exports its English texts unchanged, only for the approved deliverables', async () => {
      const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
      const { project } = await projectWithDraft(t, { ...ligaDemo(2), language: 'en' });
      expect(project.language).toBe('en');
      const carousel = (await approveDraft(t, project.id)).carousels[0];
      if (carousel === undefined) {
        throw new Error('the draft has no carousel');
      }
      const generated = await generateCopy(t, project.id, 'cccccccc-cccc-4ccc-8ccc-000000000002');
      expect(generated.context?.language).toBe('en');
      const stub = currentCopies(generated);

      // TikTok / Reels as the stub wrote it; YouTube and the headlines edited with Unicode; the post and the debate
      // question are left unapproved.
      const tiktok = await approveCopy(t, project.id, stub.tiktok_reels);
      const youtubeFields: FieldTexts = {
        title: `Matchday recap ${CAMERA}: passion, nerves and drama in the stands — who shone brightest? ${BALL}`,
        description:
          `What a day in the stands ${FIRE}${CLAP}\n\nCafe\u0301 talk, naïve hopes and a re\u0301sume\u0301 of emotions ` +
          `${HEART} — the crowd never stopped singing ${NOTES}.\n\nSubscribe, comment and share ${BELL} ${FLAG_GB}`,
      };
      const headlineFields: FieldTexts = {
        headline_1: `${FIRE} Nobody saw this coming: the afternoon the stands sang louder than ever ${NOTES}`,
        headline_2: `Was it fair? The question splitting the fans after a nail-biting matchday ${SCREAM}`,
        headline_3: `Passion, nerves and ${BOLD_EPIC}: how the matchday felt from the stands ${FLAG_GB}`,
      };
      const youtube = await editedCopy(t, project.id, 'youtube', stub.youtube.id, youtubeFields);
      const headlines = await editedCopy(t, project.id, 'viral_headlines', stub.viral_headlines.id, headlineFields);
      for (const version of [youtube, headlines]) {
        expect(flagsOf(version), version.deliverable).toEqual([]);
      }
      const approvedYoutube = await approveCopy(t, project.id, youtube);
      const approvedHeadlines = await approveCopy(t, project.id, headlines);
      const pkg = await editorialPackage(t, project.id);
      expect(pkg.deliverables.map((entry) => [entry.deliverable, entry.exportable])).toEqual([
        ['facebook_instagram', false],
        ['tiktok_reels', true],
        ['viral_headlines', true],
        ['youtube', true],
        ['debate_question', false],
      ]);

      const written = await exported(t, carousel.id);
      const zip = await downloadZip(t, written.id);
      const text = expectExportedCopy(t, written, zip, project, [
        sectionOf(tiktok),
        {
          deliverable: 'viral_headlines',
          version: approvedHeadlines,
          text: deliverableText('viral_headlines', headlineFields),
        },
        { deliverable: 'youtube', version: approvedYoutube, text: deliverableText('youtube', youtubeFields) },
      ]);
      // The English stub text of TikTok / Reels is written as approved; nothing of the unapproved post or question.
      expect(text).toContain(fieldTexts(stub.tiktok_reels).copy ?? '');
      expect(text).toMatch(/^TEST TEXT WITHOUT AI\. /mu);
      for (const value of [
        ...Object.values(fieldTexts(stub.facebook_instagram)),
        ...Object.values(fieldTexts(stub.debate_question)),
      ]) {
        expect(text).not.toContain(value);
      }
      expect(text).not.toContain('TEXTO DE PRUEBA');
      // The heading, section titles and YouTube labels are the fixed ones of the accepted format, also in English.
      expect(text.split('\n').slice(0, 2)).toEqual([
        'COPY EDITORIAL APROBADO',
        'Liga Demo · Temporada Regular · Jornada 2 · 2026/27',
      ]);
      expect(exportFile(t, written, 'manifest.json').toString('utf8')).toContain('"language": "en"');
      expect(t.egress.requests).toHaveLength(0);
    });

    it('writer emoji sequences reach the file intact; a writer text with a bidi mark or another script never does', async () => {
      const t = await start(cleanup, {
        base: 'demo-only',
        scenario: 'default',
        egress: scriptedWriter((answer) => {
          const post = answer['facebookInstagram'] ?? {};
          post['headline'] = `${String(post['headline'])} ${FAMILY}`;
          post['body'] = `${String(post['body'])} ${FAMILY} ${HEART_ON_FIRE} ${RAINBOW_FLAG}`;
          const short = answer['tiktokReels'] ?? {};
          short['copy'] = String(short['copy']).replace('TEXTO DE PRUEBA', 'TEXTO\u200F DE PRUEBA');
          const viral = answer['viralHeadlines'] ?? {};
          viral['headline_1'] = `\u202E${String(viral['headline_1'])}`;
          const youtube = answer['youtube'] ?? {};
          youtube['description'] =
            `${String(youtube['description'])} \u05E9\u05DC\u05D5\u05DD \u0645\u0631\u062D\u0628\u0627`;
          const debate = answer['debateQuestion'] ?? {};
          debate['question'] = `${String(debate['question'])} \u{1F914}${FIRE}`;
        }),
        mutate: (document) => {
          (document['providers'] as Record<string, unknown>)['editorial'] = {
            adapter: 'openai-compatible',
            options: { baseUrl: LOCAL_WRITER_URL, model: 'edr-local-test', timeoutMs: 60000, maxOutputTokens: 4000 },
          };
        },
      });
      const { project } = await projectWithDraft(t, ligaDemo(2));
      const carousel = (await approveDraft(t, project.id)).carousels[0];
      if (carousel === undefined) {
        throw new Error('the draft has no carousel');
      }
      const pkg = await generateCopy(t, project.id, 'cccccccc-cccc-4ccc-8ccc-000000000003');
      // A local model server: not billed, no cost confirmation.
      expect(pkg.writer).toMatchObject({ kind: 'local_ai', requiresCostConfirmation: false });
      const versions = currentCopies(pkg);

      // The checks allow a zero-width joiner only inside an emoji sequence; bidi controls and other scripts are flagged.
      expect(flagsOf(versions.facebook_instagram)).toEqual([]);
      expect(fieldTexts(versions.facebook_instagram).headline?.endsWith(` ${FAMILY}`)).toBe(true);
      expect(fieldTexts(versions.facebook_instagram).body).toContain(`${FAMILY} ${HEART_ON_FIRE} ${RAINBOW_FLAG}`);
      expect(flagsOf(versions.debate_question)).toEqual([]);
      expect(flagsOf(versions.tiktok_reels).map((flag) => flag.code)).toContain('FORBIDDEN_CONTENT');
      expect(flagsOf(versions.viral_headlines).map((flag) => flag.code)).toContain('FORBIDDEN_CONTENT');
      expect(flagsOf(versions.youtube).map((flag) => flag.code)).toContain('NON_OFFICIAL_TEAM_NAME');
      for (const deliverable of ['tiktok_reels', 'viral_headlines', 'youtube'] as const) {
        expectProblem(
          await approveCopyResponse(t, project.id, deliverable, versions[deliverable].id),
          409,
          'CONTENT_FLAGGED',
        );
      }
      const post = await approveCopy(t, project.id, versions.facebook_instagram);
      const debate = await approveCopy(t, project.id, versions.debate_question);
      const after = await editorialPackage(t, project.id);
      expect(after.deliverables.map((entry) => entry.exportable)).toEqual([true, false, false, false, true]);
      expect(deliverableOf(after, 'tiktok_reels').current?.state).toBe('flagged');

      const written = await exported(t, carousel.id);
      const zip = await downloadZip(t, written.id);
      const text = expectExportedCopy(t, written, zip, project, [sectionOf(post), sectionOf(debate)]);
      const bytes = exportFile(t, written, 'copy-editorial.txt');
      expect(text).toContain(FAMILY);
      expect(text).toContain(HEART_ON_FIRE);
      expect(text).toContain(RAINBOW_FLAG);
      expect(bytes.includes(Buffer.from(FAMILY, 'utf8'))).toBe(true);
      for (const mark of ['\u200F', '\u202E']) {
        expect(bytes.includes(Buffer.from(mark, 'utf8'))).toBe(false);
      }
      expect(text).not.toMatch(/[\u0590-\u06FF]/u);
      expect(currentCopy(after, 'tiktok_reels').fields[0]?.text).toContain('\u200F');

      // UI-06.3: a valid text the writer produced can be opened, saved again unchanged and with changes, approved and
      // exported, its emoji sequences kept code point for code point.
      const generated = fieldTexts(post);
      expect(generated.body).toContain(FAMILY);
      const resaved = await editedCopy(t, project.id, 'facebook_instagram', post.id, {
        headline: generated.headline ?? '',
        body: generated.body ?? '',
      });
      expect(resaved.origin).toBe('edited');
      expect(resaved.state).toBe('ready');
      expect(flagsOf(resaved)).toEqual([]);
      expect(fieldTexts(resaved)).toEqual(generated);
      const changedBody = `${generated.body ?? ''} ¡Vamos! ${HEART_ON_FIRE}`;
      const changed = await editedCopy(t, project.id, 'facebook_instagram', resaved.id, { body: changedBody });
      expect(changed.state).toBe('ready');
      expect(flagsOf(changed)).toEqual([]);
      expect(fieldTexts(changed).body).toBe(changedBody);
      expect(fieldTexts(changed).headline).toBe(generated.headline);
      const reapproved = await approveCopy(t, project.id, changed);
      const again = await exported(t, carousel.id);
      expect(again.id).not.toBe(written.id);
      const againText = expectExportedCopy(t, again, await downloadZip(t, again.id), project, [
        sectionOf(reapproved),
        sectionOf(debate),
      ]);
      expect(againText).toContain(`${FAMILY} ${HEART_ON_FIRE} ${RAINBOW_FLAG} ¡Vamos! ${HEART_ON_FIRE}`);
      expect(exportFile(t, again, 'copy-editorial.txt').includes(Buffer.from(FAMILY, 'utf8'))).toBe(true);
      // The earlier export keeps the copy approved when it was written.
      expect(exportFile(t, written, 'copy-editorial.txt').toString('utf8')).toBe(text);

      // The only request went to the scripted local writer, without a credential.
      expect(t.egress.requests).toEqual([
        expect.objectContaining({
          method: 'POST',
          url: `${LOCAL_WRITER_URL}/chat/completions`,
          credentialHeader: false,
        }),
      ]);
    });
  },
);
