/**
 * Round overview template (PD-ARCH-01E-B): the calendar page of a round. The calendar title with the round
 * (`title`) and one line per fixture (`fixtures`: the two official team names and the kickoff, fact segments
 * separated by template text), on alternating bands, then the AI headline and description and the brand logo.
 * Lines beyond the list area are flagged by the text-fit check, never dropped.
 */
import { runOf, segmentsOf, type StoredSegment } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition } from './common.js';
import { aiFields } from './shared.js';

/** Top and height of the list area in the reference layout. */
const LIST_TOP = 330;
const LIST_HEIGHT = 680;
const MAX_LINE_HEIGHT = 85;
const MIN_LINE_HEIGHT = 40;

/** The lines of a `fixtures` field: lines are separated by template line feeds (content module `composeSlide`). */
export function fixtureLinesOf(segments: readonly StoredSegment[]): StoredSegment[][] {
  const lines: StoredSegment[][] = [[]];
  for (const segment of segments) {
    if (segment.provenance === 'template_text' && segment.text === '\n') {
      lines.push([]);
    } else {
      lines[lines.length - 1]?.push(segment);
    }
  }
  return lines.filter((line) => line.length > 0);
}

export const roundOverviewTemplate: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'round-overview',
  version: '1.0.0',
  slideType: 'round_overview',
  label: 'Calendario de jornada',
  imageSlots: Object.freeze(['brand_logo'] as const),
  badgeSlots: Object.freeze([]),
  build(content, ctx) {
    const model = new ModelBuilder(roundOverviewTemplate, content, ctx);
    model.chrome();
    model.text({
      id: 'title',
      field: 'title',
      semantic: 'title',
      x: 60,
      y: 218,
      width: 960,
      height: 90,
      role: 'heading',
      maxSize: 52,
      minSize: 28,
      maxLines: 1,
      colorRole: 'accent',
      run: runOf(segmentsOf(content.text, 'title')),
    });
    const lines = fixtureLinesOf(segmentsOf(content.text, 'fixtures'));
    const lineHeight = Math.max(MIN_LINE_HEIGHT, Math.min(MAX_LINE_HEIGHT, LIST_HEIGHT / Math.max(1, lines.length)));
    lines.forEach((line, index) => {
      const y = LIST_TOP + index * lineHeight;
      if (index % 2 === 0) {
        model.rect(`line-${String(index + 1)}-band`, 30, y, 1020, lineHeight, 'primary');
      }
      model.text({
        id: `line-${String(index + 1)}`,
        field: 'fixtures',
        semantic: 'fixture_line',
        x: 50,
        y,
        width: 980,
        height: lineHeight,
        role: 'body',
        maxSize: Math.min(34, lineHeight * 0.45),
        minSize: Math.min(18, lineHeight * 0.3),
        maxLines: 2,
        colorRole: 'light',
        run: runOf(line),
      });
    });
    aiFields(model, content, {
      headline: { y: 1030, height: 110, maxSize: 40, minSize: 24, maxLines: 2 },
      description: { y: 1150, height: 90, maxSize: 28, minSize: 18, maxLines: 2 },
    });
    return model.build();
  },
});
