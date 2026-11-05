/**
 * Text boxes shared by the templates: the AI headline and description (substituted provenance segments of the
 * content stage), drawn full width at the given vertical position.
 */
import { runOf, type SegmentRun, segmentsOf, type SlideContent } from '../slide-content.js';

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

/**
 * The body of a match not played yet (fixture and preview templates, PD-ARCH-01E-B): the status label, the two
 * empty badge slots around the versus mark, the two team names and the kickoff. There is no score element.
 */
export function fixtureBody(model: ModelBuilder, content: SlideContent, versus: SegmentRun): void {
  model.text({
    id: 'match-status',
    field: 'match_status',
    semantic: 'match_status',
    x: 60,
    y: 305,
    width: 960,
    height: 50,
    role: 'numeric',
    maxSize: 30,
    minSize: 20,
    maxLines: 1,
    colorRole: 'light',
    run: runOf(segmentsOf(content.text, 'match_status')),
  });
  model.badge('team-badge-home', 150, 370, 180, 180);
  model.badge('team-badge-away', 750, 370, 180, 180);
  model.text({
    id: 'versus',
    field: 'title',
    semantic: 'title',
    x: 390,
    y: 410,
    width: 300,
    height: 100,
    role: 'numeric',
    maxSize: 80,
    minSize: 40,
    maxLines: 1,
    colorRole: 'accent',
    run: versus,
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
      y: 565,
      width: 460,
      height: 180,
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
    y: 760,
    width: 960,
    height: 60,
    role: 'body',
    maxSize: 36,
    minSize: 22,
    maxLines: 1,
    colorRole: 'light',
    run: runOf(segmentsOf(content.text, 'kickoff')),
  });
}
