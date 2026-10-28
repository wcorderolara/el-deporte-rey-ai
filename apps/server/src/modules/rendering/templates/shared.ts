/**
 * Text boxes shared by the templates: the AI headline and description (substituted provenance segments of the
 * content stage), drawn full width at the given vertical position.
 */
import { runOf, segmentsOf, type SlideContent } from '../slide-content.js';

import type { ModelBuilder } from './common.js';

export interface AiBox {
  readonly y: number;
  readonly height: number;
  readonly maxSize: number;
  readonly minSize: number;
  readonly maxLines: number;
}

/** Draws the `headline` (heading font) and `description` (body font) fields when present. */
export function aiFields(
  model: ModelBuilder,
  content: SlideContent,
  boxes: { readonly headline: AiBox; readonly description: AiBox },
): void {
  model.text({
    id: 'headline',
    field: 'headline',
    semantic: 'headline',
    x: 60,
    width: 960,
    role: 'heading',
    colorRole: 'light',
    ...boxes.headline,
    run: runOf(segmentsOf(content.text, 'headline')),
  });
  model.text({
    id: 'description',
    field: 'description',
    semantic: 'description',
    x: 60,
    width: 960,
    role: 'body',
    colorRole: 'light',
    ...boxes.description,
    run: runOf(segmentsOf(content.text, 'description')),
  });
}
