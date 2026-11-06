/**
 * Brand identity (PD-ARCH-01G-A): one view of the identity the studio uses.
 *
 * - The name, handle, mascot name, palette and fonts are the renderer's configuration (`config/brand.json`, the
 *   bundled fonts): the single source of those values, read only here, so no colour or font is stored twice and no
 *   slide, template or QA check changes because of this page (the style check validates against the same palette).
 * - The operator edits only descriptive fields: the description, the graphic preferences and a usage note per colour
 *   and font role (`brand_identity`, one row `primary`).
 */
import type { BrandColorRole, BrandFontRole, BrandIdentity } from '@edr/contracts';

import type { Clock } from '../../container.js';
import type { BrandConfig } from '../../platform/config/index.js';

import type { BrandAssetRepository, StoredIdentity } from './repository.js';

export const COLOR_ROLES: readonly BrandColorRole[] = ['primary', 'primaryDark', 'accent', 'secondary', 'light'];
export const FONT_ROLES: readonly BrandFontRole[] = ['heading', 'body', 'numeric'];

/** An identity update after body validation (absent fields keep their value; null clears). */
export interface UpdateBrandIdentity {
  readonly description?: string | null | undefined;
  readonly graphicPreferences?: string | null | undefined;
  readonly colorUsage?: Partial<Record<BrandColorRole, string | null | undefined>> | undefined;
  readonly typographyUsage?: Partial<Record<BrandFontRole, string | null | undefined>> | undefined;
}

function merged<T extends string>(
  current: Partial<Record<T, string>>,
  patch: Partial<Record<T, string | null | undefined>> | undefined,
): Partial<Record<T, string>> {
  const next: Partial<Record<T, string>> = { ...current };
  for (const [role, value] of Object.entries(patch ?? {}) as [T, string | null | undefined][]) {
    if (value === null) {
      delete next[role];
    } else if (value !== undefined) {
      next[role] = value;
    }
  }
  return next;
}

export class BrandIdentityService {
  readonly #repository: BrandAssetRepository;
  readonly #brand: BrandConfig;
  readonly #clock: Clock;

  constructor(deps: { repository: BrandAssetRepository; brand: BrandConfig; clock: Clock }) {
    this.#repository = deps.repository;
    this.#brand = deps.brand;
    this.#clock = deps.clock;
  }

  /** The identity: configuration values with the stored descriptive fields. */
  get(): BrandIdentity {
    return this.#view(this.#repository.identity());
  }

  /** Edits the descriptive fields; the configuration values are never written. */
  update(patch: UpdateBrandIdentity): BrandIdentity {
    return this.#repository.transaction(() => {
      const current = this.#repository.identity();
      const next = {
        description: patch.description === undefined ? current.description : patch.description,
        graphicPreferences:
          patch.graphicPreferences === undefined ? current.graphicPreferences : patch.graphicPreferences,
        colorUsage: merged(current.colorUsage, patch.colorUsage),
        typographyUsage: merged(current.typographyUsage, patch.typographyUsage),
        updatedAt: this.#clock.now().toISOString(),
      };
      this.#repository.updateIdentity(next);
      return this.#view(next);
    });
  }

  #view(stored: StoredIdentity): BrandIdentity {
    const brand = this.#brand;
    return {
      id: 'primary',
      name: brand.name,
      handle: brand.handle,
      mascotName: brand.mascotName,
      provisional: brand.provisional,
      description: stored.description,
      graphicPreferences: stored.graphicPreferences,
      palette: COLOR_ROLES.map((role) => ({
        role,
        value: brand.palette[role].toLowerCase(),
        usage: stored.colorUsage[role] ?? null,
      })),
      typography: FONT_ROLES.map((role) => ({
        role,
        family: brand.fonts[role].family,
        weight: brand.fonts[role].weight,
        usage: stored.typographyUsage[role] ?? null,
      })),
      updatedAt: stored.updatedAt,
    };
  }
}
