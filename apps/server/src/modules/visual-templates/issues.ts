/**
 * Validation issues of visual templates (PD-ARCH-01G-C): the fixed Spanish message of every issue code. No dependency
 * on the renderer, so the composition of project slides can report issues without an import cycle.
 */
import type { VisualTemplateIssue, VisualTemplateIssueCode } from '@edr/contracts';

const MESSAGES: Readonly<Record<VisualTemplateIssueCode, string>> = {
  OUT_OF_CANVAS: 'La capa sale del lienzo.',
  TOO_SMALL: 'La capa es demasiado pequeña.',
  FONT_SIZE_INVALID: 'El tamaño mínimo de letra es mayor que el máximo.',
  OVERLAP: 'La capa se superpone a un texto.',
  PROTECTED_OVERLAP: 'La capa tapa un recurso protegido (logotipo o mascota oficial).',
  BINDING_MISSING: 'El dato deportivo no tiene un campo asociado.',
  BINDING_NOT_ALLOWED: 'El campo no existe para este tipo de contenido.',
  REQUIRED_BINDING_MISSING: 'Falta un dato obligatorio del tipo de contenido.',
  ASSET_MISSING: 'El recurso no existe en Mi marca.',
  ASSET_INACTIVE: 'El recurso está desactivado en Mi marca.',
  ASSET_DELETED: 'El recurso se eliminó de Mi marca.',
  ASSET_NOT_ALLOWED: 'Este recurso no se puede usar en esta capa.',
  TEXT_TOO_LONG: 'El texto no cabe en su caja.',
  TEXT_MAY_NOT_FIT: 'Un valor largo puede no caber en la caja.',
  LOW_CONTRAST: 'El contraste del texto con el fondo es bajo.',
  HIDDEN_LAYER: 'La capa está oculta y no se dibuja.',
  NO_LAYERS: 'La plantilla no tiene capas sobre el fondo.',
  BACKGROUND_UNAVAILABLE: 'El fondo no está disponible.',
  BACKGROUND_SOURCE_DELETED: 'El origen del fondo se eliminó.',
  BACKGROUND_ASPECT: 'El fondo tiene otra proporción y se recorta para cubrir el lienzo.',
  BACKGROUND_REVIEW:
    'El fondo lo generó la IA: revisa que no tenga textos, logos, escudos ni personas que impidan reutilizarlo.',
  BACKGROUND_OWN_PROMPT:
    'El fondo viene de un prompt propio: puede contener textos, personas, logos o una mascota generados por la IA.',
  BACKGROUND_GENERATED_BRAND:
    'Se enviaron imágenes de la marca a la IA: el fondo puede mostrar un logotipo o una Ketsi redibujados. Usa las capas oficiales.',
  VALUE_MISSING: 'Los datos elegidos no tienen este valor.',
  TEXT_OVERFLOW: 'El texto no cabe en su caja con los datos elegidos.',
};

/** An issue with its fixed message, and an optional detail appended. */
export function issueOf(
  code: VisualTemplateIssueCode,
  severity: 'error' | 'warning',
  layerId: string | null,
  detail?: string,
): VisualTemplateIssue {
  const message = detail === undefined ? MESSAGES[code] : `${MESSAGES[code]} ${detail}`;
  return { code, severity, layerId, message: message.slice(0, 300) };
}
