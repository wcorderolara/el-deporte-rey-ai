/**
 * Spanish copy of the brand and templates page (PD-06: Spanish by default). Shared error text comes from the copy
 * tables of `src/ui`; this module holds only the feature's own strings and the labels of the brand contract values.
 *
 * Wording rules (PD-03, OD-27, R-049, R-050, R-231): only authorized El Deporte Rey GT assets are registered; there is
 * no option for club badges or competition marks; badge slots stay empty. OD-07: no substitute logo or mascot is
 * suggested. OD-13: templates are versioned code and are not edited here.
 */
import type { BrandAssetKind, Language, SlideType } from '@edr/contracts';

/** BrandAssetKind: the only kinds that can be registered (no badge or competition-mark kind exists). */
export const assetKindLabel: Record<BrandAssetKind, string> = {
  brand_logo: 'Logotipo de la marca',
  mascot: 'Mascota',
  decoration: 'Decoración',
};

export const assetKindDescription: Record<BrandAssetKind, string> = {
  brand_logo: 'Logotipo propio de El Deporte Rey GT.',
  mascot: 'Imagen de la mascota de la marca.',
  decoration: 'Elemento gráfico decorativo de la marca.',
};

/** Template.slideType. */
export const slideTypeLabel: Record<SlideType, string> = {
  cover: 'Portada',
  match_result: 'Resultado de partido',
  standings: 'Clasificación',
  closing: 'Cierre',
  round_overview: 'Resumen de jornada',
  fixture: 'Partido programado',
  match_preview: 'Previa de partido',
};

/** Language of a template preview (PD-06). */
export const languageLabel: Record<Language, string> = {
  es: 'Español',
  en: 'Inglés',
};

export const brandCopy = {
  title: 'Marca y plantillas',
  intro:
    'Registre aquí los recursos autorizados de la marca. Un recurso activo queda disponible para las plantillas de todos los proyectos que se generen después.',
  authorizedOnly:
    'Solo se registran recursos autorizados de El Deporte Rey GT. No se registran escudos de clubes, marcas de competiciones ni imágenes sin autorización: los nombres de equipos y competiciones aparecen como texto.',
  provisional:
    'Mientras no haya recursos registrados, las plantillas usan los valores provisionales de la marca y generan diapositivas completas sin logotipo ni mascota.',
  statusRegion: 'Avisos de la página de marca',
} as const;

export const registerCopy = {
  heading: 'Registrar un recurso de marca',
  kindLegend: 'Tipo de recurso',
  labelField: 'Etiqueta',
  labelHint: 'Nombre descriptivo del recurso, hasta 80 caracteres.',
  fileField: 'Archivo de imagen',
  fileHint: 'Solo PNG o JPEG, hasta 5 MiB y 4096 × 4096 píxeles. El servidor comprueba el tipo real del archivo.',
  submit: 'Registrar recurso',
  submitting: 'Registrando…',
  errorPrefix: 'Error:',
  kindRequired: 'Elija el tipo de recurso.',
  labelRequired: 'Escriba una etiqueta.',
  labelTooLong: 'La etiqueta admite como máximo 80 caracteres.',
  labelInvalid: 'La etiqueta contiene caracteres no permitidos (caracteres de control o de formato).',
  fileRequired: 'Seleccione un archivo PNG o JPEG.',
  fileType: 'Solo se aceptan archivos PNG o JPEG.',
  fileEmpty: 'El archivo está vacío.',
  fileTooLarge: 'El archivo supera el tamaño máximo de 5 MiB.',
  failedTitle: 'No se pudo registrar el recurso',
  registered: (label: string): string => `Recurso «${label}» registrado.`,
} as const;

export const assetsCopy = {
  heading: 'Recursos registrados',
  loading: 'Cargando los recursos de marca…',
  loadFailedTitle: 'No se pudieron cargar los recursos de marca',
  empty: 'No hay recursos de marca registrados.',
  reuse:
    'Los recursos no se borran. Desactivar un recurso lo excluye de las diapositivas que se generen después; las ya generadas no cambian.',
  previewAlt: (label: string): string => `Vista previa del recurso «${label}»`,
  previewFailed: 'No se pudo mostrar la vista previa de la imagen.',
  kind: 'Tipo',
  format: 'Formato',
  dimensions: 'Dimensiones',
  dimensionsValue: (width: number, height: number): string => `${width} × ${height} px`,
  registeredAt: 'Registrado',
  state: 'Estado',
  active: 'Activo',
  inactive: 'Inactivo',
  activate: 'Activar',
  deactivate: 'Desactivar',
  saving: 'Guardando…',
  toggleFailedTitle: 'No se pudo cambiar el estado del recurso',
  activated: (label: string): string => `Recurso «${label}» activado.`,
  deactivated: (label: string): string => `Recurso «${label}» desactivado.`,
  mimeLabel: { 'image/png': 'PNG', 'image/jpeg': 'JPEG' } as Record<'image/png' | 'image/jpeg', string>,
} as const;

export const templatesCopy = {
  heading: 'Plantillas',
  versioned:
    'Las plantillas son código versionado y no se editan desde esta página. Una versión nueva se aplica a los carruseles que se generen después.',
  loading: 'Cargando las plantillas…',
  loadFailedTitle: 'No se pudieron cargar las plantillas',
  empty: 'No hay plantillas disponibles.',
  languageLegend: 'Idioma de la vista previa',
  identifier: 'Identificador',
  version: 'Versión',
  slideType: 'Tipo de diapositiva',
  badgeSlots: 'Espacios para escudos',
  badgeSlotsNone: 'Ninguno',
  badgeSlotsValue: (count: number): string =>
    count === 1
      ? '1 espacio reservado; queda vacío porque no hay escudos autorizados.'
      : `${count} espacios reservados; quedan vacíos porque no hay escudos autorizados.`,
  imageSlots: 'Espacios de imagen',
  imageSlotsNone: 'Ninguno',
  imageSlotsNote: 'Se usan solo cuando hay un recurso activo de ese tipo.',
  previewAlt: (label: string, language: string): string => `Vista previa de la plantilla «${label}» en ${language}`,
  previewCaption: (language: string): string => `Vista previa con datos sintéticos de ejemplo (${language}).`,
  previewFailed: 'No se pudo cargar la vista previa de la plantilla.',
} as const;
