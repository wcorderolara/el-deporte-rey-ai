/**
 * Closing template (architecture.md section 9): the fixed follow text with the brand handle (`title`), the AI
 * headline and description, the brand logo and the mascot slot (drawn only when an active mascot exists, OD-07).
 */
import { runOf, segmentsOf } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition } from './common.js';
import { aiFields } from './shared.js';

export const closingTemplate: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'closing',
  version: '1.0.0',
  slideType: 'closing',
  label: 'Cierre',
  imageSlots: Object.freeze(['brand_logo', 'mascot'] as const),
  badgeSlots: Object.freeze([]),
  build(content, ctx) {
    const model = new ModelBuilder(closingTemplate, content, ctx);
    model.chrome();
    model.text({
      id: 'title',
      field: 'title',
      semantic: 'title',
      x: 60,
      y: 320,
      width: 960,
      height: 170,
      role: 'heading',
      maxSize: 64,
      minSize: 36,
      maxLines: 2,
      colorRole: 'light',
      run: runOf(segmentsOf(content.text, 'title')),
    });
    aiFields(model, content, {
      headline: { y: 530, height: 185, maxSize: 48, minSize: 30, maxLines: 3 },
      description: { y: 735, height: 175, maxSize: 34, minSize: 22, maxLines: 4 },
    });
    model.image('mascot', 380, 960, 320, 330);
    return model.build();
  },
});
