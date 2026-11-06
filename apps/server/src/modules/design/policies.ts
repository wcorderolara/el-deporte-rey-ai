/**
 * Usage policies of brand assets applied to AI design generation (PD-ARCH-01G-B section 8; the policies of
 * PD-ARCH-01G-A). The server applies these rules; the browser only shows them.
 *
 * - `protected` (official logo, the original mascot): never sent to the provider, because a generative edit could
 *   alter its identity. It can only reserve a clean zone where the local engine places the original later.
 * - `reference_only`: sent only when selected as a style reference; never reproduced or placed.
 * - `reusable`: may reserve its place in the composition, or be sent as a style reference; it is never the base of a
 *   transformation.
 * - `transformable`: may also be the base of a variant; the original file is never modified and the result is a
 *   separate proposal that needs human approval.
 *
 * Only active assets can be selected; an asset appears at most once; at most one image is the base of a generation
 * (a `transform_base` asset or the previous proposal of a variant).
 */
import type { BrandAssetUsagePolicy, DesignReferenceRole } from '@edr/contracts';

export const ROLES_BY_POLICY: Readonly<Record<BrandAssetUsagePolicy, readonly DesignReferenceRole[]>> = Object.freeze({
  protected: Object.freeze(['reserved_placement'] as const),
  reference_only: Object.freeze(['style_reference'] as const),
  reusable: Object.freeze(['style_reference', 'reserved_placement'] as const),
  transformable: Object.freeze(['style_reference', 'transform_base', 'reserved_placement'] as const),
});

/** True when the role sends the asset's image to the provider. */
export function sendsImage(role: DesignReferenceRole): boolean {
  return role !== 'reserved_placement';
}

/** True when a policy allows a role. */
export function allowsRole(policy: BrandAssetUsagePolicy, role: DesignReferenceRole): boolean {
  return ROLES_BY_POLICY[policy].includes(role);
}
