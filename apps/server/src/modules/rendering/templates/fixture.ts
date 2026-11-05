/**
 * Fixture template (PD-ARCH-01E-B): a match not played yet. The fixed fixture title (`title`), the status label of
 * the local status (`match_status`), the two official team names (`team_home`, `team_away`) and the kickoff date and
 * time (fact segments substituted by the content stage), two reserved badge slots that stay empty (PD-03, R-050), the
 * AI headline and description, and the brand logo. It never draws a score: the match has not been played.
 */
import { templateText } from '../../../platform/format/index.js';
import { runOf, segmentsOf } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition, templateRun } from './common.js';
import { aiFields, fixtureBody } from './shared.js';

export const fixtureTemplate: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'fixture',
  version: '1.0.0',
  slideType: 'fixture',
  label: 'Partido programado',
  imageSlots: Object.freeze(['brand_logo'] as const),
  badgeSlots: Object.freeze(['team-badge-home', 'team-badge-away'] as const),
  build(content, ctx) {
    const model = new ModelBuilder(fixtureTemplate, content, ctx);
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
    aiFields(model, content, {
      headline: { y: 860, height: 175, maxSize: 46, minSize: 28, maxLines: 3 },
      description: { y: 1050, height: 170, maxSize: 32, minSize: 22, maxLines: 4 },
    });
    return model.build();
  },
});
