/**
 * Template previews (contract operation previewTemplate; OD-13, R-031; T10-F04, OD-41).
 *
 * A preview is the current version of a template rendered from built-in synthetic sample data (no project, no fact
 * of any run), with the configured format, palette and fonts and the active brand assets. Sample slides are labelled
 * with the demonstration band, as synthetic content (OD-21).
 *
 * Bounded work per request (T10-F04): previews are cached in memory by template ID and version, language and the
 * active brand-asset IDs and hashes of each image slot; concurrent requests for the same key share one render; the
 * cache keeps at most `PREVIEW_CACHE_ENTRIES` previews (least recently used dropped first). The HTTP response is not
 * cacheable by the browser (`no-store`, OD-41), so an activated or deactivated asset shows at once.
 */
import type { Language } from '@edr/contracts';

import type { AppConfig } from '../../platform/config/index.js';
import { formatDate, formatScore, stageDisplay, templateText } from '../../platform/format/index.js';
import type { BrandAssetLookup } from '../brand/index.js';

import { IMAGE_SLOTS, type SlotAsset, renderContent, renderSettings } from './core.js';
import type { FontSet } from './fonts.js';
import type { SlideContent, StoredSegment, StoredTextField } from './slide-content.js';
import type { TemplateDefinition } from './templates/common.js';
import type { TemplateRegistry } from './templates/registry.js';

/** Most previews kept in memory. */
export const PREVIEW_CACHE_ENTRIES = 32;

/** Synthetic sample instants (fixed, so previews are deterministic). */
const SAMPLE_KICKOFF = '2026-10-24T20:00:00Z';
const SAMPLE_AS_OF = '2026-10-25T12:00:00Z';

/** Synthetic sample team names (no real club). */
const SAMPLE_TEAMS = [
  'Club Deportivo Ejemplo',
  'Atlético Muestra',
  'Real Sociedad Modelo',
  'Unión Ficticia',
  'Deportivo Prueba',
  'Racing Demostración',
  'Sporting Simulado',
  'Juventud Plantilla',
  'Estrella Sintética',
  'Academia Borrador',
  'Ciudad Ensayo',
  'Inter Boceto',
];

/** A synthetic fact ID for a sample fact segment (never a stored fact). */
function sampleFactId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function template(text: string): StoredSegment {
  return { provenance: 'template_text', text, factId: null };
}

function fact(text: string, index: number): StoredSegment {
  return { provenance: 'fact', text, factId: sampleFactId(index) };
}

function commentary(text: string): StoredSegment {
  return { provenance: 'commentary', text, factId: null };
}

const SAMPLE_COMMENTARY: Readonly<Record<Language, { headline: string; description: string }>> = {
  es: {
    headline: 'Vista previa de la plantilla con datos sintéticos',
    description: 'Texto de ejemplo: el contenido real se redacta a partir de los datos verificados del proyecto.',
  },
  en: {
    headline: 'Template preview with synthetic data',
    description: 'Sample text: real content is drafted from the verified data of the project.',
  },
};

/** The synthetic sample fields of a slide type. */
export function sampleFields(template_: TemplateDefinition, language: Language, config: AppConfig): StoredTextField[] {
  const text = templateText(language);
  const sample = SAMPLE_COMMENTARY[language];
  const ai: StoredTextField[] = [
    { field: 'headline', segments: [commentary(sample.headline)] },
    { field: 'description', segments: [commentary(sample.description)] },
  ];
  switch (template_.slideType) {
    case 'cover':
      return [
        {
          field: 'title',
          segments: [
            template('Liga de Ejemplo'),
            template(stageDisplay(language === 'es' ? 'Fase regular' : 'Regular season', 5, language)),
            template('2026/27'),
          ],
        },
        { field: 'footer', segments: [template('1/2')] },
        ...ai,
      ];
    case 'match_result':
      return [
        { field: 'title', segments: [template(`${text.resultTitle} · ${text.resultRelation.homeWin}`)] },
        { field: 'team_home', segments: [fact(SAMPLE_TEAMS[0] ?? '', 1)] },
        { field: 'team_away', segments: [fact(SAMPLE_TEAMS[1] ?? '', 2)] },
        { field: 'score', segments: [fact(formatScore({ home: 2, away: 1 }), 3)] },
        {
          field: 'kickoff',
          segments: [fact(formatDate(SAMPLE_KICKOFF, language, config.display.utcOffsetMinutes), 4)],
        },
        ...ai,
      ];
    case 'standings': {
      const segments: StoredSegment[] = [];
      SAMPLE_TEAMS.forEach((team, index) => {
        const played = 10;
        const won = Math.max(0, 8 - index);
        const drawn = index % 3;
        const lost = played - won - drawn;
        const goalsFor = 20 - index;
        const goalsAgainst = 6 + index;
        const cells = [
          index + 1,
          played,
          won,
          drawn,
          Math.max(0, lost),
          goalsFor,
          goalsAgainst,
          goalsFor - goalsAgainst,
        ];
        cells.push(won * 3 + drawn);
        if (index > 0) {
          segments.push(template('\n'));
        }
        segments.push(fact(cells.map(String).join(' '), 100 + index * 2));
        segments.push(fact(team, 101 + index * 2));
      });
      return [{ field: 'title', segments: [template(text.standingsTitle)] }, { field: 'standings', segments }, ...ai];
    }
    case 'closing':
      return [{ field: 'title', segments: [template(`${text.closingFollow} ${config.brand.handle}`)] }, ...ai];
    case 'round_overview': {
      const segments: StoredSegment[] = [];
      for (let index = 0; index + 1 < SAMPLE_TEAMS.length && index < 8; index += 2) {
        if (index > 0) {
          segments.push(template('\n'));
        }
        segments.push(fact(SAMPLE_TEAMS[index] ?? '', 200 + index));
        segments.push(template(` ${text.versus} `));
        segments.push(fact(SAMPLE_TEAMS[index + 1] ?? '', 201 + index));
        segments.push(template(' · '));
        segments.push(fact(formatDate(SAMPLE_KICKOFF, language, config.display.utcOffsetMinutes), 4));
      }
      return [
        {
          field: 'title',
          segments: [
            template(
              `${text.calendarTitle} · ${stageDisplay(language === 'es' ? 'Fase regular' : 'Regular season', 5, language)}`,
            ),
          ],
        },
        { field: 'fixtures', segments },
        ...ai,
      ];
    }
    case 'fixture':
    case 'match_preview':
      return [
        {
          field: 'title',
          segments: [
            template(
              template_.slideType === 'fixture'
                ? text.fixtureTitle
                : `${text.previewTitle} · ${stageDisplay(language === 'es' ? 'Fase regular' : 'Regular season', 5, language)}`,
            ),
          ],
        },
        { field: 'match_status', segments: [fact(text.matchStatus.scheduled, 5)] },
        { field: 'team_home', segments: [fact(SAMPLE_TEAMS[0] ?? '', 1)] },
        { field: 'team_away', segments: [fact(SAMPLE_TEAMS[1] ?? '', 2)] },
        {
          field: 'kickoff',
          segments: [fact(formatDate(SAMPLE_KICKOFF, language, config.display.utcOffsetMinutes), 4)],
        },
        ...(template_.slideType === 'match_preview'
          ? [{ field: 'footer' as const, segments: [template('Liga de Ejemplo · 2026/27')] }]
          : []),
        ...ai,
      ];
  }
}

/** The synthetic sample content of a template. */
export function sampleContent(template_: TemplateDefinition, language: Language, config: AppConfig): SlideContent {
  return {
    slideType: template_.slideType,
    language,
    demonstration: true,
    text: { version: 1, fields: sampleFields(template_, language, config) },
    standingsAsOf: SAMPLE_AS_OF,
  };
}

export interface TemplatePreviewDeps {
  readonly registry: TemplateRegistry;
  readonly config: AppConfig;
  readonly fonts: () => FontSet;
  readonly assets: BrandAssetLookup;
  readonly maxEntries?: number;
}

/** Renders and caches template previews. */
export class TemplatePreviewService {
  readonly #deps: TemplatePreviewDeps;
  readonly #cache = new Map<string, Promise<Buffer>>();
  readonly #maxEntries: number;
  #renders = 0;

  constructor(deps: TemplatePreviewDeps) {
    this.#deps = deps;
    this.#maxEntries = deps.maxEntries ?? PREVIEW_CACHE_ENTRIES;
  }

  /** Number of previews rendered (cache misses) since creation; for tests of the bounded work. */
  get renderCount(): number {
    return this.#renders;
  }

  /** The current template of an ID, or undefined. */
  template(templateId: string): TemplateDefinition | undefined {
    return this.#deps.registry.byId(templateId);
  }

  /** The cache key: template version, language and the active asset of each slot (T10-F04). */
  cacheKey(template_: TemplateDefinition, language: Language): string {
    const slots = IMAGE_SLOTS.map((slot) => {
      const asset = this.#deps.assets.activeAssets(slot).at(-1);
      return `${slot}=${asset === undefined ? '-' : `${asset.id}:${asset.sha256}`}`;
    });
    return [`${template_.id}@${template_.version}`, language, ...slots].join('|');
  }

  /** The PNG preview of a template in a language. */
  async preview(template_: TemplateDefinition, language: Language): Promise<Buffer> {
    const key = this.cacheKey(template_, language);
    const cached = this.#cache.get(key);
    if (cached !== undefined) {
      // Most recently used last.
      this.#cache.delete(key);
      this.#cache.set(key, cached);
      return cached;
    }
    const pending = this.#render(template_, language);
    this.#cache.set(key, pending);
    pending.catch(() => this.#cache.delete(key));
    while (this.#cache.size > this.#maxEntries) {
      const oldest = this.#cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.#cache.delete(oldest);
    }
    return pending;
  }

  async #render(template_: TemplateDefinition, language: Language): Promise<Buffer> {
    this.#renders += 1;
    const assets: SlotAsset[] = [];
    for (const slot of IMAGE_SLOTS) {
      const asset = this.#deps.assets.activeAssets(slot).at(-1);
      if (asset !== undefined && template_.imageSlots.includes(slot)) {
        const file = await this.#deps.assets.readFile(asset.id);
        assets.push({ slot, id: asset.id, sha256: asset.sha256, mime: asset.mime, content: file.content });
      }
    }
    // The preview uses this exact template version, even when it is the current one anyway.
    const registry = { current: () => template_, currentWithoutBadges: () => template_ } as unknown as TemplateRegistry;
    const render = await renderContent(
      sampleContent(template_, language, this.#deps.config),
      { registry, fonts: this.#deps.fonts(), settings: renderSettings(this.#deps.config), assets },
      '/preview',
    );
    return render.png;
  }
}
