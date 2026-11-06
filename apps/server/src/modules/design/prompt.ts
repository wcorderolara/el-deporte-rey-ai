/**
 * Prompt builder of the AI design proposals (PD-ARCH-01G-B section 12), versioned as `DESIGN_PROMPT_VERSION`.
 *
 * The prompt asks for a visual composition only. It combines the content type with the zones the local engine fills
 * later (team names, team emblems, date and time, score, competition, branding), the format, the brand identity (name,
 * description, palette with its usage, the character of the fonts, graphic preferences), the selected references in
 * image order with their role, the zones reserved for protected assets, and the operator's own style and
 * instructions, quoted as design wishes.
 *
 * Fixed rules: no text, letters, numbers or score in the bitmap (generated text is not reliable and the data are
 * inserted later); no people, faces, presenters or characters of any kind (version 2: a creator-style name or a
 * reference photo with people made the model add hosts nobody asked for); no club emblem, sponsor or kit; style
 * references and style names inform colour, light, texture and energy only. Each reserved brand asset gets an exact
 * empty zone (`layers.ts`) where the original is drawn locally after generation. The builder adds no sports data and no
 * secret; the operator's text is the only free text and it is validated as printable.
 */
import type { BrandContext } from '../brand/index.js';
import type { BrandAssetKind, DesignContentType, DesignFormat } from '@edr/contracts';

import { layerGroup, zoneText } from './layers.js';

export const DESIGN_PROMPT_VERSION = 'edr-design-prompt/3';

/** Version label of the own-prompt mode (the operator's text plus the image numbering and layer zones). */
export const OWN_PROMPT_VERSION = 'edr-own-prompt/3';

/** The zones each content type leaves empty, and what the design is for. */
const CONTENT: Readonly<Record<DesignContentType, { subject: string; zones: readonly string[] }>> = {
  match_preview: {
    subject: 'a preview poster for one upcoming football match between two teams, with a face-off composition',
    zones: [
      'two balanced areas, left and right, for the two team names',
      'two team emblem areas next to them, empty (round or shield-shaped empty frames are fine)',
      'a central area for the date and kick-off time',
      'a smaller area for the competition name',
    ],
  },
  round_overview: {
    subject: 'a matchday calendar that lists several matches of one round',
    zones: [
      'a header area for the round title',
      'a list area with 4 to 8 evenly spaced rows, each with two empty emblem spots and space for two team names',
      'space for a date or time on each row',
    ],
  },
  fixture: {
    subject: 'an upcoming matches graphic that announces the next fixtures',
    zones: [
      'a header area for the title',
      'a list area with 3 to 6 evenly spaced match rows, each with two empty emblem spots and space for two team names',
      'space for the date and kick-off time on each row',
    ],
  },
  match_result: {
    subject: 'a final result graphic for one football match between two teams',
    zones: [
      'two balanced areas for the two team names',
      'two empty team emblem areas',
      'a large empty central area where the final score will be placed',
      'a smaller area for the competition name',
    ],
  },
};

const FORMAT_TEXT: Readonly<Record<DesignFormat, string>> = {
  '1:1': 'square 1:1 social media post',
  '4:5': 'vertical 4:5 social media post (Instagram feed)',
  '9:16': 'vertical 9:16 story or reel cover',
};

const FONT_ROLE: Readonly<Record<string, string>> = {
  heading: 'headlines',
  body: 'body text',
  numeric: 'numbers',
};

export interface PromptReference {
  readonly label: string;
  readonly kind: BrandAssetKind;
}

export interface DesignPromptInput {
  readonly contentType: DesignContentType;
  readonly format: DesignFormat;
  readonly width: number;
  readonly height: number;
  readonly identity: BrandContext['identity'];
  /** Image 1 when present: the previous proposal of a variant, or a transformable brand asset. */
  readonly base: { readonly source: 'proposal' } | { readonly source: 'asset'; readonly asset: PromptReference } | null;
  /** The style references, sent after the base in this order. */
  readonly styleReferences: readonly PromptReference[];
  /** Assets placed later by the local engine; never sent. */
  readonly placements: readonly PromptReference[];
  readonly style: string | null;
  readonly instructions: string | null;
  /** The instructions of the proposal a variant starts from. */
  readonly inheritedInstructions: string | null;
}

/** Operator text on one line, inside guillemets (it is already validated as printable text). */
function quoted(text: string): string {
  return `«${text
    .replace(/\s*\n+\s*/g, ' / ')
    .replace(/[«»]/g, '"')
    .trim()}»`;
}

/** Operator text kept with its line breaks, between fixed delimiters (any delimiter inside it is neutralized). */
function block(text: string): string {
  return `<<<\n${text.replace(/<<<|>>>/g, '"').trim()}\n>>>`;
}

function placementZone(reference: PromptReference): string {
  const what =
    reference.kind === 'brand_logo'
      ? `the official logo "${reference.label}"`
      : reference.kind === 'mascot'
        ? `the brand mascot "${reference.label}"`
        : `the brand graphic "${reference.label}"`;
  return (
    `keep the area ${zoneText(layerGroup(reference.kind))} calm, plain and completely empty: ${what} is placed ` +
    'there afterwards as an original layer'
  );
}

/** Builds the effective prompt sent to the provider. */
export function buildDesignPrompt(input: DesignPromptInput): string {
  const content = CONTENT[input.contentType];
  const { identity } = input;
  const lines: string[] = [];

  lines.push(
    `Design the visual background composition of ${content.subject}, as a ${FORMAT_TEXT[input.format]} of ` +
      `${String(input.width)}x${String(input.height)} pixels, for the sports media brand "${identity.name}".`,
  );
  lines.push(
    'This is a reusable design proposal: the real data and the official brand assets are added later by another ' +
      'tool, so the image must contain the design only.',
  );

  lines.push('', 'Leave these zones empty but visually integrated (subtle panels, light, shapes or frames):');
  content.zones.forEach((zone) => lines.push(`- ${zone}`));
  input.placements.forEach((reference) => lines.push(`- ${placementZone(reference)}`));
  if (!input.placements.some((reference) => reference.kind === 'brand_logo')) {
    lines.push('- a small clean branding zone near the top or bottom edge');
  }

  lines.push('', 'Brand identity:');
  if (identity.description !== null) {
    lines.push(`- Brand description: ${quoted(identity.description)}`);
  }
  lines.push(
    `- Colour palette: ${identity.palette
      .map((color) => `${color.value}${color.usage === null ? '' : ` (${quoted(color.usage)})`}`)
      .join(', ')}.`,
  );
  lines.push(
    `- Typography character, for the style only: ${identity.typography
      .map(
        (font) =>
          `${FONT_ROLE[font.role] ?? font.role} in a ${font.family}-like typeface, weight ${String(font.weight)}`,
      )
      .join('; ')}.`,
  );
  if (identity.graphicPreferences !== null) {
    lines.push(`- Graphic preferences:\n${block(identity.graphicPreferences)}`);
  }

  const images: string[] = [];
  if (input.base !== null) {
    images.push(
      input.base.source === 'proposal'
        ? 'Image 1 is a previous design proposal: create a variant of it that follows the new instructions and keeps ' +
            'what they do not ask to change.'
        : `Image 1 is the authorized brand graphic "${input.base.asset.label}", which may be transformed: use it as ` +
            'the starting point of the composition.',
    );
  }
  input.styleReferences.forEach((reference, index) => {
    const number = index + 1 + (input.base === null ? 0 : 1);
    images.push(
      `Image ${String(number)} ("${reference.label}") is a style reference only: take only its colours, lighting, ` +
        'textures, shapes and layout energy. Never reproduce any person, face, character, mascot, logo, emblem or text ' +
        'that appears in it.',
    );
  });
  if (images.length > 0) {
    lines.push('', 'Input images:');
    images.forEach((text) => lines.push(`- ${text}`));
  }

  if (input.style !== null || input.instructions !== null || input.inheritedInstructions !== null) {
    lines.push(
      '',
      'Operator wishes (design direction only, never text to write in the image; a style name means colour, contrast, ' +
        'lighting, shapes and energy, never people, faces or characters):',
    );
    if (input.style !== null) {
      lines.push(`- Style: ${quoted(input.style)}`);
    }
    if (input.inheritedInstructions !== null) {
      lines.push(`- Original instructions:\n${block(input.inheritedInstructions)}`);
    }
    if (input.instructions !== null) {
      lines.push(
        `- ${input.inheritedInstructions === null ? 'Instructions' : 'New instructions'}:\n${block(input.instructions)}`,
      );
    }
  }

  lines.push(
    '',
    'Rules:',
    '- No text of any kind: no letters, words, numbers, dates, scores, team names, watermarks or signatures.',
    '- No people at all: no faces, presenters, hosts, players, fans, silhouettes or characters.',
    '- No logos, club emblems, competition marks, sponsor marks or identifiable kits.',
    '- Do not draw a logo, mascot or character inside the reserved zones.',
    '- Keep important elements inside safe margins of about 8% from every edge.',
    '- High-quality, polished sports design with strong contrast so that text placed later stays readable.',
  );
  return lines.join('\n');
}

export interface OwnPromptInput {
  /** The operator's prompt, sent as written. */
  readonly prompt: string;
  /** Image 1 when present: the previous proposal of a variant, or a transformable brand asset. */
  readonly base: DesignPromptInput['base'];
  /** The other images sent, in order after the base. */
  readonly images: readonly PromptReference[];
  /** Originals drawn locally after generation; never sent. */
  readonly placements: readonly PromptReference[];
}

/**
 * The `own_prompt` mode: the operator's prompt exactly as written, followed only by what the model cannot know
 * otherwise: which input image is which, and the zones where the original brand layers are drawn afterwards. No rule
 * of the guided mode is added. Whether such an image may become a template base (when its data zones are empty) is
 * decided in PD-ARCH-01G-C.
 */
export function buildOwnPrompt(input: OwnPromptInput): string {
  const sections = [input.prompt.trim()];
  const images: string[] = [];
  if (input.base !== null) {
    images.push(
      input.base.source === 'proposal'
        ? 'Image 1: the previous version of this design. Edit it: apply every change the prompt above asks for and keep everything else as it is; do not return it unchanged.'
        : `Image 1: "${input.base.asset.label}".`,
    );
  }
  input.images.forEach((reference, index) => {
    images.push(`Image ${String(index + 1 + (input.base === null ? 0 : 1))}: "${reference.label}".`);
  });
  if (images.length > 0) {
    sections.push(['Input images:', ...images.map((text) => `- ${text}`)].join('\n'));
  }
  if (input.placements.length > 0) {
    sections.push(
      [
        'Technical note:',
        ...input.placements.map((reference) => `- ${placementZone(reference)}; do not draw it yourself.`),
      ].join('\n'),
    );
  }
  return sections.join('\n\n');
}
