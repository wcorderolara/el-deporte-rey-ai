/**
 * Template registry (OD-13, U-06; R-031, R-211): templates are versioned code. The registry keeps every registered
 * version; the current version of a slide type is the last one registered for it. A new version applies to slides
 * rendered afterwards; element versions already rendered keep the template ID and version stored with them
 * (architecture.md section 9).
 */
import type { SlideType, Template } from '@edr/contracts';

import type { TemplateDefinition } from './common.js';
import { closingTemplate } from './closing.js';
import { coverTemplate } from './cover.js';
import { fixtureTemplate, fixtureTemplateV1 } from './fixture.js';
import { matchPreviewTemplate, matchPreviewTemplateV1 } from './match-preview.js';
import { matchResultTemplate, matchResultTemplateV1 } from './match-result.js';
import { roundOverviewTemplate } from './round-overview.js';
import { standingsTemplate } from './standings.js';

/**
 * The built-in templates of this release, every version kept (OD-13). The current version of a slide type is its last
 * one: the match templates are at 1.1.0, which draw the team badges (PD-ARCH-01G-E.1).
 */
export const BUILT_IN_TEMPLATES: readonly TemplateDefinition[] = Object.freeze([
  coverTemplate,
  matchResultTemplateV1,
  standingsTemplate,
  closingTemplate,
  // PD-ARCH-01E-B: matches not played yet.
  roundOverviewTemplate,
  fixtureTemplateV1,
  matchPreviewTemplateV1,
  // PD-ARCH-01G-E.1: team badges in the badge slots.
  matchResultTemplate,
  fixtureTemplate,
  matchPreviewTemplate,
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
   * those projects keep the version, the render model and the image they had (match templates 1.0.0). The current
   * version when every version of the type draws badges.
   */
  currentWithoutBadges(slideType: SlideType): TemplateDefinition {
    const legacy = this.#all.findLast((template) => template.slideType === slideType && template.drawsBadges !== true);
    return legacy ?? this.current(slideType);
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
    badgeSlots: template.badgeSlots.length,
    imageSlots: [...template.imageSlots],
  };
}
