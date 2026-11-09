/**
 * Spanish copy of the brand and templates page (PD-06: Spanish by default). Shared error text comes from the copy
 * tables of `src/ui`; this module holds only the feature's own strings and the labels of the brand contract values.
 *
 * Wording rules (PD-03, OD-27, R-049, R-050, R-231): only authorized El Deporte Rey GT assets are registered; there is
 * no option for club badges or competition marks; badge slots stay empty. OD-07: no substitute logo or mascot is
 * suggested. OD-13: templates are versioned code and are not edited here.
 */
import type {
  BrandAssetKind,
  BrandAssetMime,
  BrandAssetUsagePolicy,
  BrandColorRole,
  BrandFontRole,
  Language,
  SlideType,
} from '@edr/contracts';

import type { BadgeVariant } from '../../ui';

/**
 * BrandAssetKind: the only categories that can be registered (no badge or competition-mark category exists). Graphic
 * elements keep the contract value `decoration`.
 */
export const assetKindLabel: Record<BrandAssetKind, string> = {
  brand_logo: 'Logotipo',
  mascot: 'Mascota',
  decoration: 'Elemento gráfico',
  background: 'Fondo',
  style_reference: 'Referencia gráfica',
};

export const assetKindDescription: Record<BrandAssetKind, string> = {
  brand_logo:
    'Logotipo propio de El Deporte Rey GT: principal, horizontal, vertical, monocromático u otra variante oficial.',
  mascot: 'La mascota de la marca, con su variante, pose y expresión.',
  decoration: 'Marcos, líneas, patrones, separadores, ilustraciones y otros recursos de composición.',
  background: 'Fondos gráficos, texturas, estadios y escenarios.',
  style_reference:
    'Imagen que solo sirve como referencia de estilo (portadas, carruseles, paletas, iluminación, tipografía). Nunca se inserta en una publicación.',
};

/** BrandAssetUsagePolicy (PD-ARCH-01G-A section 7). */
export const usagePolicyLabel: Record<BrandAssetUsagePolicy, string> = {
  protected: 'Protegido',
  reference_only: 'Solo referencia',
  reusable: 'Reutilizable',
  transformable: 'Transformable con IA',
};

export const usagePolicyDescription: Record<BrandAssetUsagePolicy, string> = {
  protected:
    'Se usa tal cual, sin cambios generativos que alteren su identidad. Solo se permite escalarlo y posicionarlo.',
  reference_only: 'Solo inspira el estilo. No se inserta en el contenido final.',
  reusable: 'Puede incorporarse directamente en plantillas y composiciones, sin modificarlo.',
  transformable:
    'Además puede servir de base para generar variantes con IA. Es una autorización explícita: úsala solo si la marca lo permite.',
};

export const usagePolicyTone: Record<BrandAssetUsagePolicy, BadgeVariant> = {
  protected: 'info',
  reference_only: 'neutral',
  reusable: 'success',
  transformable: 'warning',
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
  title: 'Mi marca',
  eyebrow: 'Identidad y recursos',
  intro:
    'Administra la identidad visual y los recursos oficiales de la marca. Un recurso activo queda disponible para el contenido que se genere después.',
  authorizedOnly:
    'Solo se registran recursos autorizados de El Deporte Rey GT. No se registran escudos de clubes, marcas de competiciones ni imágenes sin autorización: los nombres de equipos y competiciones aparecen como texto.',
  provisional:
    'Mientras no haya recursos registrados, las plantillas usan los valores provisionales de la marca y generan diapositivas completas sin logotipo ni mascota.',
  statusRegion: 'Avisos de la página de marca',
} as const;

export const libraryCopy = {
  heading: 'Biblioteca de recursos',
  intro:
    'Logotipos, mascota, elementos gráficos, fondos y referencias de estilo de la marca. Cada recurso indica cómo puede usarlo la IA en fases posteriores.',
  upload: 'Subir recurso',
  loading: 'Cargando la biblioteca…',
  loadFailedTitle: 'No se pudo cargar la biblioteca',
  empty: 'Todavía no hay recursos en la biblioteca.',
  emptyDescription: 'Sube el logotipo, la mascota o una referencia de estilo para empezar.',
  noMatches: 'Ningún recurso coincide con la búsqueda o el filtro.',
  search: 'Buscar por nombre',
  category: 'Categoría',
  allCategories: 'Todas las categorías',
  tableCaption: 'Recursos de la biblioteca de marca',
  preview: 'Vista previa',
  name: 'Nombre',
  policy: 'Uso por IA',
  state: 'Estado',
  format: 'Formato',
  actions: 'Acciones',
  openDetail: (label: string): string => `Ver detalle: ${label}`,
  detail: 'Ver detalle',
  active: 'Activo',
  inactive: 'Inactivo',
  official: 'Oficial',
  primary: 'Principal',
  previewAlt: (label: string): string => `Vista previa del recurso «${label}»`,
  previewFailed: 'No se pudo mostrar la vista previa.',
  count: (shown: number, total: number): string =>
    shown === total ? `${total} ${total === 1 ? 'recurso' : 'recursos'}` : `${shown} de ${total} recursos`,
  mimeLabel: { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP' } as Record<BrandAssetMime, string>,
  dimensions: (width: number, height: number): string => `${width} × ${height} px`,
  bytes: (value: number | null): string =>
    value === null
      ? 'Tamaño no disponible'
      : value < 1024
        ? `${value} B`
        : value < 1024 * 1024
          ? `${(value / 1024).toFixed(1)} KB`
          : `${(value / (1024 * 1024)).toFixed(1)} MB`,
} as const;

export const uploadCopy = {
  title: 'Subir un recurso de marca',
  file: 'Archivo',
  fileHint:
    'PNG o JPEG, hasta 5 MB y 4096 × 4096 píxeles. Las referencias gráficas también admiten WebP. SVG y archivos de fuente no se admiten.',
  name: 'Nombre',
  nameHint: 'Hasta 80 caracteres.',
  category: 'Categoría',
  description: 'Descripción',
  descriptionHint: 'Opcional, hasta 500 caracteres.',
  policy: 'Uso por inteligencia artificial',
  policyHint:
    'Se guarda con el recurso y se puede cambiar después. Nunca se marca un recurso como transformable automáticamente.',
  referenceFixed: 'Una referencia gráfica siempre es «Solo referencia».',
  official: 'Recurso oficial de la marca',
  variant: 'Variante',
  variantHint: 'Por ejemplo: principal, horizontal, vertical, monocromático.',
  pose: 'Pose',
  expression: 'Expresión',
  previewTitle: 'Vista previa',
  format: 'Formato',
  size: 'Tamaño',
  dimensions: 'Dimensiones',
  submit: 'Guardar recurso',
  submitting: 'Guardando…',
  failedTitle: 'No se pudo guardar el recurso',
  saved: (label: string): string => `Recurso «${label}» guardado en la biblioteca.`,
  fileRequired: 'Selecciona un archivo.',
  fileType: 'Solo se aceptan archivos PNG o JPEG (WebP solo para referencias gráficas).',
  fileEmpty: 'El archivo está vacío.',
  fileTooLarge: 'El archivo supera el tamaño máximo de 5 MB.',
  fileDimensions: 'La imagen supera 4096 × 4096 píxeles.',
  nameRequired: 'Escribe un nombre.',
  nameTooLong: 'El nombre admite como máximo 80 caracteres.',
  textInvalid: 'El texto contiene caracteres no permitidos (caracteres de control o de formato).',
  descriptionTooLong: 'La descripción admite como máximo 500 caracteres.',
  fieldTooLong: 'Admite como máximo 80 caracteres.',
} as const;

export const detailCopy = {
  title: (label: string): string => `Recurso: ${label}`,
  loading: 'Cargando el detalle del recurso…',
  loadFailedTitle: 'No se pudo cargar el detalle',
  category: 'Categoría',
  format: 'Formato',
  dimensions: 'Dimensiones',
  size: 'Tamaño',
  policy: 'Uso por IA',
  state: 'Estado',
  registeredAt: 'Incorporado',
  updatedAt: 'Última modificación',
  usage: 'Uso en contenido',
  usageValue: (versions: number, projects: number, exports: number): string =>
    versions === 0
      ? 'No aparece en ninguna diapositiva generada.'
      : `Aparece en ${versions} ${versions === 1 ? 'diapositiva generada' : 'diapositivas generadas'} de ${projects} ${projects === 1 ? 'proyecto' : 'proyectos'} y en ${exports} ${exports === 1 ? 'exportación' : 'exportaciones'}.`,
  templateUsage: (templates: number): string =>
    templates === 0
      ? 'No lo usa ninguna plantilla visual.'
      : `Lo ${templates === 1 ? 'usa 1 plantilla visual' : `usan ${templates} plantillas visuales`}.`,
  editHeading: 'Editar propiedades',
  fileUnchanged: 'Editar el nombre o la descripción no cambia el archivo original.',
  save: 'Guardar cambios',
  saving: 'Guardando…',
  saved: 'Cambios guardados.',
  saveFailedTitle: 'No se pudieron guardar los cambios',
  activate: 'Activar',
  deactivate: 'Desactivar',
  stateHint: 'Un recurso inactivo no se usa en el contenido que se genere después; el ya generado no cambia.',
  makePrimary: 'Usar como principal',
  primaryHint: (kind: string): string =>
    `El ${kind} principal es el que aparece en las diapositivas que se generen después.`,
  isPrimary: 'Es el recurso principal de su categoría.',
  delete: 'Eliminar recurso',
  deleteConfirmTitle: '¿Eliminar este recurso?',
  deleteConfirm:
    'Desaparece de la biblioteca y del contenido que se genere después. El archivo se conserva y vuelve a la biblioteca si lo subes de nuevo.',
  deleteBlocked:
    'Este recurso aparece en diapositivas ya generadas, así que no se puede eliminar sin romper ese contenido. Puedes desactivarlo.',
  deleteBlockedTemplates:
    'Una plantilla visual coloca este recurso, así que no se puede eliminar sin romperla. Puedes desactivarlo.',
  confirmDelete: 'Sí, eliminar',
  cancel: 'Cancelar',
  deleting: 'Eliminando…',
  deleted: (label: string): string => `Recurso «${label}» eliminado de la biblioteca.`,
  deleteFailedTitle: 'No se pudo eliminar el recurso',
  close: 'Cerrar',
} as const;

export const identityCopy = {
  heading: 'Identidad visual',
  intro:
    'Los colores y las tipografías son los que usa el motor de diapositivas. Aquí se consultan y se documenta su uso; los valores se cambian en la configuración de la marca.',
  loading: 'Cargando la identidad de la marca…',
  loadFailedTitle: 'No se pudo cargar la identidad de la marca',
  name: 'Nombre',
  handle: 'Cuenta',
  mascot: 'Mascota',
  provisional: 'Valores provisionales',
  palette: 'Paleta oficial',
  typography: 'Tipografía',
  colorRole: {
    primary: 'Principal',
    primaryDark: 'Principal oscuro',
    accent: 'Acento',
    secondary: 'Secundario',
    light: 'Claro',
  } as Record<BrandColorRole, string>,
  fontRole: { heading: 'Titulares', body: 'Texto', numeric: 'Cifras' } as Record<BrandFontRole, string>,
  weight: (value: number): string => `Peso ${value}`,
  fontSample: 'El Deporte Rey 2026',
  usage: 'Uso recomendado',
  noUsage: 'Sin uso documentado.',
  description: 'Descripción de la marca',
  preferences: 'Preferencias gráficas',
  preferencesHint: 'Por ejemplo: contraste, composición, estilo fotográfico. Servirán de contexto para la IA.',
  edit: 'Editar descripción y usos',
  save: 'Guardar identidad',
  saving: 'Guardando…',
  cancel: 'Cancelar',
  saved: 'Identidad de la marca guardada.',
  saveFailedTitle: 'No se pudo guardar la identidad',
  fontNote:
    'Solo se usan las fuentes empaquetadas con el motor (Montserrat e Inter). No se cargan fuentes nuevas desde aquí.',
  tooLong: (max: number): string => `Admite como máximo ${max} caracteres.`,
} as const;

export const templatesCopy = {
  eyebrow: 'Plantillas',
  heading: 'Plantillas',
  createHeading: 'Crear plantilla',
  createIntro:
    'Convierte una propuesta visual aprobada en una plantilla reutilizable y edítala: fondo, recursos oficiales y textos con datos deportivos. Reutilizarla no llama a OpenAI.',
  engineHeading: 'Plantillas del motor',
  versioned:
    'Las plantillas del motor son código versionado y no se editan desde esta página. Una versión nueva se aplica a los carruseles que se generen después. Las plantillas visuales se crean y se editan en «Crear plantilla».',
  brandNote: 'El logotipo y la mascota que dibujan las plantillas se gestionan en',
  brandLink: 'Mi marca',
  listLabel: 'Plantillas disponibles',
  loading: 'Cargando las plantillas…',
  loadFailedTitle: 'No se pudieron cargar las plantillas',
  empty: 'No hay plantillas disponibles.',
  emptyDescription: 'Las plantillas forman parte del motor de diapositivas; aparecerán aquí cuando estén instaladas.',
  versionBadge: (version: string): string => `Versión ${version}`,
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
