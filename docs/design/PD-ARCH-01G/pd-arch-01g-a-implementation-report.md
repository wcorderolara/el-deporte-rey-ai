# PD-ARCH-01G-A — Informe de implementación: identidad visual y biblioteca de recursos

## Estado

**Aceptada por el Product Owner el 2026-11-05** y cerrada con un commit en `work/PD-ARCH-01G-A` (base `c5a511d`,
cierre de PD-ARCH-01E-B). No se hizo merge, push ni deploy. No se implementó generación con IA, no se llamó a ningún
proveedor, no se modificó el motor deportivo, el ETL ni la lógica de revisión y exportación.

## Decisiones del Product Owner (2026-11-05)

| Tema | Decisión |
| --- | --- |
| Paleta y tipografía | Se muestran tal como las usa el renderizador (`config/brand.json`, fuentes empaquetadas), sin duplicarlas; solo se editan la descripción, las preferencias gráficas y las notas de uso. |
| Variantes de logo y mascota | Un recurso **principal** por tipo es el que dibuja el renderizador; los existentes conservan su comportamiento (el último activo queda como principal). |
| Eliminación | Lógica y con dependencias: si ninguna diapositiva generada lo usa, sale de la biblioteca (fila y archivo se conservan); si está en uso, se rechaza con `ASSET_IN_USE` y se ofrece desactivarlo. Nunca hay borrado físico. |
| Formatos | PNG y JPEG para todas las categorías; WebP solo para referencias gráficas; SVG y fuentes deshabilitados. |
| Navegación | Mi marca (`/brand`: identidad y biblioteca) y Plantillas (`/templates`) son páginas separadas; «Mi marca» va antes que «Plantillas» en el menú lateral; ambas usan la superficie oscura del sistema de diseño, no el panel claro heredado. |

## Resumen funcional

Mi marca (`/brand`) pasa a tener dos secciones, y las plantillas pasan a su propia página:

1. **Identidad visual**: nombre, cuenta y mascota de la marca; paleta oficial (5 colores) y tipografía (3 roles) de
   solo lectura, con su uso recomendado; descripción y preferencias gráficas editables.
2. **Biblioteca de recursos**: logotipos, mascota, elementos gráficos, fondos y referencias gráficas; Tabla
   (predeterminada) y Cards sobre la misma lista; búsqueda por nombre o variante; filtro por categoría; subida con
   vista previa, formato, tamaño, dimensiones y política de uso visible antes de guardar; detalle con metadatos, uso
   en contenido, edición, activación, marca de principal y eliminación segura.
3. **Plantillas** (`/templates`): página propia con el mismo contenido (versión, tipo, ranuras, vista previa por
   idioma; versionadas, no editables), un enlace a Mi marca y los colores del sistema de diseño. El antiguo enlace
   `/brand#brand-templates-title` redirige a `/templates`.

## Arquitectura reutilizada

- **Tabla `brand_assets` y módulo `modules/brand`**: se extienden; no hay un segundo sistema de almacenamiento.
- **Almacenamiento confinado `brand-assets/`**: nombres generados `<uuid>.<ext>`, directorio 0700, archivos 0600 con
  apertura exclusiva, sin seguir enlaces, contención por `realpath`, verificación SHA-256 en cada lectura.
- **Validación existente**: firma real del archivo, `Content-Type` coherente, cabecera leída sin decodificar,
  4096 × 4096, 5 MiB, decodificación con resvg (el decodificador del renderizador), duplicados por SHA-256.
- **Ruta de archivo existente**: sirve solo por ID tras consultar la base, con `nosniff`, CSP `sandbox`, CORP
  same-origin y `no-store`.
- **Renderizador**: no cambia su lógica; el lookup de la marca (`brandAssetLookup`) entrega ahora los recursos
  dibujables con el principal al final (el renderizador toma el último).
- **Configuración de marca** (`config/brand.json`): única fuente de los colores y fuentes; los tokens CSS de la web
  conservan los mismos valores y no se duplican en la base.
- **Interfaz**: tokens semánticos, Tailwind, `Button`, `Badge`, `Card`, `Modal`, `Input`, `Select`, `Textarea`,
  `ViewModeToggle`, `IconButton`, `EmptyState`, `LoadingState`, `ErrorBanner`.

## Modelo de recursos

| Campo | Notas |
| --- | --- |
| `kind` | `brand_logo` (logotipo), `mascot`, `decoration` (elemento gráfico), `background` (fondo), `style_reference` (referencia gráfica). Sin escudos ni marcas de competiciones. |
| `label`, `description` | Nombre (≤ 80) y descripción multilínea (≤ 500). |
| `usage_policy` | `protected`, `reference_only`, `reusable`, `transformable`. |
| `official` | Recurso oficial marcado por el operador. |
| `is_primary` | Logotipo o mascota que dibuja el renderizador; uno por tipo (índice único parcial). |
| `variant`, `pose`, `expression` | Variante de logo o mascota; pose y expresión solo para la mascota (por ejemplo, Ketsi). |
| `mime`, `width`, `height`, `byte_size`, `sha256`, `file_path` | Metadatos técnicos; el tamaño de los recursos anteriores se mide al arrancar. |
| `active`, `registered_at`, `updated_at`, `deactivated_at`, `deleted_at` | Estado y ciclo de vida. |

Reglas (base de datos, servidor y cliente): una referencia gráfica es siempre `reference_only`; WebP solo para
referencias; pose y expresión solo para la mascota; el principal es un logo o mascota activo y no `reference_only`;
un recurso eliminado está inactivo y no es principal. La categoría y el archivo no se editan.

Identidad: tabla `brand_identity` con una fila `primary` (preparada para varias identidades sin multitenencia):
descripción (≤ 1000), preferencias gráficas (≤ 2000) y notas de uso por rol de color y de fuente (≤ 300).

## Políticas de uso para IA

| Política | Insertar en contenido | Alterar píxeles | Generar variantes | Referencia de estilo |
| --- | --- | --- | --- | --- |
| `protected` | Sí (solo escala y posición) | No | No | Sí |
| `reference_only` | No | No | No | Sí |
| `reusable` | Sí | No | No | Sí |
| `transformable` | Sí | Sí | Sí | Sí |

Valores por defecto: logos y mascota `protected`, referencias `reference_only`, elementos gráficos y fondos
`reusable`. `transformable` nunca es un valor por defecto: se elige de forma explícita, con su advertencia.

El renderizador nunca dibuja una referencia gráfica, un recurso `reference_only` ni un WebP.

## Almacenamiento

- Archivos en `<dataDir>/brand-assets/<uuid>.png|jpg|webp`, persistentes; nada en directorios temporales.
- Metadatos en `brand_assets` (sin base64 en SQLite); relación con el contenido derivada de los modelos de render
  (`element_versions.render_model` guarda el `assetId` de cada imagen) y de `export_files`.
- Duplicados por SHA-256: `DUPLICATE_ASSET`; un archivo igual a un recurso eliminado lo restaura con los metadatos
  nuevos (su archivo conservado se verifica antes).

## Contratos

Operaciones (Zod y OpenAPI, 76 rutas, 103 operaciones):

| Operación | Cambio |
| --- | --- |
| `listBrandAssets` | Solo recursos no eliminados, con los campos nuevos. |
| `registerBrandAsset` | Consulta: `description`, `usagePolicy`, `official`, `variant`, `pose`, `expression`; cuerpo `image/webp`. |
| `getBrandAsset` (nueva) | `BrandAssetDetail`: recurso y uso (`renderedVersions`, `projects`, `exports`). |
| `updateBrandAsset` | Cuerpo con todos los campos editables (al menos uno); 409 añadido. |
| `deleteBrandAsset` (nueva) | 204; `ASSET_IN_USE` (409) si una diapositiva generada lo usa. |
| `getBrandAssetFile` | También `image/webp`. |
| `getBrandIdentity` / `updateBrandIdentity` (nuevas) | Identidad; solo se editan los campos descriptivos. |

Esquemas nuevos: `BrandAssetUsagePolicy`, `BrandAssetUsage`, `BrandAssetDetail`, `BrandIdentity`; `BrandAsset` y
`BrandAssetKind` ampliados; patrón `Note` (texto multilínea sin caracteres de control ni de formato); código de
problema `ASSET_IN_USE`. Las diferencias quedan registradas en la prueba del documento OpenAPI.

## Migraciones

`0024_brand_asset_library.sql`: reconstruye `brand_assets` (patrón 0008, ninguna tabla la referencia) conservando
filas e IDs; asigna `protected`/`reusable` y el principal (último activo de logo y mascota) a los recursos existentes;
crea `idx_brand_assets_primary` y `brand_identity`. Validada sobre una copia de la base del PO (sin recursos) y sobre
una base sintética con recursos anteriores antes de dejarla definitiva. El servidor de desarrollo del PO ya la aplicó
(versión 24); no se editó después de crearla.

## Seguridad

- Firma real del archivo (PNG, JPEG, WebP); se rechazan SVG (contenido activo), GIF, texto, fuentes y archivos
  renombrados, sin importar el `Content-Type` declarado.
- WebP: contenedor RIFF verificado (tamaño declarado = tamaño real, cada bloque dentro del archivo, primer bloque
  `VP8 `, `VP8L` o `VP8X`), dimensiones de la cabecera, ≤ 4096 × 4096.
- IDs validados como UUID antes de construir rutas; segmentos `..` no llegan a las rutas; sin rutas de descarga
  arbitrarias; un recurso eliminado responde 404 también en su archivo.
- Textos validados en servidor y cliente (sin caracteres de control ni de formato; saltos de línea solo en
  descripciones).
- El `BrandContext` no contiene bytes, rutas de archivo ni URLs.

## Interfaz

- `BrandPage` (`/brand`, título «Mi marca»): cabecera, región de avisos, identidad y biblioteca.
- `TemplatesPage` (`/templates`, montada por `features/templates`): plantillas con tarjetas del sistema de diseño
  (vista previa 4:5 sobre el lienzo oscuro, tipo, versión, identificador, ranuras), selector de idioma y enlace a Mi
  marca. Sustituye a `TemplatesSection`; se retiró `Brand.module.css` (paleta clara heredada) y `PreviewImage` usa
  los tokens de aviso.
- Cáscara: menú con «Mi marca» antes que «Plantillas», cada uno activo por su ruta (sin anclas); `/brand` y
  `/templates` usan la variante `studio` del contenido (superficie `surface-canvas`), no el panel `legacy-canvas`
  blanco; se retiró el enfoque por ancla de las secciones de marca.
- `BrandIdentitySection`: muestras de color con su valor, ejemplo de cada fuente, notas de uso; edición en el lugar.
- `BrandLibrarySection`: Tabla por defecto (miniatura, nombre y variante, categoría, uso por IA, estado, formato,
  acción «Ver detalle») y Cards (miniatura grande); búsqueda y filtro; contador de resultados.
- `UploadAssetDialog`: categoría con su descripción, archivo con vista previa, formato, tamaño y dimensiones; nombre
  (propuesto desde el archivo), descripción, variante, pose y expresión; política de uso con explicación, propuesta
  por categoría y fija para referencias; recurso oficial.
- `AssetDetailDialog`: vista previa, metadatos, uso en contenido, edición (sin cambiar el archivo), activar o
  desactivar, usar como principal, eliminación con confirmación (deshabilitada si está en uso).
- Se retiraron `BrandAssetsSection` y `RegisterAssetForm` (y su prueba), reemplazados por los anteriores.

## Preparación para IA

- `modules/brand/context.ts`: `BrandContextSchema` (`edr-brand-context/1`) y `brandContextOf(container)`: identidad
  (sin `id` ni fecha) y recursos activos con su política y permisos derivados (`permissionsOf`).
- Interno: no tiene ruta HTTP y nada en 01G-A lo envía a un proveedor.

Puntos de integración:

- **PD-ARCH-01G-B** (propuestas visuales con IA): consume `brandContextOf`; solo puede enviar bytes de recursos cuyos
  permisos lo permitan (`styleReference` para referencias, `generateVariants` solo para `transformable`), pidiendo
  al módulo de marca los bytes verificados por ID.
- **PD-ARCH-01G-C** (plantillas estructuradas y versionadas): las propuestas se convierten en `TemplateDefinition`
  nuevas registradas en `TemplateRegistry`; los recursos `protected` y `reusable` entran como ranuras de imagen.
- **PD-ARCH-01G-D** (wizard y motor): ampliar las ranuras de imagen del renderizador (fondos, elementos gráficos)
  usando el lookup de dibujables, que ya excluye referencias y `reference_only`.

## Pruebas

| Ámbito | Archivo | Qué cubre |
| --- | --- | --- |
| Integración | `modules/brand/library.int.test.ts` (nuevo, 14) | Categorías y metadatos; políticas por defecto y explícitas; reglas; WebP válido, para logo, roto o enorme; SVG, GIF, texto y fuentes; IDs inválidos y `..`; edición sin tocar el archivo; principal único; lookup del renderizador; dependencias y `ASSET_IN_USE`; restauración; identidad (solo campos descriptivos); `BrandContext` sin bytes ni rutas; persistencia tras reinicio. |
| Integración | `modules/brand/brand.int.test.ts` | Forma nueva del recurso; eliminación lógica (fila y archivo conservados). |
| Unitarias | `modules/brand/image.test.ts` | Cabeceras VP8, VP8L, VP8X; contenedores rotos, bloque desconocido, código de inicio inválido, lienzo excesivo. |
| Integración | `platform/db/*.int.test.ts` | Migración 24, columnas, índices, tablas. |
| Contrato | `test/contract/*` | Muestras, paridad Zod/OpenAPI, protección de solicitudes, cuerpos inválidos, operaciones servidas (detalle, edición, identidad, eliminación). |
| Web | `features/brand/BrandPage.test.tsx` (23) | Identidad de solo lectura y edición; Tabla por defecto; Cards; filtros; texto hostil; vista previa fallida; error con reintento; subida con vista previa, tamaño y política; referencias y WebP; validaciones; rechazo del servidor; detalle con uso; edición; principal; desactivación; eliminación y su rechazo. |
| Web | `features/brand/TemplatesPage.test.tsx` (nuevo, 8) | Página propia sin peticiones de marca; enlace a Mi marca; carga y vacío; lista con versión, tipo y ranuras; vistas previas por idioma; vista previa fallida; sin edición; error con reintento; dirección desconocida bajo `/templates`. |
| Web | `app/App.test.tsx` | Orden del menú (Mi marca antes que Plantillas); navegación a `/brand` y `/templates` con su elemento activo y la superficie del estudio; redirección del ancla antigua. |
| Web | `features/brand/brandApi.test.ts`, `library.test.ts` | Cliente de las operaciones nuevas; reglas del cliente. |

Resultados:

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto. |
| ESLint (`--max-warnings 0`) y Prettier sobre los archivos cambiados | Correcto. `prettier --check .` señala 3 archivos del servidor sin cambios en esta fase (`errors.ts`, `respond.ts`, `import-preview.int.test.ts`), ya así en commits anteriores; no se tocaron. |
| `vitest --project unit` | 1717 pruebas, todas correctas. |
| `vitest --project integration` | 602 pruebas, todas correctas. |
| `vitest --project contract` | 1785 pruebas, todas correctas. |
| `vitest --project unit-web` | 585 pruebas; 583 correctas y 2 fallas previas (breadcrumbs en `App.test.tsx` y `ReviewPage.test.tsx`). |
| `npm run build` | Correcto. |
| `git diff --check` | Sin observaciones. |

No se ejecutaron E2E ni automatización de navegador. Las pruebas usan bases y directorios temporales; no se tocaron
los recursos ni la base del PO.

## Limitaciones

- **SVG** deshabilitado: no hay una estrategia de sanitización suficientemente segura en esta fase.
- **WebP** solo para referencias: resvg 2.6.2 no pudo confirmar su decodificación; el WebP se valida por estructura,
  no se decodifica en el servidor.
- **Fuentes**: no se suben; solo se usan las empaquetadas (Montserrat ExtraBold, Inter Regular y Bold, OFL). Cambiar
  una fuente o un color requiere editar la configuración de la marca; la página lo explica.
- **Categoría**: no se edita después de subir (cambiaría las reglas de política y formato).
- **Uso en contenido**: se calcula desde los modelos de render guardados; las plantillas no referencian recursos
  concretos (usan ranuras), por eso no hay dependencia de plantilla por recurso.
- **Restauración**: subir de nuevo el archivo de un recurso eliminado lo restaura con los metadatos nuevos, no crea
  uno distinto.
- `.orchestrate/source-of-truth.md` no se actualizó con OD-08 ampliado (eliminación lógica de recursos) ni con las
  categorías nuevas; conviene registrarlo al aceptar la fase.

## Pasos para validación manual

1. Iniciar el servidor de desarrollo (la base ya está en la versión 24).
2. Comprobar el menú lateral: «Mi marca» aparece antes que «Plantillas» y cada uno abre su propia página con el
   fondo oscuro del estudio.
3. Abrir **Mi marca**: revisar la paleta, la tipografía y editar la descripción y algún uso recomendado.
4. **Subir recurso**: un logotipo PNG (comprobar la vista previa, el tamaño, las dimensiones y que la política
   propuesta es «Protegido»); la mascota Ketsi con pose y expresión; una referencia gráfica en WebP (la política queda
   fija en «Solo referencia»).
5. Probar la Tabla y las Cards, la búsqueda y el filtro por categoría.
6. Abrir un recurso: editar el nombre o la descripción, cambiar la política, marcarlo como oficial y como principal.
7. Generar contenido nuevo y comprobar que aparece el logotipo principal; luego intentar eliminarlo (debe impedirlo
   e indicar dónde se usa) y desactivarlo.
8. Eliminar un recurso que no se haya usado y comprobar que desaparece de la biblioteca.
9. Abrir **Plantillas**: cambiar el idioma de la vista previa y seguir el enlace a Mi marca.

## Estado Git

- Rama: `work/PD-ARCH-01G-A`, base `c5a511d27b2267c2edf5a326e7f9b3cfe8b0533c` (cierre de PD-ARCH-01E-B).
- Aceptada por el Product Owner el 2026-11-05 y cerrada con un commit en esa rama (el hash queda en el
  [índice de PD-ARCH-01G](./README.md)). Sin merge, push ni deploy.
