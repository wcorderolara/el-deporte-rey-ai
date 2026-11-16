/**
 * Visual QA of the render models of structured visual templates (PD-ARCH-01G-D, decision D9): the values a template
 * draws are compared with their facts (each team's goals included), the template does not have to draw every fact
 * segment, the AI text or the result title, and capital letters are measured as drawn (PD-29).
 */
import { describe, expect, it } from 'vitest';

import { PALETTE, MATCH_A, fact, matchText, uuid } from '../rendering/test/support.js';
import { type StructuredTextStyle, buildStructuredModel } from '../rendering/structured.js';
import type { RenderModel } from '../rendering/render-model.js';

import { FONTS, check, failedChecks, matchFacts, qaInput, resultOf } from './test/support.js';
import type { VersionToCheck } from './schemas.js';

const STYLE: StructuredTextStyle = {
  fontRole: 'numeric',
  maxFontSize: 90,
  minFontSize: 40,
  maxLines: 2,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
  uppercase: true,
  effect: 'scoreboard_gold',
};

const SCORE_FACT = uuid(MATCH_A.factBase + 3);

/** A template slide: both names in capital letters and the score from each team's goals, no title, no AI text. */
function templateModel(homeGoals = '2'): RenderModel {
  const run = (text: string, factId: string) => ({ text, factIds: [factId], provenance: 'fact' as const });
  return buildStructuredModel(
    {
      templateId: `vt-${uuid(700)}`,
      templateVersion: '1',
      slideType: 'match_result',
      language: 'es',
      designCanvas: { width: 1080, height: 1350 },
      canvas: { width: 1080, height: 1350 },
      items: [
        {
          kind: 'text',
          id: 'layer-home',
          field: 'team_home',
          semantic: 'team_name',
          box: { x: 0.03, y: 0.4, width: 0.44, height: 0.15 },
          style: STYLE,
          run: run(MATCH_A.home, uuid(MATCH_A.factBase + 1)),
        },
        {
          kind: 'text',
          id: 'layer-away',
          field: 'team_away',
          semantic: 'team_name',
          box: { x: 0.53, y: 0.4, width: 0.44, height: 0.15 },
          style: STYLE,
          run: run(MATCH_A.away, uuid(MATCH_A.factBase + 2)),
        },
        {
          kind: 'text',
          id: 'layer-home-score',
          field: 'score_home',
          semantic: 'score_home',
          box: { x: 0.2, y: 0.6, width: 0.25, height: 0.12 },
          style: STYLE,
          run: run(homeGoals, SCORE_FACT),
        },
        {
          kind: 'text',
          id: 'layer-separator',
          field: 'title',
          semantic: 'title',
          box: { x: 0.45, y: 0.6, width: 0.1, height: 0.12 },
          style: STYLE,
          run: { text: '-', factIds: [], provenance: 'template_text' },
        },
        {
          kind: 'text',
          id: 'layer-away-score',
          field: 'score_away',
          semantic: 'score_away',
          box: { x: 0.55, y: 0.6, width: 0.25, height: 0.12 },
          style: STYLE,
          run: run('1', SCORE_FACT),
        },
      ],
    },
    { palette: { ...PALETTE }, fonts: FONTS },
  ).model;
}

function version(model: RenderModel): VersionToCheck {
  const stored = matchText(MATCH_A, { headline: 'Titular', description: 'Descripción' });
  return {
    versionId: uuid(9100),
    elementId: uuid(8100),
    carouselId: uuid(4000),
    kind: 'slide',
    slideType: 'match_result',
    text: {
      ...stored,
      fields: [
        ...stored.fields,
        { field: 'score_home', segments: [fact('2', SCORE_FACT)] },
        { field: 'score_away', segments: [fact('1', SCORE_FACT)] },
      ],
    },
    renderModel: model,
    image: { width: 1080, height: 1350 },
  };
}

describe('visual QA of a structured template slide', () => {
  it('passes when every drawn value equals its fact, without the kickoff, the title or the AI text', () => {
    const target = version(templateModel());
    const result = check(target, qaInput([target], matchFacts(MATCH_A)));
    expect(failedChecks(result).filter((name) => name !== 'capitalized_tokens')).toEqual([]);
    expect(resultOf(result, 'text_fit').outcome).toBe('pass');
  });

  it('fails a team goal that differs from the score fact', () => {
    const target = version(templateModel('3'));
    const result = check(target, qaInput([target], matchFacts(MATCH_A)));
    expect(failedChecks(result)).toContain('data_match');
    expect(resultOf(result, 'data_match').details).toEqual({
      mismatches: [{ elementId: 'layer-home-score', factId: SCORE_FACT, expected: '2', actual: '3' }],
    });
  });

  it('fails text whose stored lines were not measured in capital letters', () => {
    const model = templateModel();
    const home = model.elements.find((element) => element.id === 'layer-home');
    if (home?.kind === 'text') {
      home.lines = home.lines.map((line) => line.toLowerCase());
    }
    const target = version(model);
    expect(failedChecks(check(target, qaInput([target], matchFacts(MATCH_A))))).toContain('text_fit');
  });
});
