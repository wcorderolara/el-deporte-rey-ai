/**
 * Match-result template (architecture.md section 9): the fixed result title with the deterministic result relation
 * (`title`), the two official team names (`team_home`, `team_away`), the score and the kickoff date (fact segments
 * substituted by the content stage from the verified or candidate values), two reserved badge slots that stay empty
 * (PD-03, R-050, R-231; the layout is complete without them), the AI headline and description, and the brand logo.
 */
import { runOf, segmentsOf } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition } from './common.js';
import { aiFields } from './shared.js';

export const matchResultTemplate: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'match-result',
  version: '1.0.0',
  slideType: 'match_result',
  label: 'Resultado de partido',
  imageSlots: Object.freeze(['brand_logo'] as const),
  badgeSlots: Object.freeze(['team-badge-home', 'team-badge-away'] as const),
  build(content, ctx) {
    const model = new ModelBuilder(matchResultTemplate, content, ctx);
    model.chrome();
    model.text({
      id: 'title',
      field: 'title',
      semantic: 'title',
      x: 60,
      y: 222,
      width: 960,
      height: 100,
      role: 'numeric',
      maxSize: 40,
      minSize: 24,
      maxLines: 2,
      colorRole: 'accent',
      run: runOf(segmentsOf(content.text, 'title')),
    });
    model.badge('team-badge-home', 150, 345, 180, 180);
    model.badge('team-badge-away', 750, 345, 180, 180);
    model.text({
      id: 'score',
      field: 'score',
      semantic: 'score',
      x: 340,
      y: 335,
      width: 400,
      height: 200,
      role: 'numeric',
      maxSize: 150,
      minSize: 80,
      maxLines: 1,
      colorRole: 'accent',
      run: runOf(segmentsOf(content.text, 'score')),
    });
    for (const [side, x] of [
      ['home', 40],
      ['away', 580],
    ] as const) {
      model.text({
        id: `team-${side}`,
        field: side === 'home' ? 'team_home' : 'team_away',
        semantic: 'team_name',
        x,
        y: 550,
        width: 460,
        height: 200,
        role: 'heading',
        maxSize: 50,
        minSize: 28,
        maxLines: 3,
        colorRole: 'light',
        run: runOf(segmentsOf(content.text, side === 'home' ? 'team_home' : 'team_away')),
      });
    }
    model.text({
      id: 'kickoff',
      field: 'kickoff',
      semantic: 'kickoff',
      x: 60,
      y: 765,
      width: 960,
      height: 56,
      role: 'body',
      maxSize: 34,
      minSize: 22,
      maxLines: 1,
      colorRole: 'light',
      run: runOf(segmentsOf(content.text, 'kickoff')),
    });
    aiFields(model, content, {
      headline: { y: 845, height: 185, maxSize: 46, minSize: 28, maxLines: 3 },
      description: { y: 1045, height: 175, maxSize: 32, minSize: 22, maxLines: 4 },
    });
    return model.build();
  },
});
