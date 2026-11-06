/**
 * Template previews (T10-F04, OD-41): built-in synthetic sample data, cached by template version, language and the
 * active brand assets, with bounded work per request.
 */
import { createHash } from 'node:crypto';

import type { BrandAsset } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import type { BrandAssetLookup, DrawableBrandAsset } from '../brand/index.js';
import { png } from '../brand/test/images.js';

import { TemplatePreviewService, sampleContent } from './preview.js';
import { pngSize } from './renderer.js';
import { StoredElementTextSchema } from './slide-content.js';
import { BUILT_IN_TEMPLATES, TemplateRegistry } from './templates/registry.js';
import { renderConfig, testFonts, uuid } from './test/support.js';

const config = renderConfig('/srv/edr-test-root');
const fonts = testFonts();

class FakeAssets implements BrandAssetLookup {
  assets: DrawableBrandAsset[] = [];
  readonly files = new Map<string, Buffer>();
  reads = 0;

  add(kind: BrandAsset['kind'], n: number): DrawableBrandAsset {
    const content = png({ width: 24, height: 24, rgba: [n % 255, 120, 40, 255] });
    const asset: DrawableBrandAsset = {
      id: uuid(n),
      kind,
      label: 'Sintético',
      description: null,
      mime: 'image/png',
      width: 24,
      height: 24,
      byteSize: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
      usagePolicy: 'protected',
      official: false,
      primary: false,
      variant: null,
      pose: null,
      expression: null,
      active: true,
      registeredAt: '2026-10-27T12:00:00.000Z',
      updatedAt: '2026-10-27T12:00:00.000Z',
    };
    this.assets.push(asset);
    this.files.set(asset.id, content);
    return asset;
  }

  activeAssets(kind: BrandAsset['kind']): readonly DrawableBrandAsset[] {
    return this.assets.filter((asset) => asset.kind === kind && asset.active);
  }

  async readFile(assetId: string) {
    this.reads += 1;
    const asset = this.assets.find((candidate) => candidate.id === assetId);
    const content = this.files.get(assetId);
    if (asset === undefined || content === undefined) {
      throw new Error('unknown asset');
    }
    return Promise.resolve({ asset, content });
  }
}

function service(assets = new FakeAssets(), maxEntries?: number) {
  return new TemplatePreviewService({
    registry: new TemplateRegistry(),
    config,
    fonts: () => fonts,
    assets,
    ...(maxEntries === undefined ? {} : { maxEntries }),
  });
}

describe('sample content', () => {
  it('is valid stored text for every template, in both languages, labelled as demonstration', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      for (const language of ['es', 'en'] as const) {
        const sample = sampleContent(template, language, config);
        expect(StoredElementTextSchema.parse(sample.text)).toEqual(sample.text);
        expect(sample.demonstration).toBe(true);
      }
    }
  });
});

describe('TemplatePreviewService', () => {
  it('renders each template at the configured size', async () => {
    const previews = service();
    for (const template of new TemplateRegistry().list()) {
      expect(pngSize(await previews.preview(template, 'es'))).toEqual({ width: 1080, height: 1350 });
    }
  });

  it('renders once per template version and language, and shares concurrent requests', async () => {
    const previews = service();
    const template = new TemplateRegistry().current('cover');
    const [first, second] = await Promise.all([previews.preview(template, 'es'), previews.preview(template, 'es')]);
    expect(second).toBe(first);
    await previews.preview(template, 'es');
    expect(previews.renderCount).toBe(1);
    const english = await previews.preview(template, 'en');
    expect(previews.renderCount).toBe(2);
    expect(english.equals(first)).toBe(false);
  });

  it('keys the cache by the active brand assets, so an activated or deactivated asset shows at once', async () => {
    const assets = new FakeAssets();
    const previews = service(assets);
    const template = new TemplateRegistry().current('closing');
    const plain = await previews.preview(template, 'es');
    const mascot = assets.add('mascot', 70);
    const withMascot = await previews.preview(template, 'es');
    expect(withMascot.equals(plain)).toBe(false);
    expect(assets.reads).toBe(1);
    mascot.active = false;
    assets.assets = assets.assets.map((asset) => ({ ...asset }));
    expect((await previews.preview(template, 'es')).equals(plain)).toBe(true);
    expect(previews.renderCount).toBe(2);
  });

  it('keeps at most the configured number of previews', async () => {
    const previews = service(new FakeAssets(), 2);
    const registry = new TemplateRegistry();
    await previews.preview(registry.current('cover'), 'es');
    await previews.preview(registry.current('closing'), 'es');
    await previews.preview(registry.current('match_result'), 'es');
    await previews.preview(registry.current('cover'), 'es');
    expect(previews.renderCount).toBe(4);
  });
});
