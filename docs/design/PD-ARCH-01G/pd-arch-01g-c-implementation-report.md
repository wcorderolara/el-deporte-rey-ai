# PD-ARCH-01G-C — Informe de implementación: plantillas visuales estructuradas y reutilizables

## Estado

**Aceptada por el Product Owner el 2026-11-09** y cerrada con un commit en `work/PD-ARCH-01G-C`, creada desde el
cierre de 01G-B (`9da113b11f572fcf062d950546a9cf4182a481fe`). No se hizo merge, push ni deploy. No se adelantó 01G-D:
el wizard `/projects/generate`, los proyectos, la revisión, la exportación y las plantillas del motor no cambian.

Antes del cierre se comprobó que todos los cambios pendientes pertenecen a 01G-C o a las decisiones registradas durante
la fase (01G-C-1 a 01G-C-3, PD-28 y PD-29). Las verificaciones de la sección 13 siguen vigentes.

Nada de 01G-C llama a OpenAI: convertir una propuesta, editar, validar, previsualizar y publicar son operaciones
locales. Las pruebas no hicieron ninguna llamada real (cliente de salida simulado y guardia de red de Vitest).

El assessment previo está en [pd-arch-01g-c-assessment.md](./pd-arch-01g-c-assessment.md).

## Decisión del Product Owner durante la implementación (2026-11-06)

| ID | Decisión | Aplicación |
| --- | --- | --- |
| 01G-C-1 | El tipo de contenido de la plantilla se elige al crearla. Por defecto es el de la propuesta, porque la propuesta solo aporta el fondo. No se cambia después. | `VisualTemplateCreate.contentType` opcional (aditivo). El diálogo «Crear plantilla» tiene el selector «Tipo de contenido de la plantilla» y avisa cuando difiere del de la propuesta. Las capas obligatorias iniciales son las del tipo elegido; por ejemplo, Resultados agrega «Marcador». |

Motivo: una propuesta generada como «Previa individual» puede servir de fondo para una plantilla de resultados con
marcador sin pagar otra generación. Una variante conserva el tipo de su propuesta de origen, así que antes no había
otra forma.

### Decisiones del 2026-11-09

| ID | Decisión | Aplicación |
| --- | --- | --- |
| 01G-C-2 | Paleta cerrada de efectos de texto: Ninguno, Sombra suave, Sombra intensa, Brillo dorado, Brillo morado, Contorno oscuro y Marcador dorado. | `VisualTemplateTextStyle.effect` y componente `VisualTemplateTextEffect`, ambos aditivos. El modelo de render guarda `text.effect` (opcional) y el renderizador lo convierte en `textShadow`, en los colores de la paleta y escalado con la letra. El contorno se hace con 8 sombras: el `text-stroke` de Satori deja marcas dentro de las letras de Montserrat. Con un efecto de halo oscuro no se avisa contraste bajo. En el editor hay un selector «Efecto» y el lienzo lo aproxima con CSS. Por defecto, las capas nuevas llevan Sombra suave y el marcador inicial, Marcador dorado. |
| 01G-C-3 | Plantillas como menú padre con dos vistas separadas: «Crear plantilla» y «Plantillas del motor». | Rutas: `/templates` lleva a `/templates/create` (Plantillas visuales y Propuestas visuales con IA, más el editor `/templates/visual/:id`) y `/templates/engine` (plantillas del motor). En el menú lateral, «Plantillas» tiene dos sub-opciones: la sub-opción activa es la página actual y el padre queda resaltado. Las migas de pan muestran «Plantillas / Crear plantilla» y «Plantillas / Plantillas del motor», y el editor «Crear plantilla / Editor de plantilla». `/brand#brand-templates-title` lleva a `/templates/engine`. Los componentes son `CreateTemplatesPage` y `EngineTemplatesPage`, con un encabezado común. |
| PD-29 | Mayúsculas solo de visualización (enmienda de BR-05). | `VisualTemplateTextStyle.uppercase` (aditivo). En el modelo de render, `text` conserva el valor guardado y `lines` son las líneas en mayúsculas, medidas como se dibujan (`text.uppercase`). En el editor, la casilla «Mostrar en mayúsculas». Registrada en la fuente de verdad. |

### Corrección del 2026-11-09: jornadas en la vista previa

El selector de jornada de la vista previa pedía solo las jornadas sin fase (`listSeasonRounds`). Como las jornadas
importadas pertenecen a una fase (las 77 de la base de desarrollo), la lista salía vacía y aparecían todos los
partidos. Ahora carga también las jornadas de cada fase (`listStages` y `listStageRounds`), igual que el wizard de
proyectos, y antepone el nombre de la fase cuando hay más de una. Tiene una prueba de regresión.

## 1. Resumen funcional

**Plantillas** es un menú con dos vistas (decisión 01G-C-3): **Crear plantilla** (`/templates/create`), con la sección
nueva **Plantillas visuales** antes de «Propuestas visuales con IA», y **Plantillas del motor** (`/templates/engine`).

1. **Crear plantilla** desde una propuesta aprobada: en la sección, o con el botón del detalle de la propuesta.
   - Solo se ofrecen propuestas aprobadas.
   - Se elige el tipo de contenido de la plantilla; por defecto, el de la propuesta (decisión 01G-C-1).
   - Las de prompt propio piden confirmar que la imagen puede tener textos, personas, logos o una Ketsi generados.
   - El servidor crea la plantilla y su versión 1 en borrador, sin llamar a la IA:
     - el fondo limpio de la propuesta queda fijado por su hash;
     - el logotipo, Ketsi u otro original colocado en 01G-B pasa a ser una capa en su misma caja;
     - se agregan las capas de datos obligatorias del tipo de contenido (por ejemplo, equipo local y visitante).
2. **Editor** (`/templates/visual/:templateId`):
   - el lienzo muestra el fondo y las capas;
   - las capas se seleccionan, se arrastran, se redimensionan desde la esquina, se mueven con las flechas o se
     ajustan con X, Y, ancho y alto en %;
   - la lista de capas permite subir, bajar, ocultar y eliminar;
   - se puede agregar Texto, Dato deportivo, Imagen de Mi marca, Logotipo oficial o Ketsi;
   - propiedades por tipo: rol tipográfico, tamaños, líneas, color de la paleta, alineación, desborde, campo del
     catálogo y si es obligatorio, y ajuste de la imagen;
   - se puede cambiar el fondo por otra propuesta aprobada o por un fondo de Mi marca;
   - guardar, panel de validación con errores y advertencias, publicar, crear nueva versión, descartar borrador,
     y editar el nombre, la descripción y la categoría.
3. **Previsualización con datos locales**: se elige competición, temporada, jornada y partido existentes, y el
   servidor resuelve los campos y dibuja el PNG con el mismo motor que las diapositivas finales. Se muestran los valores
   y los avisos: falta de un dato y texto que no cabe.
4. **Ciclo de vida**: borrador → publicada → archivada (y restaurar).
   - Una versión publicada no se modifica.
   - Cambiarla crea una versión nueva en borrador, copiada de la publicada.
   - Una plantilla con versiones publicadas se archiva; solo se elimina una que nunca se publicó.
5. **Listado**:
   - Tabla por defecto y Cards;
   - búsqueda por nombre o categoría, y filtros por estado, tipo de contenido y formato;
   - acciones según el estado: editar o ver, previsualizar, publicar, nueva versión, archivar o restaurar, eliminar.

## 2. Arquitectura

```
web: Plantillas → VisualTemplatesSection / CreateTemplateDialog / TemplateEditorPage → visualTemplatesApi ──HTTP /api/v1/visual-templates/*──┐
server: modules/visual-templates (routes, service, repository, catalog, validation, contrast)
          ├─ modules/design: DesignService.templateSource / readFile (propuesta, fondo limpio con hash)
          ├─ modules/brand: BrandAssetService.find / readFile (recursos con hash), uso y dependencias
          ├─ modules/projects/content-batches: ContentBatchRepository.seasonMatches (valores efectivos de 01E)
          └─ modules/rendering: buildStructuredModel → RenderModel → renderSlide (Satori + resvg, fuentes empaquetadas)
```

- **Un solo motor.** `rendering/structured.ts` convierte la versión y los valores en el mismo `RenderModel` que usan
  las plantillas del motor, y `renderSlide` lo dibuja. El modelo se extendió de forma aditiva:
  - `image.slot` admite `background` y `layer`;
  - `image.fit` es opcional (`contain` si falta, como antes), con `cover` y `fill`.

  Los modelos guardados de los proyectos siguen siendo válidos y se dibujan igual.
- **Sin segundo almacenamiento.** El fondo es una referencia (`design_proposal` o `brand_asset`) con su hash. Los
  recursos se leen de sus almacenes confinados, con el hash verificado.
- **Las plantillas del motor no cambian.** Siguen siendo código versionado por tipo de diapositiva y coexisten con las
  plantillas visuales. Elegir entre ellas en un proyecto es 01G-D.

## 3. Decisiones técnicas

Las decisiones D1 a D12 del [assessment](./pd-arch-01g-c-assessment.md#3-decisiones-técnicas), aplicadas tal cual. Además:

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Nombre de la operación de publicar | `releaseVisualTemplateVersion` (`POST …/release`); la interfaz dice «Publicar» y el estado es `published`. | La regla de contrato R-219/BR-11 prohíbe la palabra *publish* en rutas y operaciones (no hay publicación en redes). |
| Escudos | El catálogo no tiene logos de equipos; la palabra del contrato es *badge*. | PD-03, R-231; *crest* es un campo del proveedor (R-288). |
| Marcador | Solo existe para un partido finalizado con resultado. | Igual que los resultados de 01E: no se muestra un parcial como resultado. |
| Hora del partido | Binding nuevo `match.kickoffTime` (`HH:MM`, hora de visualización); `formatTime` en `platform/format`. | El dato existe (`kickoffAt`); 01E solo mostraba la fecha. |
| Calendario | `round.fixtures`: todos los partidos de la jornada, en orden de calendario, `Local vs Visitante · fecha`. | La misma forma que la diapositiva de calendario de 01E-B. |
| Recurso protegido en capa de imagen | Error de validación si no es `contain`; al dibujar se usa siempre `contain`. | Regla 3 de 01G-A: solo se escala de forma proporcional. |
| Dependencias | Eliminar un recurso de marca o una propuesta usados por una plantilla no eliminada responde 409 (`ASSET_IN_USE`, `PROPOSAL_IN_USE`); desactivar está permitido y la validación lo marca como error. | Trazabilidad (regla 7) y versiones publicadas que se siguen dibujando. |
| Fondo de otra proporción | Se dibuja con `cover` (recorte centrado) y se advierte. | Las propuestas tienen tamaños propios (por ejemplo, 1024 x 1280). |

## 4. Modelo de datos

Migración `0029_visual_templates.sql`, solo aditiva:

- `visual_templates`:
  - nombre, descripción, categoría, tipo de contenido y formato;
  - `source_proposal_id`, con `REFERENCES design_proposals`;
  - `acknowledged_warnings`: el operador confirmó las advertencias del fondo;
  - fechas, `archived_at` y `deleted_at`.

  El estado se deriva: archivada si hay `archived_at`, publicada si alguna versión está publicada, borrador en otro caso.
- `visual_template_versions`:
  - número de versión, estado (`draft`, `published` o `discarded`), `revision` y lienzo;
  - fondo: origen, id, hash, tipo, ancho y alto;
  - `layers_json` y `assets_json`: los recursos fijados por su hash y la política que tenían;
  - fechas y `published_at`.

  Restricciones:
  - un solo borrador por plantilla (índice único parcial);
  - `published_at` existe si y solo si la versión está publicada;
  - dos triggers rechazan cualquier `UPDATE` o `DELETE` de una versión publicada.

Los JSON se validan con los esquemas del contrato al escribir y al leer.

**Capa** (contrato `VisualTemplateLayer`):

- campos comunes: `id`, `name`, `x`, `y`, `width`, `height` (fracciones 0–1 del lienzo, 4 decimales) y `visible`;
- por tipo:
  - `text`: `text` (hasta 500 caracteres, saltos de línea permitidos) y `style`;
  - `sports_data`: `binding` (nulo solo en borrador), `required` y `style`;
  - `image`: `assetId` y `fit` (`contain`, `cover` o `fill`);
  - `brand_asset`: `assetId` (siempre proporcional).

El orden de apilamiento es el orden de la lista, de abajo arriba. El fondo es un campo de la versión, no una capa.

**Estilo de texto**:

- `fontRole`: `heading` (Montserrat 800), `body` (Inter 400) o `numeric` (Inter 700); son las únicas caras
  empaquetadas, así que el rol fija la familia y el peso;
- `maxFontSize` y `minFontSize`: de 8 a 400 px del lienzo;
- `maxLines`: de 1 a 12;
- `colorRole`: uno de los 5 roles de la paleta;
- `align` y `verticalAlign`;
- `overflow`: `shrink` o `fixed`;
- `effect`: un efecto de la paleta cerrada (01G-C-2);
- `uppercase`: mostrar en mayúsculas, solo en el dibujo (PD-29).

**Límites:**

- 40 capas, de ellas hasta 12 de imagen o recurso;
- 500 caracteres por texto;
- lienzos de 1080 x 1080, 1080 x 1350 y 1080 x 1920;
- caché de vistas previas de 16 PNG por instancia.

## 5. Contratos

Quince operaciones nuevas (etiqueta `visual-templates`), en Zod (`packages/contracts/src/http/visual-templates.ts`)
y en OpenAPI:

| Operación | Ruta |
| --- | --- |
| `listVisualTemplates` / `createVisualTemplate` | `GET` / `POST /visual-templates` |
| `getVisualTemplate` / `updateVisualTemplate` / `deleteVisualTemplate` | `GET` / `PATCH` / `DELETE /visual-templates/{templateId}` |
| `archiveVisualTemplate` / `restoreVisualTemplate` | `POST /visual-templates/{templateId}/archive` y `/restore` |
| `createVisualTemplateVersion` | `POST /visual-templates/{templateId}/versions` |
| `getVisualTemplateVersion` / `saveVisualTemplateVersion` / `deleteVisualTemplateVersion` | `GET` / `PUT` / `DELETE …/versions/{versionId}` |
| `releaseVisualTemplateVersion` | `POST …/versions/{versionId}/release` |
| `getVisualTemplateBackground` | `GET …/versions/{versionId}/background` (PNG o JPEG, CSP aislada, `no-store`) |
| `previewVisualTemplate` | `POST …/versions/{versionId}/previews` (valores y avisos) |
| `renderVisualTemplatePreview` | `GET …/versions/{versionId}/preview?competitionId&seasonId&roundId&matchId&language&revision` (PNG) |

Además:

- **Componentes nuevos:** 31. Entre ellos, `VisualTemplateVersionRef` (`templateId`, `versionId`, `version`): la
  referencia que 01G-D guardará en cada proyecto. Ya está definida, pero ninguna operación la usa todavía.
- **Constantes del contrato:**
  - `VISUAL_TEMPLATE_BINDINGS`: tipos de contenido de cada binding y campo de diapositiva para 01G-D;
  - `VISUAL_TEMPLATE_REQUIRED_BINDINGS`;
  - `VISUAL_TEMPLATE_CANVAS` y los límites.
- **Patrones nuevos:** `LayerId`, `VisualTemplateUrl` y `RevisionParam`.
- **Códigos de problema nuevos:** `TEMPLATE_SOURCE_REFUSED`, `TEMPLATE_VERSION_PUBLISHED`, `TEMPLATE_NOT_PUBLISHABLE`,
  `TEMPLATE_IN_USE` y `PROPOSAL_IN_USE`.
- **Cambios aditivos:**
  - `BrandAssetUsage.templates`;
  - `VisualTemplateCreate.contentType` (opcional, decisión 01G-C-1);
  - `VisualTemplateTextStyle.effect` y `uppercase` (opcionales, 01G-C-2 y PD-29), con el componente nuevo
    `VisualTemplateTextEffect`.
- **Documentación:** el comentario de `DesignMode` y `DesignProposal.mode` dice ahora que una propuesta de prompt
  propio puede ser base de plantilla con la confirmación del operador.

Todos los cambios son aditivos dentro de v1 (PD-11). El hash declarado del contrato en `.orchestrate/config.json`
(`PRJ-CONTRACT-ID`) ya no coincidía antes de 01G-B y se actualiza al cierre del bloque PD-ARCH, como en las fases
anteriores.

## 6. Reglas de capas y bindings

- **Coordenadas:**
  - una caja que sale del lienzo es un error;
  - un lado de menos de 8 px también.
- **Texto:**
  - el texto fijo que no cabe es un error (`TEXT_TOO_LONG`);
  - un binding se prueba con un valor largo sintético y, si no cabe, es una advertencia (`TEXT_MAY_NOT_FIT`);
  - en la vista previa, un texto que no cabe con el dato real es un error (`TEXT_OVERFLOW`);
  - nunca se corta texto.
- **Bindings:**
  - el catálogo es una lista cerrada, sin expresiones;
  - un binding que no existe para el tipo de contenido es un error;
  - un dato deportivo sin binding también.
- **Obligatorios:**
  - previa y partido programado: los dos equipos;
  - resultado: los dos equipos, y el marcador o los dos goles;
  - calendario: los partidos de la jornada.
  - Solo cuentan las capas visibles.
- **Recursos:**
  - error si no existe, si se eliminó o si está desactivado;
  - error si es una referencia de estilo, `reference_only` o WebP;
  - error si el logotipo o la mascota están en una capa de imagen, o un elemento gráfico en una capa de recurso oficial;
  - error si un recurso protegido no es `contain`.
  - Los recursos se dibujan siempre desde su archivo original, verificado por su hash.
- **Fondo:**
  - es un error si no está disponible, se eliminó, ya no está aprobado o está desactivado;
  - advertencia de revisión en todos los fondos generados por IA;
  - advertencia propia para un prompt propio;
  - advertencia si se enviaron imágenes de la marca a la IA, porque puede haber un logo o una Ketsi redibujados;
  - advertencia si tiene otra proporción.
- **Advertencias de composición:**
  - texto sobre texto;
  - una capa encima de un recurso protegido;
  - capa oculta;
  - plantilla sin capas;
  - contraste bajo: WCAG, 4,5:1, o 3:1 desde 24 px, medido sobre el fondo rasterizado bajo la caja.
- **Valor ausente en la vista previa:** la capa no se dibuja. Es un error si la capa es obligatoria y una advertencia si
  no lo es.

## 7. Seguridad

- **Entradas cerradas:**
  - sin JavaScript, HTML, URLs externas ni rutas en ningún campo: las capas son objetos cerrados con patrones;
  - los colores y las fuentes son roles y los bindings son nombres del catálogo;
  - el texto llega a Satori solo como contenido.
- **Imágenes:** solo bytes de los almacenes confinados (`brand-assets/`, `design-proposals/`), verificados por su hash
  y embebidos como `data:`. El renderizador no abre conexiones.
- **Respuestas:** las imágenes se sirven con `nosniff`, CSP `sandbox` y `no-store`. Ninguna respuesta lleva rutas
  internas ni claves.
- **Protección local:** las rutas nuevas heredan Host, Origin y `X-EDR-Client` (pruebas de protección de solicitudes).
- **Trabajo acotado:** límites de capas y textos, caché de 16 vistas previas y renders concurrentes compartidos.
- **Proveedor de IA:** el módulo no recibe el proveedor de imágenes. La prueba servida y las de integración comprueban
  que no hay ninguna solicitud a él.

## 8. Componentes frontend

- `features/visual-templates/`:
  - `visualTemplatesApi`: las 15 operaciones, validadas con el contrato;
  - `VisualTemplatesSection`: Tabla, Cards, búsqueda, filtros y acciones;
  - `CreateTemplateDialog`;
  - `TemplateEditorPage`, con `editor/` (lienzo, lista de capas, propiedades, validación, vista previa y fondo);
  - `layers.ts` (helpers del editor) y `copy.ts`.
- **Cambios aditivos:**
  - ruta `visual/:templateId` en `features/templates`;
  - botón «Crear plantilla» en el detalle de una propuesta aprobada;
  - uso en plantillas en el detalle de un recurso de Mi marca (se bloquea eliminar si hay uso);
  - mensajes de los 5 códigos nuevos en `ui/copy.ts`;
  - texto de «Plantillas del motor».
- **Estilos:** tokens y primitivas existentes (Button dorado principal, secundario y rojo de peligro, Badge, Alert,
  Card, Select, ViewModeToggle, EmptyState, LoadingState, ErrorBanner, Modal), sin colores fijos.
- **Lienzo del editor:** es una ayuda de posición en HTML. Las letras son aproximadas y la referencia es el PNG del
  servidor, como indica la página.

## 9. Pruebas

| Suite | Archivo | Cobertura |
| --- | --- | --- |
| Integración | `modules/visual-templates/visual-templates.int.test.ts` (14) | Conversión local con fondo fijado, capas originales y obligatorias; plantilla de otro tipo de contenido desde la misma propuesta (01G-C-1); rechazo de propuestas no aprobadas, inexistentes y de prompt propio sin confirmación; borradores por revisión, errores como validación, IDs duplicados, límite de capas, revisión vieja; publicación solo válida; inmutabilidad por API y por los triggers de SQLite; nueva versión sin alterar la anterior; archivar, restaurar, descartar y eliminar; recuperación tras reinicio; dependencias de recursos y propuestas; recurso desactivado; fondo de Mi marca; vista previa con valores efectivos, valores ausentes, cambio de estado, idioma, 400 y 404; PNG del motor determinista; calendario de jornada; recurso protegido dibujado sin deformar (píxeles); plantillas del motor intactas; ninguna solicitud de imagen. |
| Unitarias | `modules/visual-templates/visual-templates.test.ts` (11) | Catálogo completo, formas de los valores, nunca inventar (sin fase, hora, marcador parcial), contraste WCAG, validación: obligatorios, geometría, tamaños, bindings, texto largo, recursos, superposiciones, contraste, fondo. |
| Unitarias | `modules/rendering/structured.test.ts` (8), `platform/format/format.test.ts` (+1) | Efectos de la paleta (sombras, brillos, contornos, escala, colores y PNG determinista) y mayúsculas solo en las líneas dibujadas; modelo válido, orden de capas, ajuste, escala, desborde sin cortar, texto vacío, PNG idéntico dos veces, fondo `cover` y logo original por píxeles, hash alterado rechazado; `formatTime`. |
| Contrato | `test/contract/*` | Paridad Zod/OpenAPI de los 31 componentes; muestras y variantes de cada operación; conteos (130 operaciones, 97 rutas, 62 mutadoras, 193 esquemas); cambios registrados del documento; sin palabras de publicación; neutralidad; protección local; un escenario servido de las 15 operaciones con conflictos (`VERSION_CONFLICT`, `TEMPLATE_*`, `PROPOSAL_IN_USE`) y sin solicitudes de imagen. |
| Web | `features/visual-templates/*.test.ts(x)` (32) | Tabla por defecto, Cards, búsqueda y filtros, acciones por estado, crear desde propuesta, elegir otro tipo de contenido (01G-C-1), efecto y mayúsculas (01G-C-2, PD-29), jornadas de cada fase en la vista previa, y confirmación de prompt propio, editor (selección, propiedades, agregar capa, cuerpo de guardado, conflicto), validación, vista previa con imagen y valores, publicar habilitado o no, versión publicada de solo lectura y nueva versión, vacíos y errores. |
| Existentes ajustadas | migraciones, esquema, QA visual, códigos de problema, registro de módulos, Mi marca | Versión 29, tablas, índices y claves; `usage.templates`; módulo `visual-templates`. |

Resultados: ver la sección 13.

## 10. Hallazgo de 01G-B corregido en 01G-C

Tras el commit de cierre de 01G-B, la prueba `scripts/security-checks.test.mjs › secret-scan holds on the committed
tree` falló. Causa: `openai-adapter.test.ts` usaba un valor sintético que empezaba por `sk-` y tenía la forma de una clave de
OpenAI. Antes del commit el archivo no estaba versionado, así que el escaneo no lo veía. No es un secreto.
Se cambió por `edr-test-key-never-echoed` en la misma prueba, sin cambiar su comportamiento.

## 11. Limitaciones

- **Fondo de IA:** no se detectan textos, logos ni personas en la imagen. Se advierte y la revisión es humana.
- **Contraste:** se mide solo contra el fondo, sin las capas de imagen intermedias. Es una advertencia aproximada.
- **Editor:** no reproduce exactamente la tipografía; la vista previa del servidor es la referencia. No hay deshacer,
  ni guías de alineación, ni aviso de cambios sin guardar al salir.
- **Datos que no existen:** no hay sede. Tampoco escudos de equipos: PD-03 sigue vigente en 01G-C. La decisión PD-28
  (2026-11-06) los habilita subidos a mano en la fase 01G-D. Allí se agregarán los campos de escudo al catálogo, como
  capas de imagen ligadas al equipo.
- **Valores obligatorios:** en la vista previa son errores informativos; bloquear una generación es 01G-D.
- **Formato:** BR-08 fija 1080 x 1350 para los carruseles. Las plantillas 1:1 y 9:16 se crean y previsualizan, pero
  usarlas en proyectos requiere una decisión en 01G-D.
- **Dependencia de 01G-D:** los bindings se resuelven hoy desde Competiciones. Para los proyectos, 01G-D debe
  resolverlos desde el texto guardado de cada diapositiva (columna «Campo de diapositiva» del catálogo), para que el QA
  visual siga comparando con los hechos.
- **Fuente de verdad:** no se registró ninguna decisión nueva. Las de 01G-C están en este informe, pendientes de
  aceptación.

## 12. Validación manual

1. Inicia con `npm run dev`; no hace falta la clave de OpenAI.
   - Al arrancar, la base pasa a la versión 29: el servidor de desarrollo ya la aplicó el 2026-11-06, con el DDL
     comprobado igual al archivo.
   - Necesitas una propuesta aprobada de 01G-B y, para la vista previa, datos locales en Competiciones (competición,
     temporada, jornada y partido).
2. Abre **Plantillas**: se abre la sub-opción **Crear plantilla**. La sección «Plantillas visuales» aparece primero, en
   Tabla. Prueba Cards, la búsqueda y los filtros. La sub-opción **Plantillas del motor** muestra solo las plantillas del
   motor.
3. Pulsa **Crear plantilla**.
   - Solo aparecen propuestas aprobadas.
   - Elige una guiada y pon nombre y categoría.
   - Con una de prompt propio, el botón queda deshabilitado hasta marcar la confirmación.
   - Con una propuesta de «Previa individual», elige «Resultados» en «Tipo de contenido de la plantilla»: aparece el
     aviso sobre el fondo, y la plantilla nace con las capas Equipo local, Equipo visitante y Marcador. El marcador se
     ve en la vista previa solo con un partido finalizado.
4. En el editor:
   - comprueba que el logotipo o Ketsi de la propuesta son capas en su caja, y que existen las capas de equipo local
     y visitante;
   - agrega un Texto («PREVIA»), un Dato deportivo «Fecha» y el Logotipo oficial;
   - arrastra una capa, cambia X, Y, ancho y alto, sube y baja el orden, y oculta una capa;
   - en una capa de imagen protegida, el ajuste solo ofrece «contain».
5. Pulsa **Guardar**, sal y vuelve: el borrador se conserva. El panel de validación muestra errores y advertencias, y
   al pulsar uno se selecciona su capa.
6. **Previsualizar**: elige la competición, la temporada, la jornada y el partido.
   - La imagen es el PNG del motor.
   - Los valores coinciden con Competiciones; un dato sin valor aparece como «Sin dato».
   - Cambia el idioma a inglés: la fecha y el estado cambian.
7. **Publicar**: está deshabilitado con errores o cambios sin guardar. Publica: la versión pasa a solo lectura.
8. **Crear nueva versión**:
   - edita el borrador nuevo;
   - comprueba con «Versión» que la publicada no cambió.
   - «Descartar borrador» lo elimina.
9. **Archivar** y **Restaurar** la plantilla. **Eliminar** solo aparece en una plantilla nunca publicada.
10. **Dependencias**:
    - en Mi marca, el detalle del logotipo muestra el uso en plantillas y no deja eliminarlo;
    - en Propuestas, eliminar la propuesta base responde que está en uso.
11. **Costo:** en «Propuestas visuales con IA», el uso del día no cambió durante los pasos anteriores.

## 13. Resultados de verificación

Ejecución final sobre el estado de la rama (2026-11-09):

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto. |
| ESLint (`--max-warnings 0`, todo el repositorio) | Correcto. |
| Prettier | Correcto en los archivos de la fase. `prettier --check .` solo señala los 3 archivos que ya venían así antes de 01G-B (`errors.ts`, `respond.ts`, `import-preview.int.test.ts`); no se tocaron. |
| `vitest --project unit` | 1760 pruebas, todas correctas (antes 1740). |
| `vitest --project unit-web` | 646 pruebas: 644 correctas y las 2 fallas previas de breadcrumbs (`App.test.tsx`, `ReviewPage.test.tsx`), las mismas de 01G-B. |
| `vitest --project integration` | 664 pruebas, todas correctas (antes 650). |
| `vitest --project contract` | 2261 pruebas, todas correctas (antes 1974). |
| `npm run build` | Correcto. |
| `git diff --check` | Sin observaciones. |
| `scripts/security-checks.mjs secret-scan` y `hygiene` | PASS. Los archivos nuevos sin versionar se revisaron aparte con los mismos patrones de claves: sin hallazgos. |
| `npm run test:e2e` | 12 fallas y 5 correctas. **Fallas previas, ajenas a 01G-C:** la suite espera la interfaz anterior a 01E y 01G-A (6 enlaces en el menú en lugar de 8, el título «Marca y plantillas», `/projects/new`, `/brand#brand-templates-title`). 01G-C no cambió el shell, proyectos, competiciones, revisión ni importaciones; ninguna falla toca Plantillas visuales. |
| `npm run test:a11y` | 5 fallas, 12 correctas y 16 sin ejecutar, porque la preparación compartida falla por la misma causa. La página de Plantillas no llegó a revisarse con axe. |

Base de datos de desarrollo: el servidor en modo watch aplicó la migración 0029 al arrancar con estos cambios. El DDL
real se comparó en solo lectura (copia con WAL) con el del archivo y es idéntico; no hay plantillas creadas.

No se probó la interfaz en un navegador: el editor y la vista previa se cubren con las pruebas web y con el escenario
servido del contrato, que recorre las 15 operaciones sobre la aplicación en ejecución.

## 14. Estado Git

- Rama `work/PD-ARCH-01G-C`, creada desde `9da113b11f572fcf062d950546a9cf4182a481fe` (cierre de 01G-B en
  `work/PD-ARCH-01G-B`).
- Cerrada con un commit tras la aceptación del Product Owner del 2026-11-09; su hash queda en el
  [índice de la fase](./README.md). Sin merge, push ni deploy.
