/**
 * Visual QA core in isolation with synthetic inputs (architecture.md section 10; AD-12; OD-09, OD-26, OD-38, OD-49;
 * R-214, R-225, R-237, R-238, R-285). Render models are built by the real templates from stored texts shaped as the
 * content stage stores them; facts are in the content module's facts view.
 */
import { QA_CHECKS, QaResultSchema } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { formatDate } from '../../platform/format/index.js';
import { commentary, fact, template } from '../rendering/test/support.js';

import {
  CHECK_SEVERITY,
  DETAIL_LIMITS,
  capitalizedTokensOf,
  clip,
  qaContext,
  qaStatusOf,
  runVisualQa,
} from './core.js';
import {
  BRAND,
  FONTS,
  MATCH_A,
  type ValueMode,
  captionVersion,
  check,
  closingText,
  coverText,
  failedChecks,
  fixtureFacts,
  fixtureText,
  matchFacts,
  matchText,
  matchTextWith,
  qaInput,
  resultOf,
  SELECTION_A,
  calendarRowsText,
  calendarVersion,
  overviewText,
  settings,
  slideVersion,
  slug,
  standingsFacts,
  standingsRows,
  standingsText,
  teamFact,
  textElement,
  uuid,
  withModel,
} from './test/support.js';

const ROWS = standingsRows(6);
const FACTS = [...matchFacts(MATCH_A), ...standingsFacts(ROWS)];

function cover(n = 1) {
  return slideVersion(n, 'cover', coverText(SELECTION_A));
}
function match(n = 2, text = matchText(MATCH_A)) {
  return slideVersion(n, 'match_result', text);
}
function standings(n = 3) {
  return slideVersion(n, 'standings', standingsText(ROWS));
}
function closing(n = 4) {
  return slideVersion(n, 'closing', closingText(BRAND.handle));
}

describe('a correct carousel', () => {
  it('passes every check on every slide and the caption, with one closed result per check (R-214)', () => {
    const versions = [cover(), match(), standings(), closing(), captionVersion(5, 'Resumen de la jornada')];
    const output = runVisualQa(qaInput(versions, FACTS), FONTS);
    for (const version of output.versions) {
      expect(version.qaStatus, version.versionId).toBe('passed');
      expect(failedChecks(version)).toEqual([]);
      for (const item of version.results) {
        expect(QaResultSchema.parse(item)).toEqual(item);
        expect(item.severity).toBe(CHECK_SEVERITY[item.check]);
        expect(item.acknowledgedAt).toBeNull();
      }
    }
    expect(output.versions.slice(0, 4).map((version) => version.results.map((item) => item.check))).toEqual(
      Array.from({ length: 4 }, () => [...QA_CHECKS]),
    );
    expect(output.versions[4]?.results.map((item) => item.check)).toEqual(['capitalized_tokens']);
  });

  it('a carousel without standings slides passes every check (R-285)', () => {
    const versions = [cover(), match(), closing(), captionVersion(5, 'Resumen de resultados')];
    const output = runVisualQa(qaInput(versions, matchFacts(MATCH_A)), FONTS);
    expect(output.versions.map((version) => version.qaStatus)).toEqual(['passed', 'passed', 'passed', 'passed']);
    expect(output.versions.flatMap(failedChecks)).toEqual([]);
  });

  it('a demonstration slide passes every check: the band is template text, not examined by the name checks', () => {
    // An alias equal to a word of the demonstration band would be a variant if the band were examined.
    const facts = [...matchFacts(MATCH_A)];
    const aliases = [{ teamId: slug(MATCH_A.home), alias: 'DEMOSTRACIÓN' }];
    const version = slideVersion(2, 'match_result', matchText(MATCH_A), { demonstration: true });
    expect(version.renderModel?.demoLabel).toBe('DEMOSTRACIÓN · datos sintéticos');
    const result = check(version, qaInput([version], facts, { aliases }));
    expect(failedChecks(result)).toEqual([]);
  });

  it('candidate values of unverified facts are the expected display forms (T11G)', () => {
    const facts = matchFacts(MATCH_A, { teams: 'candidate', score: 'candidate', kickoff: 'candidate' });
    expect(failedChecks(check(match(), qaInput([match()], facts)))).toEqual([]);
  });
});

describe('data_match (blocking)', () => {
  function onlyFails(version: ReturnType<typeof match>, facts = FACTS) {
    const result = check(version, qaInput([version], facts));
    expect(failedChecks(result)).toEqual(['data_match']);
    expect(result.qaStatus).toBe('failed');
    return resultOf(result, 'data_match');
  }

  it('fails a score that differs from the verified score, naming the element and the fact (R-214)', () => {
    const seeded = withModel(match(), (model) => {
      textElement(model, 'score').text = '3-1';
      textElement(model, 'score').lines = ['3-1'];
    });
    const result = onlyFails(seeded);
    expect(result.details).toEqual({
      mismatches: [{ elementId: 'score', factId: uuid(13), expected: '2-1', actual: '3-1' }],
    });
  });

  it('fails a kickoff date that differs from the verified kickoff', () => {
    const seeded = withModel(match(), (model) => {
      const element = textElement(model, 'kickoff');
      element.text = '25 oct 2026';
      element.lines = ['25 oct 2026'];
    });
    expect(onlyFails(seeded).details).toEqual({
      mismatches: [
        {
          elementId: 'kickoff',
          factId: uuid(14),
          expected: formatDate(MATCH_A.kickoff, 'es', -360),
          actual: '25 oct 2026',
        },
      ],
    });
  });

  it('compares each standings cell with the stored row form of its fact (OD-49)', () => {
    const version = standings();
    const seeded = withModel(version, (model) => {
      const points = textElement(model, 'row-2-c8');
      points.text = '99';
      points.lines = ['99'];
      const position = textElement(model, 'row-3-position');
      position.text = '7';
      position.lines = ['7'];
    });
    const result = check(seeded, qaInput([seeded], FACTS));
    expect(failedChecks(result)).toEqual(['data_match']);
    const row2 = ROWS[1]?.cells ?? [];
    expect(resultOf(result, 'data_match').details).toEqual({
      mismatches: [
        { elementId: 'row-2-c8', factId: uuid(502), expected: String(row2[8]), actual: '99' },
        { elementId: 'row-3-position', factId: uuid(504), expected: '3', actual: '7' },
      ],
    });
  });

  it('fails a standings value whose fact no longer has a value', () => {
    const facts = FACTS.map((item) =>
      item.id === uuid(500) ? { ...item, status: 'unverified' as const, value: null } : item,
    );
    const result = check(standings(), qaInput([standings()], facts));
    expect(failedChecks(result)).toEqual(['data_match']);
  });

  it('fails a value that cannot be attributed to exactly one fact', () => {
    const seeded = withModel(match(), (model) => {
      textElement(model, 'score').factIds = [];
    });
    // The value is not attributed, and the stored score fact is then not drawn.
    expect(onlyFails(seeded).details).toEqual({
      mismatches: [
        { elementId: 'score', factId: null, expected: '', actual: '2-1' },
        { elementId: 'score', factId: uuid(13), expected: '2-1', actual: '' },
      ],
    });
  });

  it('fails a score whose fact is unverified without a candidate value', () => {
    const facts = matchFacts(MATCH_A, { score: 'none' });
    expect(onlyFails(match(), facts).details).toEqual({
      mismatches: [{ elementId: 'score', factId: uuid(13), expected: '', actual: '2-1' }],
    });
  });

  it('fails a result title that misstates the relation of the score (T10-F06)', () => {
    const text = matchTextWith(MATCH_A, { title: [template('Resultado final · empate')] });
    expect(onlyFails(match(2, text)).details).toEqual({
      mismatches: [
        {
          elementId: 'title',
          factId: uuid(13),
          expected: 'Resultado final · victoria local',
          actual: 'Resultado final · empate',
        },
      ],
    });
  });

  it('fails a substituted value in the AI text that is not a display form of its fact', () => {
    const text = matchTextWith(MATCH_A, {
      description: [commentary('Marcador final '), fact('3-0', uuid(13))],
    });
    expect(onlyFails(match(2, text)).details).toEqual({
      mismatches: [{ elementId: 'description', factId: uuid(13), expected: '2-1', actual: '3-0' }],
    });
  });

  it('accepts the single position and points values of a standings placeholder (OD-49)', () => {
    const text = standingsText(ROWS);
    const description = text.fields.find((field) => field.field === 'description');
    if (description === undefined) {
      throw new Error('no description');
    }
    description.segments = [
      commentary('Puesto '),
      fact('1', uuid(500)),
      commentary(' con '),
      fact(String(ROWS[0]?.cells[8]), uuid(500)),
      commentary(' puntos'),
    ];
    const version = slideVersion(3, 'standings', text);
    expect(failedChecks(check(version, qaInput([version], FACTS)))).toEqual([]);
    description.segments = [commentary('Puesto '), fact('4', uuid(500))];
    const wrong = slideVersion(3, 'standings', text);
    expect(failedChecks(check(wrong, qaInput([wrong], FACTS)))).toEqual(['data_match']);
  });

  it('fails a drawn AI text that differs from the stored text', () => {
    const seeded = withModel(match(), (model) => {
      textElement(model, 'description').text = 'Otro texto distinto.';
      textElement(model, 'description').lines = ['Otro texto distinto.'];
    });
    expect(onlyFails(seeded).details).toEqual({
      mismatches: [
        {
          elementId: 'description',
          factId: null,
          expected: 'Partido sintético de prueba.',
          actual: 'Otro texto distinto.',
        },
      ],
    });
  });

  it('fails a stored fact value that the slide does not draw', () => {
    const seeded = withModel(match(), (model) => {
      model.elements = model.elements.filter((element) => element.id !== 'kickoff');
    });
    expect(onlyFails(seeded).details).toEqual({
      mismatches: [
        { elementId: 'kickoff', factId: uuid(14), expected: formatDate(MATCH_A.kickoff, 'es', -360), actual: '' },
      ],
    });
  });
});

describe('team_names (blocking; R-237)', () => {
  it.each([
    ['abbreviated', 'Club At. Ñandú'],
    ['translated', 'Rhea Athletic Club'],
    ['accent lost', 'Club Atletico Nandu'],
  ])('fails a %s team name element', (_case, written) => {
    const seeded = match(2, matchTextWith(MATCH_A, { team_home: [fact(written, uuid(11))] }));
    const result = check(seeded, qaInput([seeded], FACTS));
    expect(failedChecks(result)).toEqual(['team_names']);
    expect(result.qaStatus).toBe('failed');
    expect(resultOf(result, 'team_names').details).toEqual({
      mismatches: [{ elementId: 'team-home', factId: uuid(11), expected: MATCH_A.home, actual: written }],
    });
  });

  it('fails a standings team name that is not the official name', () => {
    const rows = ROWS.map((row, index) => (index === 0 ? { ...row, team: 'Eq. Sintético 1' } : row));
    const seeded = slideVersion(3, 'standings', standingsText(rows));
    const result = check(seeded, qaInput([seeded], FACTS));
    expect(failedChecks(result)).toEqual(['team_names']);
    expect(resultOf(result, 'team_names').details).toEqual({
      mismatches: [
        { elementId: 'row-1-team', factId: uuid(501), expected: 'Equipo Sintético 1', actual: 'Eq. Sintético 1' },
      ],
    });
  });

  it('fails a translated or abbreviated name in the AI-written headline (known aliases)', () => {
    const aliases = [
      { teamId: slug(MATCH_A.home), alias: 'Rhea Athletic Club' },
      { teamId: slug(MATCH_A.home), alias: 'CAÑ' },
    ];
    for (const written of ['Rhea Athletic Club', 'CAÑ']) {
      const text = matchTextWith(MATCH_A, { headline: [commentary(`Gran tarde de ${written}`)] });
      const result = check(match(2, text), qaInput([match(2, text)], FACTS, { aliases }));
      expect(failedChecks(result)).toContain('team_names');
      expect(resultOf(result, 'team_names').details).toEqual({
        mismatches: [{ elementId: 'headline', factId: uuid(11), expected: MATCH_A.home, actual: written }],
      });
    }
  });

  it('fails a mixed-script look-alike of an official name in the AI text', () => {
    const text = matchTextWith(MATCH_A, { description: [commentary('Gana Club Atlеtico')] });
    const result = check(match(2, text), qaInput([match(2, text)], FACTS));
    expect(failedChecks(result)).toContain('team_names');
    expect(resultOf(result, 'team_names').details).toEqual({
      mismatches: [{ elementId: 'description', factId: null, expected: '', actual: 'Atlеtico' }],
    });
  });

  it('fails a substituted team name segment that is not the official name', () => {
    const text = matchTextWith(MATCH_A, { headline: [fact('Club Atletico Nandu', uuid(11)), commentary(' gana')] });
    const result = check(match(2, text), qaInput([match(2, text)], FACTS));
    expect(failedChecks(result)).toEqual(['team_names']);
  });

  it.each(['es', 'en'] as const)('accepts accented official names shown exactly in %s content', (language) => {
    const sample = { ...MATCH_A, language };
    const text = matchText(sample);
    const version = slideVersion(2, 'match_result', text, { language });
    const result = check(version, qaInput([version], matchFacts(sample), { language }));
    expect(failedChecks(result)).toEqual([]);
  });

  it('uses the candidate name of an unverified team and fails any other form', () => {
    const facts = [teamFact(uuid(11), 'Club Atlético Ñandú B', 'candidate'), ...matchFacts(MATCH_A).slice(1)];
    const result = check(match(), qaInput([match()], facts));
    expect(resultOf(result, 'team_names').details).toEqual({
      mismatches: [
        { elementId: 'team-home', factId: uuid(11), expected: 'Club Atlético Ñandú B', actual: MATCH_A.home },
        { elementId: 'headline', factId: uuid(11), expected: 'Club Atlético Ñandú B', actual: MATCH_A.home },
      ],
    });
  });
});

describe('text_fit (blocking)', () => {
  it('fails an element the render model flags as overflowing (T34)', () => {
    const seeded = withModel(match(), (model) => {
      textElement(model, 'headline').overflow = true;
    });
    const result = check(seeded, qaInput([seeded], FACTS));
    expect(failedChecks(result)).toEqual(['text_fit']);
    expect(resultOf(result, 'text_fit').details).toEqual({ overflowingElements: ['headline'] });
  });

  it('re-measures the text instead of trusting the stored flag', () => {
    const long = 'Crónica extensa '.repeat(20).trim();
    const seeded = withModel(match(), (model) => {
      const element = textElement(model, 'description');
      element.text = long;
      element.lines = [long];
      element.overflow = false;
    });
    const result = check(seeded, qaInput([seeded], FACTS));
    expect(resultOf(result, 'text_fit')).toMatchObject({
      outcome: 'fail',
      details: { overflowingElements: ['description'] },
    });
  });

  it('fails lines that differ from the measured layout, lines taller than the box and a box outside the canvas', () => {
    const lines = withModel(cover(), (model) => {
      textElement(model, 'headline').lines = ['Arranca', 'la jornada sintética'];
    });
    const tall = withModel(cover(), (model) => {
      textElement(model, 'season').box.height = 10;
    });
    const outside = withModel(cover(), (model) => {
      textElement(model, 'stage').box.x = 1000;
    });
    for (const [seeded, id] of [
      [lines, 'headline'],
      [tall, 'season'],
      [outside, 'stage'],
    ] as const) {
      const result = check(seeded, qaInput([seeded], FACTS));
      expect(resultOf(result, 'text_fit').details).toEqual({ overflowingElements: [id] });
    }
  });

  it('fails a slide whose stored text overflows at the smallest size (the template flags it, never truncates)', () => {
    const long = 'Palabra '.repeat(200).trim();
    const text = matchTextWith(MATCH_A, { description: [commentary(long)] });
    const result = check(match(2, text), qaInput([match(2, text)], FACTS));
    expect(resultOf(result, 'text_fit')).toMatchObject({
      outcome: 'fail',
      details: { overflowingElements: ['description'] },
    });
    expect(result.qaStatus).toBe('failed');
  });
});

describe('style_consistency (warning)', () => {
  it('flags colours outside the palette and fonts outside the configured set as a warning', () => {
    const seeded = withModel(match(), (model) => {
      textElement(model, 'title').color = '#FF0000';
      textElement(model, 'kickoff').fontFamily = 'Serif';
      const font = model.fonts[0];
      if (font !== undefined) {
        font.sha256 = '0'.repeat(64);
      }
    });
    const result = check(seeded, qaInput([seeded], FACTS));
    expect(failedChecks(result)).toEqual(['text_fit', 'style_consistency']);
    expect(resultOf(result, 'style_consistency')).toEqual({
      check: 'style_consistency',
      outcome: 'fail',
      severity: 'warning',
      details: {
        colorsOutsidePalette: ['#ff0000'],
        fontsOutsideSet: ['Montserrat 800', 'Serif 400'],
        templateVersions: [],
      },
      acknowledgedAt: null,
    });
  });

  it('flags versions of the same template differing within one carousel; other carousels do not count', () => {
    const current = match(2);
    const older = withModel(match(6), (model) => {
      model.templateVersion = '0.9.0';
    });
    const elsewhere = { ...withModel(match(7), (model) => (model.templateVersion = '0.8.0')), carouselId: uuid(4001) };
    const input = qaInput([current, older, elsewhere], FACTS);
    const result = check(current, input);
    expect(failedChecks(result)).toEqual(['style_consistency']);
    expect(result.qaStatus).toBe('warnings');
    expect(resultOf(result, 'style_consistency').details).toEqual({
      colorsOutsidePalette: [],
      fontsOutsideSet: [],
      templateVersions: ['match-result@0.9.0', 'match-result@1.0.0'],
    });
    expect(failedChecks(check(cover(), input))).toEqual([]);
  });

  it('compares colours without letter case', () => {
    const version = match();
    const input = qaInput([version], FACTS, {
      settings: settings({ palette: { ...settings().palette, accent: '#d4af37' } }),
    });
    expect(failedChecks(check(version, input))).toEqual([]);
  });
});

describe('dimensions (blocking; R-238)', () => {
  it.each([
    [1080, 1080],
    [1350, 1080],
    [1081, 1350],
    [1080, 1349],
    [2160, 2700],
  ])('fails a %i x %i PNG against the configured 1080 x 1350', (width, height) => {
    const version = slideVersion(2, 'match_result', matchText(MATCH_A), { image: { width, height } });
    const result = check(version, qaInput([version], FACTS));
    expect(failedChecks(result)).toEqual(['dimensions']);
    expect(result.qaStatus).toBe('failed');
    expect(resultOf(result, 'dimensions').details).toEqual({
      expectedWidth: 1080,
      expectedHeight: 1350,
      actualWidth: width,
      actualHeight: height,
    });
  });

  it('fails a slide whose PNG could not be read', () => {
    const version = slideVersion(2, 'match_result', matchText(MATCH_A), { image: null });
    expect(resultOf(check(version, qaInput([version], FACTS)), 'dimensions')).toMatchObject({
      outcome: 'fail',
      details: { actualWidth: 0, actualHeight: 0 },
    });
  });

  it('follows the configured format: a 1080 x 1080 configuration accepts only 1080 x 1080', () => {
    const square = settings({ width: 1080, height: 1080 });
    const ok = slideVersion(2, 'match_result', matchText(MATCH_A), {
      width: 1080,
      height: 1080,
      image: { width: 1080, height: 1080 },
    });
    expect(resultOf(check(ok, qaInput([ok], FACTS, { settings: square })), 'dimensions').outcome).toBe('pass');
    const portrait = slideVersion(2, 'match_result', matchText(MATCH_A));
    expect(resultOf(check(portrait, qaInput([portrait], FACTS, { settings: square })), 'dimensions').outcome).toBe(
      'fail',
    );
  });
});

describe('capitalized_tokens (warning; OD-26, OD-38)', () => {
  it('flags capitalized tokens of the AI text that are not verified names, labels, brand terms or listed words', () => {
    const text = matchTextWith(MATCH_A, {
      headline: [fact(MATCH_A.home, uuid(11)), commentary(' gana con Ezequiel Barrantes en gran forma')],
      description: [commentary('Partido en la Liga Sintética Uno para Marca Sintética y Mascotín. Destaca Ezequiel')],
    });
    const version = match(2, text);
    const result = check(version, qaInput([version], FACTS));
    expect(failedChecks(result)).toEqual(['capitalized_tokens']);
    expect(result.qaStatus).toBe('warnings');
    expect(resultOf(result, 'capitalized_tokens')).toEqual({
      check: 'capitalized_tokens',
      outcome: 'fail',
      severity: 'warning',
      details: { tokens: ['Ezequiel', 'Barrantes', 'Destaca'] },
      acknowledgedAt: null,
    });
  });

  it('accepts tokens of verified team names and flags those of unverified team names written as commentary', () => {
    const text = matchTextWith(MATCH_A, {
      description: [commentary('Duelo entre Club Atlético Ñandú y Deportivo Árbol')],
    });
    const verified = check(match(2, text), qaInput([match(2, text)], FACTS));
    expect(resultOf(verified, 'capitalized_tokens').outcome).toBe('pass');
    const candidate = matchFacts(MATCH_A, { teams: 'candidate' as ValueMode });
    const unverified = check(match(2, text), qaInput([match(2, text)], candidate));
    expect(resultOf(unverified, 'capitalized_tokens').details).toEqual({
      tokens: ['Atlético', 'Ñandú', 'Deportivo', 'Árbol'],
    });
  });

  it('examines commentary only: substituted names, template text and the demonstration band are not examined', () => {
    const version = slideVersion(1, 'cover', coverText({ ...SELECTION_A, competition: 'Torneo Zeta Omega' }), {
      demonstration: true,
    });
    expect(capitalizedTokensOf(version, qaContext(qaInput([version], FACTS), FONTS))).toEqual([]);
  });

  it('checks the caption and its hashtags; the hashtag of a verified team name is accepted', () => {
    const caption = captionVersion(5, 'Resumen con Valentina Ochoa', ['#futbol', '#ClubAtléticoÑandú', '#Zafiro']);
    const result = check(caption, qaInput([caption], FACTS));
    expect(result.results.map((item) => item.check)).toEqual(['capitalized_tokens']);
    expect(result.qaStatus).toBe('warnings');
    expect(resultOf(result, 'capitalized_tokens').details).toEqual({ tokens: ['Valentina', 'Ochoa', 'Zafiro'] });
  });

  it('keeps each token once, at most 64 characters, at most 50 tokens', () => {
    const words = Array.from(
      { length: 60 },
      (_, index) =>
        `Nombre${'x'.repeat(index % 3)}${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + Math.floor(index / 26))}`,
    );
    const long = `Z${'a'.repeat(80)}`;
    const caption = captionVersion(5, `${long} ${long} ${words.join(' ')}`);
    const tokens = capitalizedTokensOf(caption, qaContext(qaInput([caption], FACTS), FONTS));
    expect(tokens).toHaveLength(DETAIL_LIMITS.tokens);
    expect(tokens[0]).toBe(long.slice(0, 64));
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('is not run when the database does not accept the check, and then does not affect qa_status', () => {
    const text = matchTextWith(MATCH_A, { description: [commentary('Destaca Ezequiel Barrantes')] });
    const checks = QA_CHECKS.filter((name) => name !== 'capitalized_tokens');
    const result = check(match(2, text), qaInput([match(2, text)], FACTS, { checks }));
    expect(result.results.map((item) => item.check)).toEqual(checks);
    expect(result.qaStatus).toBe('passed');
    const caption = captionVersion(5, 'Destaca Ezequiel');
    expect(check(caption, qaInput([caption], FACTS, { checks }))).toEqual({
      versionId: caption.versionId,
      qaStatus: 'passed',
      results: [],
    });
  });
});

describe('each seeded defect fails its check by name (R-214)', () => {
  const defects = {
    data_match: withModel(match(), (model) => {
      textElement(model, 'score').text = '2-2';
      textElement(model, 'score').lines = ['2-2'];
    }),
    team_names: match(2, matchTextWith(MATCH_A, { team_away: [fact('Dep. Árbol Sintético', uuid(12))] })),
    text_fit: withModel(match(), (model) => {
      textElement(model, 'title').overflow = true;
    }),
    style_consistency: withModel(match(), (model) => {
      const band = model.elements.find((element) => element.id === 'header');
      if (band?.kind === 'rect') {
        band.color = '#123456';
      }
    }),
    dimensions: slideVersion(2, 'match_result', matchText(MATCH_A), { image: { width: 1080, height: 1920 } }),
    capitalized_tokens: match(2, matchTextWith(MATCH_A, { description: [commentary('Figura: Ezequiel')] })),
    // PD-ARCH-01G-E.1: a badge slot that records its team without a badge.
    team_badges: withModel(match(), (model) => {
      const slot = model.elements.find((element) => element.id === 'team-badge-away');
      if (slot?.kind === 'badge_slot') {
        slot.team = { teamId: uuid(70), badge: null };
      }
    }),
  } as const;

  it.each(QA_CHECKS)('%s', (name) => {
    const version = defects[name];
    const result = check(version, qaInput([version], FACTS));
    expect(failedChecks(result)).toEqual([name]);
    expect(result.qaStatus).toBe(CHECK_SEVERITY[name] === 'blocking' ? 'failed' : 'warnings');
  });

  it('the same slide without the defect passes all', () => {
    expect(failedChecks(check(match(), qaInput([match()], FACTS)))).toEqual([]);
  });
});

describe('team_badges (warning; PD-ARCH-01G-E.1, decision DE-E4)', () => {
  /** A match slide whose badge slots record their teams, with a badge or without (null). */
  function withSlots(badges: { home: string | null; away: string | null }) {
    return withModel(match(), (model) => {
      for (const element of model.elements) {
        if (element.kind === 'badge_slot') {
          const badgeId = element.slot === 'team-badge-home' ? badges.home : badges.away;
          element.empty = badgeId === null;
          element.team = {
            teamId: uuid(element.slot === 'team-badge-home' ? 71 : 72),
            badge: badgeId === null ? null : { assetId: badgeId, sha256: 'a'.repeat(64), mime: 'image/png' },
          };
        }
      }
    });
  }

  it('passes when both teams have their badge, and on slides whose slots record no team (DE-E3)', () => {
    const both = check(withSlots({ home: uuid(81), away: uuid(82) }), qaInput([match()], FACTS));
    expect(resultOf(both, 'team_badges')).toMatchObject({ outcome: 'pass', details: { emptyBadgeSlots: [] } });
    // A model rendered before 01G-E.1, or of a project whose badges do not cover the engine templates.
    const legacy = check(match(), qaInput([match()], FACTS));
    expect(resultOf(legacy, 'team_badges')).toMatchObject({ outcome: 'pass', details: { emptyBadgeSlots: [] } });
    // Slides without badge slots pass too.
    expect(resultOf(check(cover(), qaInput([cover()], FACTS)), 'team_badges').outcome).toBe('pass');
  });

  it('warns about one team without a badge, without blocking: the slide is ready once acknowledged', () => {
    const result = check(withSlots({ home: uuid(81), away: null }), qaInput([match()], FACTS));
    expect(failedChecks(result)).toEqual(['team_badges']);
    expect(result.qaStatus).toBe('warnings');
    const warning = resultOf(result, 'team_badges');
    expect(warning).toEqual({
      check: 'team_badges',
      outcome: 'fail',
      severity: 'warning',
      details: { emptyBadgeSlots: ['team-badge-away'] },
      acknowledgedAt: null,
    });
    expect(QaResultSchema.parse(warning)).toEqual(warning);
  });

  it('lists both slots when neither team has a badge', () => {
    const result = check(withSlots({ home: null, away: null }), qaInput([match()], FACTS));
    expect(failedChecks(result)).toEqual(['team_badges']);
    expect(resultOf(result, 'team_badges').details).toEqual({
      emptyBadgeSlots: ['team-badge-home', 'team-badge-away'],
    });
  });

  it('is not run on a caption', () => {
    const caption = runVisualQa(qaInput([captionVersion(5, 'Resumen')], FACTS), FONTS).versions[0];
    expect(caption?.results.map((item) => item.check)).toEqual(['capitalized_tokens']);
  });
});

describe('round calendars with rows (PD-ARCH-01G-E.2)', () => {
  const MATCHES = [
    MATCH_A,
    { ...MATCH_A, home: 'Real Brisamar', away: 'Peñas Sur', factBase: 20, kickoff: '2026-10-25T18:00:00Z' },
    { ...MATCH_A, home: 'Club Deportivo Ejemplo B', away: 'Club Deportivo Ejemplo', factBase: 30 },
  ];
  const ROW_FACTS = [
    ...fixtureFacts(MATCHES[0] as typeof MATCH_A),
    ...fixtureFacts(MATCHES[1] as typeof MATCH_A, 'postponed'),
    ...fixtureFacts(MATCHES[2] as typeof MATCH_A),
  ];
  const TEXT = calendarRowsText(MATCHES, { 1: 'postponed' });
  const ALL_BADGES: { home: string | null; away: string | null }[] = MATCHES.map((_, index) => ({
    home: uuid(810 + index),
    away: uuid(820 + index),
  }));

  function calendar(badges = ALL_BADGES) {
    return calendarVersion(6, TEXT, badges);
  }

  it('passes every check when each row has its values and both badges', () => {
    const result = check(calendar(), qaInput([calendar()], ROW_FACTS));
    expect(failedChecks(result)).toEqual([]);
    expect(resultOf(result, 'team_badges').details).toEqual({ emptyBadgeSlots: [], emptyRowBadgeSlots: [] });
  });

  it('warns about each empty badge slot with its row, without blocking', () => {
    const badges = ALL_BADGES.map((row, index) =>
      index === 0 ? { ...row, away: null } : index === 2 ? { home: null, away: null } : row,
    );
    const result = check(calendar(badges), qaInput([calendar(badges)], ROW_FACTS));
    expect(failedChecks(result)).toEqual(['team_badges']);
    expect(result.qaStatus).toBe('warnings');
    const warning = resultOf(result, 'team_badges');
    expect(warning.details).toEqual({
      emptyBadgeSlots: [],
      emptyRowBadgeSlots: [
        { row: 1, slot: 'team-badge-away' },
        { row: 3, slot: 'team-badge-home' },
        { row: 3, slot: 'team-badge-away' },
      ],
    });
    expect(QaResultSchema.parse(warning)).toEqual(warning);
  });

  it('compares every value of every row with its fact (data_match, team_names)', () => {
    const seeded = withModel(calendar(), (model) => {
      for (const [id, text] of [
        ['row-2-time', '20:00'],
        ['row-2-status', 'Aplazada'],
        ['row-3-away', 'Club Deportivo Ejemplo B'],
      ] as const) {
        textElement(model, id).text = text;
        textElement(model, id).lines = [...(id === 'row-3-away' ? ['Club Deportivo', 'Ejemplo B'] : [text])];
      }
    });
    const result = check(seeded, qaInput([seeded], ROW_FACTS));
    expect(failedChecks(result)).toEqual(['data_match', 'team_names']);
    expect(resultOf(result, 'data_match').details).toEqual({
      mismatches: [
        { elementId: 'row-2-time', factId: uuid(24), expected: '12:00', actual: '20:00' },
        { elementId: 'row-2-status', factId: uuid(25), expected: 'Aplazado', actual: 'Aplazada' },
      ],
    });
    expect(resultOf(result, 'team_names').details).toEqual({
      mismatches: [
        {
          elementId: 'row-3-away',
          factId: uuid(32),
          expected: 'Club Deportivo Ejemplo',
          actual: 'Club Deportivo Ejemplo B',
        },
      ],
    });
  });

  it('does not examine the badges of a calendar without rows (DE-E3)', () => {
    const legacy = slideVersion(7, 'round_overview', overviewText(MATCHES));
    expect(legacy.renderModel?.templateVersion).toBe('1.0.0');
    const result = check(legacy, qaInput([legacy], ROW_FACTS));
    expect(failedChecks(result)).toEqual([]);
    expect(resultOf(result, 'team_badges').details).toEqual({ emptyBadgeSlots: [] });
  });
});

describe('qa_status and limits', () => {
  it('derives failed, warnings and passed (OD-09)', () => {
    const pass = { check: 'dimensions', outcome: 'pass', severity: 'blocking' } as const;
    const warn = { check: 'style_consistency', outcome: 'fail', severity: 'warning' } as const;
    const block = { check: 'text_fit', outcome: 'fail', severity: 'blocking' } as const;
    expect(qaStatusOf([pass] as never)).toBe('passed');
    expect(qaStatusOf([pass, warn] as never)).toBe('warnings');
    expect(qaStatusOf([warn, block] as never)).toBe('failed');
    expect(qaStatusOf([])).toBe('passed');
  });

  it('clips text at code-point boundaries', () => {
    expect(clip('abc', 5)).toBe('abc');
    expect(clip('ab😀c', 3)).toBe('ab');
    expect(clip('ab😀c', 4)).toBe('ab😀');
  });

  it('keeps mismatch texts within the contract limits', () => {
    const long = 'Ñ'.repeat(300);
    const seeded = withModel(match(), (model) => {
      textElement(model, 'score').text = long;
    });
    const details = resultOf(check(seeded, qaInput([seeded], FACTS)), 'data_match').details as {
      mismatches: { actual: string }[];
    };
    expect(details.mismatches[0]?.actual).toHaveLength(200);
  });
});

describe('matches not played yet (PD-ARCH-01E-B)', () => {
  it('passes every check on a fixture, a postponed fixture and a preview', () => {
    for (const [type, status] of [
      ['fixture', 'scheduled'],
      ['fixture', 'postponed'],
      ['match_preview', 'scheduled'],
    ] as const) {
      const version = slideVersion(2, type, fixtureText(MATCH_A, type, status));
      const result = check(version, qaInput([version], fixtureFacts(MATCH_A, status)));
      expect(failedChecks(result), `${type} ${status}`).toEqual([]);
    }
  });

  it('fails a status that differs from the local status of the match', () => {
    const version = slideVersion(2, 'fixture', fixtureText(MATCH_A, 'fixture', 'scheduled'));
    const result = check(version, qaInput([version], fixtureFacts(MATCH_A, 'postponed')));
    expect(failedChecks(result)).toEqual(['data_match']);
    expect(resultOf(result, 'data_match').details).toEqual({
      mismatches: [{ elementId: 'match-status', factId: uuid(15), expected: 'Aplazado', actual: 'Programado' }],
    });
  });

  it('fails any score drawn on a slide of a match not played yet', () => {
    const version = withModel(slideVersion(2, 'fixture', fixtureText(MATCH_A)), (model) => {
      const status = textElement(model, 'match-status');
      model.elements.push({ ...status, id: 'score', field: 'score', semantic: 'score', text: '1-0', lines: ['1-0'] });
    });
    const result = check(version, qaInput([version], fixtureFacts(MATCH_A)));
    expect(failedChecks(result)).toContain('data_match');
    expect(resultOf(result, 'data_match').details).toMatchObject({
      mismatches: expect.arrayContaining([{ elementId: 'score', factId: uuid(15), expected: '', actual: '1-0' }]),
    });
  });
});
