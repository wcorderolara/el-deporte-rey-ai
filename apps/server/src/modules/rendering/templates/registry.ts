/**
 * Template registry (OD-13, U-06; R-031, R-211): templates are versioned code. The registry keeps every registered
 * version; the current version of a slide type is the last one registered for it. A new version applies to slides
 * rendered afterwards; element versions already rendered keep the template ID and version stored with them
 * (architecture.md section 9).
 */
import type { SlideType, Template } from '@edr/contracts';

import type { SlideContent } from '../slide-content.js';

import type { TemplateDefinition } from './common.js';
import { closingTemplate } from './closing.js';
import { coverTemplate } from './cover.js';
import { fixtureTemplate, fixtureTemplateV1 } from './fixture.js';
import { matchPreviewTemplate, matchPreviewTemplateV1 } from './match-preview.js';
import { matchResultTemplate, matchResultTemplateV1 } from './match-result.js';
import { roundOverviewTemplate, roundOverviewTemplateV1 } from './round-overview.js';
import { standingsTemplate } from './standings.js';

/**
 * The built-in templates of this release, every version kept (OD-13). The current version of a slide type is its last
 * one: the match templates are at 1.1.0, which draw the team badges (PD-ARCH-01G-E.1), and the round calendar at
 * 2.0.0, one row per match with both badges (PD-ARCH-01G-E.2).
 */
export const BUILT_IN_TEMPLATES: readonly TemplateDefinition[] = Object.freeze([
  coverTemplate,
  matchResultTemplateV1,
  standingsTemplate,
  closingTemplate,
  // PD-ARCH-01E-B: matches not played yet.
  roundOverviewTemplateV1,
  fixtureTemplateV1,
  matchPreviewTemplateV1,
  // PD-ARCH-01G-E.1: team badges in the badge slots.
  matchResultTemplate,
  fixtureTemplate,
  matchPreviewTemplate,
  // PD-ARCH-01G-E.2: round calendars as rows with the team badges.
  roundOverviewTemplate,
]);

export class TemplateRegistry {
  readonly #all: readonly TemplateDefinition[];
  readonly #current: ReadonlyMap<SlideType, TemplateDefinition>;

  constructor(templates: readonly TemplateDefinition[] = BUILT_IN_TEMPLATES) {
    const seen = new Set<string>();
    const current = new Map<SlideType, TemplateDefinition>();
    for (const template of templates) {
      const key = `${template.id}@${template.version}`;
      if (seen.has(key)) {
        throw new TypeError('a template version is registered twice');
      }
      const previous = current.get(template.slideType);
      if (previous !== undefined && previous.id !== template.id) {
        throw new TypeError('a slide type has templates with different IDs');
      }
      seen.add(key);
      current.set(template.slideType, template);
    }
    this.#all = Object.freeze([...templates]);
    this.#current = current;
  }

  /** The current template of each slide type, in registration order of the slide types. */
  list(): TemplateDefinition[] {
    return [...this.#current.values()];
  }

  /** The current template of a slide type. */
  current(slideType: SlideType): TemplateDefinition {
    const template = this.#current.get(slideType);
    if (template === undefined) {
      throw new TypeError('no template is registered for this slide type');
    }
    return template;
  }

  /**
   * The template that draws a slide of a project whose badges do not cover the engine templates (decision DE-E3 of
   * PD-ARCH-01G-E): the last registered version of the slide type that leaves its badge slots empty, so the slides of
   * those projects keep the version, the render model and the image they had (match templates 1.0.0, round calendar
   * 1.0.0). The current version when every version of the type draws badges.
   */
  currentWithoutBadges(slideType: SlideType): TemplateDefinition {
    const legacy = this.#all.findLast((template) => template.slideType === slideType && template.drawsBadges !== true);
    return legacy ?? this.current(slideType);
  }

  /**
   * The template that draws a slide (decision DE-E3): the last registered version of its type that either draws no
   * badges or draws the badges the slide has. A match template that draws badges needs `SlideContent.badges`
   * (PD-ARCH-01G-E.1); a calendar template with rows needs `SlideContent.rowBadges` (PD-ARCH-01G-E.2). So a project
   * keeps the versions its badge snapshot covers: no snapshot or version 1, every 1.0.0; version 2, the match
   * templates 1.1.0 and the calendar 1.0.0; version 3, the current versions.
   */
  forContent(content: Pick<SlideContent, 'slideType' | 'badges' | 'rowBadges'>): TemplateDefinition {
    const drawable = this.#all.findLast(
      (template) =>
        template.slideType === content.slideType &&
        (template.drawsBadges !== true ||
          (template.rows === undefined ? content.badges !== undefined : content.rowBadges !== undefined)),
    );
    return drawable ?? this.current(content.slideType);
  }

  /** The current version of a template ID, or undefined. */
  byId(templateId: string): TemplateDefinition | undefined {
    return this.list().find((template) => template.id === templateId);
  }

  /** A registered version of a template, or undefined. */
  get(templateId: string, version: string): TemplateDefinition | undefined {
    return this.#all.find((template) => template.id === templateId && template.version === version);
  }
}

/** The contract view of a template (operation listTemplates). */
export function toContractTemplate(template: TemplateDefinition): Template {
  return {
    id: template.id,
    version: template.version,
    slideType: template.slideType,
    label: template.label,
    // A calendar with rows has the badge slots of every row (PD-ARCH-01G-E.2).
    badgeSlots: template.badgeSlots.length * (template.rows ?? 1),
    imageSlots: [...template.imageSlots],
  };
}
