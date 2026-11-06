/**
 * Client rules of the brand library (PD-ARCH-01G-A). They mirror the server's rules so the operator sees a problem
 * before sending; the server checks everything again (real file type, header, dimensions, decoding, duplicates).
 */
import type { BrandAsset, BrandAssetKind, BrandAssetUsagePolicy } from '@edr/contracts';
import { contractRegExp } from '@edr/contracts';

import { ASSET_ACCEPT, MAX_ASSET_BYTES, REFERENCE_ACCEPT } from './brandApi';
import { uploadCopy } from './copy';

export const ASSET_KINDS: readonly BrandAssetKind[] = [
  'brand_logo',
  'mascot',
  'decoration',
  'background',
  'style_reference',
];

export const USAGE_POLICIES: readonly BrandAssetUsagePolicy[] = [
  'protected',
  'reference_only',
  'reusable',
  'transformable',
];

/** The largest width and height the server accepts. */
export const MAX_DIMENSION = 4096;

/** The policy proposed for a new asset of a category; `transformable` is never proposed. */
export function defaultPolicy(kind: BrandAssetKind): BrandAssetUsagePolicy {
  switch (kind) {
    case 'brand_logo':
    case 'mascot':
      return 'protected';
    case 'style_reference':
      return 'reference_only';
    case 'decoration':
    case 'background':
      return 'reusable';
  }
}

/** The policies a category allows: a style reference is always `reference_only`. */
export function allowedPolicies(kind: BrandAssetKind): readonly BrandAssetUsagePolicy[] {
  return kind === 'style_reference' ? ['reference_only'] : USAGE_POLICIES;
}

/** Whether a category has variants (logos and mascot) and mascot details (pose, expression). */
export function hasVariant(kind: BrandAssetKind): boolean {
  return kind === 'brand_logo' || kind === 'mascot';
}

/** Whether an asset can be the primary one the renderer draws. */
export function canBePrimary(asset: BrandAsset): boolean {
  return (
    hasVariant(asset.kind) && asset.active && asset.usagePolicy !== 'reference_only' && asset.mime !== 'image/webp'
  );
}

/** The file picker filter of a category. */
export function acceptFor(kind: BrandAssetKind): string {
  return kind === 'style_reference' ? REFERENCE_ACCEPT : ASSET_ACCEPT;
}

const LABEL = contractRegExp('Label');
const NOTE = contractRegExp('Note');

/** The editable metadata of an asset, as typed in a form. */
export interface MetadataDraft {
  readonly kind: BrandAssetKind;
  readonly label: string;
  readonly description: string;
  readonly variant: string;
  readonly pose: string;
  readonly expression: string;
}

export interface UploadDraft extends MetadataDraft {
  readonly file: File | null;
  /** Read from the image in the browser; null until known. */
  readonly dimensions: { readonly width: number; readonly height: number } | null;
}

export type UploadErrors = Partial<
  Record<'file' | 'label' | 'description' | 'variant' | 'pose' | 'expression', string>
>;

function labelError(value: string, required: boolean): string | undefined {
  const text = value.trim();
  if (text === '') {
    return required ? uploadCopy.nameRequired : undefined;
  }
  if ([...text].length > 80) {
    return required ? uploadCopy.nameTooLong : uploadCopy.fieldTooLong;
  }
  return LABEL.test(text) ? undefined : uploadCopy.textInvalid;
}

/** The client checks of an upload; empty when it can be sent. */
export function checkUpload(draft: UploadDraft): UploadErrors {
  const errors: UploadErrors = {};
  const { file } = draft;
  const allowed =
    draft.kind === 'style_reference' ? ['image/png', 'image/jpeg', 'image/webp'] : ['image/png', 'image/jpeg'];
  if (file === null) {
    errors.file = uploadCopy.fileRequired;
  } else if (!allowed.includes(file.type)) {
    errors.file = uploadCopy.fileType;
  } else if (file.size === 0) {
    errors.file = uploadCopy.fileEmpty;
  } else if (file.size > MAX_ASSET_BYTES) {
    errors.file = uploadCopy.fileTooLarge;
  } else if (
    draft.dimensions !== null &&
    (draft.dimensions.width > MAX_DIMENSION || draft.dimensions.height > MAX_DIMENSION)
  ) {
    errors.file = uploadCopy.fileDimensions;
  }
  return { ...errors, ...checkMetadata(draft) };
}

/** The client checks of the editable metadata; empty when it can be sent. */
export function checkMetadata(draft: MetadataDraft): UploadErrors {
  const errors: UploadErrors = {};
  const label = labelError(draft.label, true);
  if (label !== undefined) errors.label = label;
  const description = draft.description.trim();
  if (description !== '' && [...description].length > 500) {
    errors.description = uploadCopy.descriptionTooLong;
  } else if (description !== '' && !NOTE.test(description)) {
    errors.description = uploadCopy.textInvalid;
  }
  if (hasVariant(draft.kind)) {
    const variant = labelError(draft.variant, false);
    if (variant !== undefined) errors.variant = variant;
  }
  if (draft.kind === 'mascot') {
    const pose = labelError(draft.pose, false);
    if (pose !== undefined) errors.pose = pose;
    const expression = labelError(draft.expression, false);
    if (expression !== undefined) errors.expression = expression;
  }
  return errors;
}

/** A trimmed optional text, or undefined when empty. */
export function optionalText(value: string): string | undefined {
  const text = value.trim();
  return text === '' ? undefined : text;
}

/** A trimmed text, or null when empty (clears the field on the server). */
export function nullableText(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text;
}

/** Assets matching a name search (accent- and case-insensitive) and a category. */
export function filterAssets(assets: readonly BrandAsset[], search: string, kind: BrandAssetKind | ''): BrandAsset[] {
  const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const query = fold(search.trim());
  return assets.filter(
    (asset) =>
      (kind === '' || asset.kind === kind) &&
      (query === '' || fold(asset.label).includes(query) || fold(asset.variant ?? '').includes(query)),
  );
}
