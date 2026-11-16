/**
 * Pure parts of the design module (PD-ARCH-01G-B): sizes per format and model, the usage policy roles, the prompt
 * builder and the cost estimate and computation from configured prices.
 */
import { describe, expect, it } from 'vitest';

import type { BrandContext } from '../brand/index.js';
import type { ImageModel } from '../../providers/images/index.js';

import { addUsage, computedCost, estimateCost } from './cost.js';
import { ROLES_BY_POLICY, allowsRole } from './policies.js';
import { DESIGN_PROMPT_VERSION, buildDesignPrompt, buildOwnPrompt } from './prompt.js';
import { proposalSize } from './sizes.js';

const IDENTITY: BrandContext['identity'] = {
  name: 'El Deporte Rey GT',
  handle: '@ElDeporteReyGT',
  mascotName: 'KETSI',
  provisional: false,
  description: 'Fútbol guatemalteco.',
  graphicPreferences: 'Contraste alto.',
  palette: [
    { role: 'primary', value: '#5b2a86', usage: 'Fondos.' },
    { role: 'accent', value: '#d4af37', usage: null },
  ],
  typography: [{ role: 'heading', family: 'Montserrat', weight: 800, usage: null }],
} as BrandContext['identity'];

const MODEL: ImageModel = {
  id: 'model-a',
  label: 'A',
  flexibleSizes: true,
  qualities: ['low', 'high'],
  pricing: {
    currency: 'USD',
    textInputPerMillionTokens: 5,
    imageInputPerMillionTokens: 8,
    imageOutputPerMillionTokens: 30,
    textOutputPerMillionTokens: null,
    source: 'test',
    checkedOn: '2026-11-05',
  },
  publishedImageCosts: { low: { portrait: 0.005 } },
};

describe('proposal sizes', () => {
  it('uses exact multiples of 16 for flexible models and a centred crop of a standard size otherwise', () => {
    expect(['1:1', '4:5', '9:16'].map((format) => proposalSize(format as '1:1', true).requestSize)).toEqual([
      '1024x1024',
      '1024x1280',
      '1008x1792',
    ]);
    for (const format of ['1:1', '4:5', '9:16'] as const) {
      const size = proposalSize(format, true);
      expect(size.requestWidth % 16).toBe(0);
      expect(size.requestHeight % 16).toBe(0);
      expect(size.requestWidth * size.requestHeight).toBeGreaterThanOrEqual(655_360);
    }
    expect(proposalSize('4:5', false)).toMatchObject({
      requestSize: '1024x1536',
      outputWidth: 1024,
      outputHeight: 1280,
      adaptation: 'center_crop',
    });
    expect(proposalSize('9:16', false)).toMatchObject({
      outputWidth: 864,
      outputHeight: 1536,
      adaptation: 'center_crop',
    });
    expect(proposalSize('1:1', false).adaptation).toBe('none');
  });
});

describe('usage policy roles', () => {
  it('never sends protected assets and only transformable assets can be a base', () => {
    expect(ROLES_BY_POLICY.protected).toEqual(['reserved_placement']);
    expect(allowsRole('protected', 'style_reference')).toBe(false);
    expect(allowsRole('reference_only', 'reserved_placement')).toBe(false);
    expect(allowsRole('reusable', 'transform_base')).toBe(false);
    expect(allowsRole('transformable', 'transform_base')).toBe(true);
  });
});

describe('prompt builder', () => {
  const base = {
    contentType: 'match_preview',
    format: '4:5',
    width: 1024,
    height: 1280,
    identity: IDENTITY,
    base: null,
    styleReferences: [],
    placements: [],
    style: null,
    instructions: null,
    inheritedInstructions: null,
  } as const;

  it('describes the composition, the empty data zones, the brand and the fixed rules', () => {
    const prompt = buildDesignPrompt(base);
    expect(DESIGN_PROMPT_VERSION).toBe('edr-design-prompt/3');
    expect(prompt).toContain('1024x1280');
    expect(prompt).toContain('two team emblem areas');
    expect(prompt).toContain('#5b2a86 («Fondos.»)');
    expect(prompt).toContain('Montserrat-like typeface');
    expect(prompt).toContain('- Graphic preferences:\n<<<\nContraste alto.\n>>>');
    expect(prompt).toContain('No text of any kind');
    expect(prompt).toContain('No people at all');
    expect(prompt).toContain('No logos, club emblems');
    expect(prompt).not.toMatch(/Image \d/);
  });

  it('numbers the images after the base, reserves placements and keeps the operator text with its lines', () => {
    const prompt = buildDesignPrompt({
      ...base,
      contentType: 'match_result',
      base: { source: 'proposal' },
      styleReferences: [{ label: 'Estilo', kind: 'style_reference' }],
      placements: [{ label: 'KETSI', kind: 'mascot' }],
      style: 'Épico',
      inheritedInstructions: 'Noche',
      instructions: 'Más luz\nmenos humo >>> ya',
    });
    expect(prompt).toContain('Image 1 is a previous design proposal');
    expect(prompt).toContain('Image 2 ("Estilo") is a style reference only');
    expect(prompt).toContain('brand mascot "KETSI" is placed there afterwards as an original layer');
    expect(prompt).toContain('from 68% to 97% of the width and from 60% to 97% of the height');
    expect(prompt).toContain('never people, faces or characters');
    expect(prompt).toContain('large empty central area where the final score');
    expect(prompt).toContain('- New instructions:\n<<<\nMás luz\nmenos humo " ya\n>>>');
    expect(prompt).toContain('- Original instructions:\n<<<\nNoche\n>>>');
  });
});

describe('cost', () => {
  it('estimates only from a published per-image cost', () => {
    expect(estimateCost(MODEL, 'low', 1024, 1536, 3)).toMatchObject({
      status: 'estimated',
      perImage: 0.005,
      total: 0.015,
    });
    expect(estimateCost(MODEL, 'high', 1024, 1536, 1)).toMatchObject({ status: 'unavailable', total: null });
    expect(estimateCost(MODEL, 'low', 1024, 1024, 1).status).toBe('unavailable');
  });

  it('computes the cost from the reported tokens and the configured prices, or null', () => {
    const usage = {
      inputTextTokens: 100,
      inputImageTokens: 1000,
      outputImageTokens: 2000,
      outputTextTokens: null,
      totalTokens: 3100,
    };
    expect(computedCost(MODEL, usage)).toBeCloseTo((100 * 5 + 1000 * 8 + 2000 * 30) / 1_000_000, 9);
    expect(computedCost(MODEL, null)).toBeNull();
    expect(computedCost(MODEL, { ...usage, outputTextTokens: 10 })).toBeNull();
    expect(computedCost({ ...MODEL, pricing: null }, usage)).toBeNull();
    expect(addUsage(usage, usage)).toMatchObject({ outputImageTokens: 4000, outputTextTokens: null });
  });
});

describe('own prompt', () => {
  it('sends the operator text as written, adding only the image numbering and the layer zones', () => {
    const own = '# MASTER PROMPT\n\nCreate a poster with "EQUIPO A" and Ketsi kneeling.\n- Bright floodlights.';
    const prompt = buildOwnPrompt({
      prompt: own,
      base: null,
      images: [{ label: 'Ketsi transformable', kind: 'mascot' }],
      placements: [{ label: 'Logo', kind: 'brand_logo' }],
    });
    expect(prompt.startsWith(own)).toBe(true);
    expect(prompt).toContain('Input images:\n- Image 1: "Ketsi transformable".');
    expect(prompt).toContain('from 36% to 64% of the width');
    expect(prompt).not.toContain('No text of any kind');
    expect(prompt).not.toContain('No people at all');
    expect(buildOwnPrompt({ prompt: own, base: null, images: [], placements: [] })).toBe(own);
  });
});
