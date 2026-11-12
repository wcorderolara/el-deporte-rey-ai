/**
 * Match preview template (PD-ARCH-01E-B): one match not played yet. The preview title with the round (`title`), the
 * status label (`match_status`), the two official team names, the kickoff date and time, the competition and season
 * (`footer`, template text), two badge slots, the AI headline and a longer AI description, and the brand logo. Only
 * local data is drawn: no score, line-up, statistic, prediction or standing.
 *
 * Versions (OD-13): 1.0.0 leaves the badge slots empty; 1.1.0 (PD-ARCH-01G-E.1) draws the badge of each team from the
 * project's snapshot. The layout of both versions is the same.
 */
import { templateText } from '../../../platform/format/index.js';
import { runOf, segmentsOf } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition, templateRun } from './common.js';
import { aiFields, fixtureBody } from './shared.js';

function matchPreview(version: string, drawsBadges: boolean): TemplateDefinition {
  const template: TemplateDefinition = Object.freeze<TemplateDefinition>({
    id: 'match-preview',
    version,
    slideType: 'match_preview',
    label: 'Previa de partido',
    imageSlots: Object.freeze(['brand_logo'] as const),
    badgeSlots: Object.freeze(['team-badge-home', 'team-badge-away'] as const),
    drawsBadges,
    build(content, ctx) {
      const model = new ModelBuilder(template, content, ctx);
      model.chrome();
      model.text({
        id: 'title',
        field: 'title',
        semantic: 'title',
        x: 60,
        y: 222,
        width: 960,
        height: 80,
        role: 'heading',
        maxSize: 44,
        minSize: 24,
        maxLines: 1,
        colorRole: 'accent',
        run: runOf(segmentsOf(content.text, 'title')),
      });
      fixtureBody(model, content, templateRun(templateText(content.language).versus));
      model.text({
        id: 'footer',
        field: 'footer',
        semantic: 'competition_name',
        x: 60,
        y: 830,
        width: 960,
        height: 50,
        role: 'body',
        maxSize: 30,
        minSize: 20,
        maxLines: 1,
        colorRole: 'light',
        run: runOf(segmentsOf(content.text, 'footer')),
      });
      aiFields(model, content, {
        headline: { y: 895, height: 140, maxSize: 44, minSize: 26, maxLines: 2 },
        description: { y: 1045, height: 185, maxSize: 30, minSize: 20, maxLines: 5 },
      });
      return model.build();
    },
  });
  return template;
}

/** Version 1.0.0: empty badge slots (rendered before PD-ARCH-01G-E.1). */
export const matchPreviewTemplateV1 = matchPreview('1.0.0', false);
/** The current version: the badges of the project's snapshot (PD-ARCH-01G-E.1). */
export const matchPreviewTemplate = matchPreview('1.1.0', true);
