/**
 * Cover template (architecture.md sections 8.1 and 9): competition name, stage display and season label (the stored
 * `title` segments, in that order), the carousel number of a split selection (`footer`, "1/2"), the AI headline and
 * description, the brand logo and mascot slots. No competition, stage or season is assumed (PD-14, R-285).
 */
import { runOf, segmentsOf } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition } from './common.js';
import { aiFields } from './shared.js';

export const coverTemplate: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'cover',
  version: '1.0.0',
  slideType: 'cover',
  label: 'Portada',
  imageSlots: Object.freeze(['brand_logo', 'mascot'] as const),
  badgeSlots: Object.freeze([]),
  build(content, ctx) {
    const model = new ModelBuilder(coverTemplate, content, ctx);
    model.chrome();
    const [competition, stage, ...season] = segmentsOf(content.text, 'title');
    if (competition !== undefined) {
      model.text({
        id: 'competition',
        field: 'title',
        semantic: 'competition_name',
        x: 60,
        y: 250,
        width: 960,
        height: 330,
        role: 'heading',
        maxSize: 84,
        minSize: 40,
        maxLines: 3,
        colorRole: 'light',
        run: runOf([competition]),
      });
    }
    if (stage !== undefined) {
      model.text({
        id: 'stage',
        field: 'title',
        semantic: 'stage_display',
        x: 60,
        y: 600,
        width: 960,
        height: 120,
        role: 'numeric',
        maxSize: 44,
        minSize: 26,
        maxLines: 2,
        colorRole: 'accent',
        run: runOf([stage]),
      });
    }
    if (season.length > 0) {
      model.text({
        id: 'season',
        field: 'title',
        semantic: 'season_label',
        x: 60,
        y: 730,
        width: 960,
        height: 60,
        role: 'body',
        maxSize: 40,
        minSize: 24,
        maxLines: 1,
        colorRole: 'light',
        run: runOf(season),
      });
    }
    aiFields(model, content, {
      headline: { y: 820, height: 190, maxSize: 50, minSize: 30, maxLines: 3 },
      description: { y: 1020, height: 130, maxSize: 34, minSize: 22, maxLines: 3 },
    });
    const footer = segmentsOf(content.text, 'footer');
    if (footer.length > 0) {
      model.text({
        id: 'carousel-number',
        field: 'footer',
        semantic: 'carousel_number',
        x: 60,
        y: 1220,
        width: 300,
        height: 70,
        role: 'numeric',
        maxSize: 44,
        minSize: 28,
        maxLines: 1,
        colorRole: 'accent',
        align: 'left',
        run: runOf(footer),
      });
    }
    model.image('mascot', 800, 1160, 240, 170);
    return model.build();
  },
});
