/**
 * Display formatting (contracts/provider-ports.md section 5): the single source of fact display text and of the
 * per-language fixed template text, used by content, rendering and visual QA.
 */
export {
  MAX_UTC_OFFSET_MINUTES,
  MIN_UTC_OFFSET_MINUTES,
  assertUtcOffset,
  formatDate,
  formatInt,
  formatScore,
  hashtagFor,
  resultRelation,
  stageDisplay,
  teamDisplayName,
} from './format.js';
export { CONTENT_LANGUAGES, type Language, type TemplateText, isLanguage, templateText } from './text.js';
