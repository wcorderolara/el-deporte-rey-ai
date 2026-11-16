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

## 15. Refinamiento UX/UI del editor de plantillas (2026-11-09)

Refinamiento visual del editor de 01G-C pedido por el Product Owner. No es una fase nueva ni cambia el alcance de
01G-D. 01G-C ya estaba cerrada con su commit, así que el cambio está en el árbol de trabajo de `work/PD-ARCH-01G-D`,
**sin commit** y pendiente de aceptación, junto con los cambios de 01G-D, que se conservan.

- **Solo frontend:** no cambian el backend, los contratos, las migraciones, el renderizador ni las reglas de versionado,
  validación y publicación.
- **Referencias de diseño:** las dos capturas de Google Stitch citadas en el pedido no llegaron con el mensaje. Se
  siguió la descripción escrita del pedido y, como referencia visual, las pantallas de editor del archivo
  `docs/design/stitch_el_deporte_rey_studio.zip`, sin copiar sus datos ni sus funciones inexistentes.
- **Pedido adicional:** «Crear plantilla» (`/templates/create`) muestra dos pestañas, «Plantillas visuales» y
  «Propuestas visuales con IA».

### 15.1 Problemas de la versión anterior

- **Ocupación del espacio:**
  - todo cabía en una sola columna larga;
  - el lienzo ocupaba la mitad del ancho y la página entera se desplazaba;
  - la lista de validaciones y la vista previa quedaban debajo del lienzo, lejos de las capas.
- **Agregar capas:** había siete botones «＋ …» siempre visibles.
- **Lista de capas:**
  - cada capa era una tarjeta con borde y cuatro botones de 44 px;
  - el orden era el inverso del habitual (la primera fila quedaba al fondo).
- **Propiedades:** formaban una sola columna larga, sin grupos plegables y con controles de otros tipos.
- **Bindings:** se elegía el dato, pero no se veía su campo ni el valor que tomaba con datos reales.
- **Vista previa:**
  - era una sección más al pie de la página;
  - el botón «Previsualizar» de la lista hacía un desplazamiento automático hasta ella.
- **Acciones:** «Publicar versión», «Editar datos», el selector de versión y los avisos competían en la cabecera.

### 15.2 Nueva estructura

`TemplateEditorPage` ocupa el alto disponible de la ventana: `editor/layout.ts` mide desde el borde superior del
editor. La página no se desplaza y cada panel maneja su propio desbordamiento. La ruta del editor usa la variante
`workspace` del marco (`contentVariantOf`):

- ancho completo y márgenes estrechos;
- sin la cabecera de página, porque la barra del editor ya nombra la plantilla.

| Zona | Componente | Contenido |
| --- | --- | --- |
| Barra superior | `editor/EditorToolbar.tsx` | Volver a Plantillas; tipo y formato; nombre completo (truncado, con tooltip; el lápiz abre «Editar el nombre y los datos»); estado de la plantilla; versión (selector si hay varias); «Cambios sin guardar» / «Guardado · fecha» / «Solo lectura»; pestañas Diseño / Vista previa; indicador de validación; Guardar borrador; Publicar plantilla (única acción de publicación) o Crear nueva versión; menú ⋮ con «Descartar borrador» cuando aplica. Sin deshacer ni rehacer: no existen. |
| Panel izquierdo (17,5 rem, plegable) | pestañas `Capas` / `Recursos` | Capas: botón-menú «Agregar capa» (texto, dato deportivo, imagen de Mi marca, logotipo, Ketsi y, en plantillas de partido, escudo local y visitante) y `editor/LayerList.tsx`. Recursos: `editor/ResourcesPanel.tsx`. |
| Centro | `editor/Workspace.tsx` + `EditorCanvas` | Barra de zoom (alejar, porcentaje, acercar, «Ajustar», «100 %», «Guías», tamaño en px), lienzo centrado y nota de uso. |
| Panel derecho (18–21 rem, plegable) | `LayerProperties` / `editor/CanvasProperties.tsx` | Propiedades de la capa seleccionada o, sin selección, del fondo y del lienzo. |
| Modo Vista previa | `editor/PreviewPanel.tsx` | Contexto deportivo / imagen del motor / datos vinculados y observaciones. |

Piezas nuevas compartidas:

- `editor/Section.tsx`: grupo plegable con `aria-expanded`.
- `ValidationIndicator` (en `ValidationPanel.tsx`): indicador compacto y panel desplegable.
- `ActionMenu` admite:
  - un disparador con texto («Agregar capa»);
  - una variante compacta para filas densas;
  - icono y tooltip por opción;
  - alineación a la izquierda.
- `Icon`: iconos nuevos (tipos de capa, visibilidad, bloqueo, zoom, alerta).

### 15.3 Cambios implementados

- **Capas:**
  - **Orden:** la primera fila es la capa de delante y el fondo queda al final, fijo y seleccionable.
  - **Filas compactas, sin bordes por capa:** icono del tipo, nombre (y el dato vinculado), botón de visibilidad,
    botón de bloqueo y menú ⋮ con «Traer adelante», «Enviar atrás» y «Eliminar capa».
  - **Selección:** borde dorado izquierdo sobre `surface-overlay`, como la navegación.
  - **Reordenamiento:** con el menú. Arrastrar y soltar no está soportado.
- **Bloqueo:**
  - Es de la sesión de edición y no se guarda: el contrato de capas no tiene ese campo y no se cambió.
  - Una capa bloqueada se selecciona, pero no se mueve en el lienzo ni con el teclado.
  - Sus propiedades quedan deshabilitadas hasta pulsar «Desbloquear».
  - El tooltip y el panel lo explican.
- **Propiedades por tipo,** en grupos plegables:
  - Contenido:
    - etiqueta «Texto fijo» o «Dato vinculado»;
    - texto, o campo del catálogo y estado del binding;
    - casilla «Obligatorio».
  - Tipografía: familia, tamaños, color con muestra, alineaciones, efecto y mayúsculas.
  - Recurso.
  - Ajuste y proporción: proporción del recurso y de la caja, y «Ajustar la caja a la proporción del recurso».
  - Escudo.
  - Posición y tamaño (% y px).
  - Comportamiento: si el texto no cabe, líneas máximas.

  No se muestran controles de otros tipos.
- **Bindings:**
  - **Campo:** el panel muestra el campo real del catálogo (por ejemplo `match.homeTeam.name`).
  - **Valor:** el de la **última vista previa con datos locales**.
  - **Estado:** «Resuelto con datos locales», «Sin dato en la selección», «Sin vista previa todavía», «Cambió tras la
    última vista previa» o «Sin campo».
  - **Overrides:** no existe un override manual de prueba: el contrato de la vista previa no lo admite y no se inventó.
    Se aclara que los valores incluyen las correcciones manuales registradas en Competiciones y que previsualizar no
    cambia ningún dato.
- **Vista previa:**
  - **Modo propio:** está en la barra superior, en la dirección (`?panel=preview`, el mismo parámetro que ya usaba
    «Previsualizar» en la lista).
  - **Al activarla:** se ocultan las herramientas de diseño y la pantalla queda en tres columnas:
    - contexto deportivo (competición, temporada, jornada, partido e idioma, con las consultas existentes y la etiqueta
      «Datos deportivos locales»);
    - imagen del motor («Vista previa actualizada · W × H px» y «Descargar muestra», que descarga el PNG ya generado,
      sin capacidades nuevas);
    - valores resueltos y observaciones.
  - **Al volver a Diseño:** el panel de vista previa sigue montado y oculto, así que se conservan la selección de
    datos y la última imagen. Cambiar de modo no guarda ni descarta nada.
  - **Desde una observación:** elegir una que tenga capa vuelve a Diseño con esa capa seleccionada.
- **Validación:**
  - **Indicador compacto:** muestra «Sin errores», «N errores · M advertencias» y un punto si hay cambios sin
    validar.
  - **Panel:** lista severidad, capa, mensaje del servidor y acción recomendada, fija por código (`issueActionCopy`).
  - **Selección:** elegir una observación selecciona su capa.
  - **Publicación:** se bloquea igual que antes. El motivo está en el tooltip y en la descripción accesible del botón.
- **Zoom:**
  - «Ajustar» (por defecto, como máximo 100 %), «100 %», pasos del 25 % al 200 % y guías de centro y tercios.
  - El zoom cambia solo el ancho en pantalla: las capas siguen en fracciones del lienzo y los cálculos de coordenadas no
    cambian.
  - No hay zonas seguras, porque el motor no las define.
- **Recursos:**
  - **Bibliotecas activas de Mi marca:** logotipos, mascota, elementos gráficos y fondos, con miniatura.
  - **Acciones:** «Agregar» coloca un logotipo, la mascota o un elemento gráfico; «Usar» cambia el fondo; «Cambiar
    fondo» abre el diálogo existente, que también ofrece las propuestas aprobadas.
  - **Escudos:** no se presentan como biblioteca; una nota remite a las capas de escudo.
- **Avisos de solo lectura:** pasan a ser una línea compacta.
- **Responsive:** por debajo de 1280 px el panel izquierdo empieza plegado. Los dos paneles se pliegan y despliegan con
  sus botones.
- **«Crear plantilla»:**
  - **Pestañas:** «Plantillas visuales» y «Propuestas visuales con IA», con el componente `Tabs`.
  - **Dirección:** la pestaña queda en `?tab=proposals`.
  - **Texto del diálogo:** el texto del diálogo de creación remite a esa pestaña.
- **Detalle técnico encontrado al verificar:** la aplicación no carga Preflight.
  - **Bordes:** un `border-solid` aplica 3 px por defecto en los cuatro lados, así que las filas usan `border-0` antes
    del borde izquierdo.
  - **Tipografía de los botones:** la regla global `button { font: inherit }`, fuera de capa, gana a las utilidades de
    tipografía, que por eso se fijan en el contenedor.
  - **`hidden`:** no se combina con utilidades de `display`.

### 15.4 Funcionalidades preservadas

- **Edición:**
  - selección por clic, teclado y observación;
  - arrastre, redimensión y flechas (Mayús: pasos grandes);
  - visibilidad, eliminación y reordenamiento;
  - todos los tipos de capa y bindings, efectos y mayúsculas.
- **Datos de la plantilla y versiones:**
  - fondo (diálogo existente);
  - guardado con revisión y conflicto con «Recargar»;
  - publicación con confirmación, solo lectura de lo publicado o archivado;
  - «Crear nueva versión», «Descartar borrador», selector de versión;
  - datos de la plantilla.
- **Vista previa:**
  - mismas consultas y misma petición: guarda antes si hay cambios;
  - cubre los 6 tipos de 01G-D-3.
- **Fuera del editor:** sin cambios en proyectos, exportaciones, propuestas de 01G-B, recursos de 01G-A ni datos
  deportivos.

### 15.5 Limitaciones

- **Edición:**
  - Sin deshacer ni rehacer: no existían y no se agregaron controles que aparenten funcionar.
  - Sin arrastrar y soltar en la lista de capas.
  - Sin override manual de valores en la vista previa: el contrato no lo admite.
- **Guías:** el bloqueo es solo de la sesión y no hay zonas seguras: el motor no las define.
- **Ancho de pantalla:**
  - Por debajo de 1024 px el marco pasa al menú móvil y el editor queda usable, pero no optimizado.
  - No se hizo una experiencia de edición móvil.
- **Lienzo:** sigue siendo una ayuda de posición; la referencia final es el PNG del motor.

### 15.6 Pruebas y verificación

- **Pruebas actualizadas o nuevas:**
  - `TemplateEditorPage.test.tsx` (20 casos):
    - barra superior (nombre completo, guardado, dimensiones, una sola acción de publicación, sin deshacer);
    - zoom sin cambiar coordenadas;
    - plegado de paneles;
    - selección y propiedades contextuales, con grupos plegables que conservan los valores y binding con campo y
      estado;
    - bloqueo;
    - reordenamiento y eliminación con el menú de la capa;
    - pestaña Recursos;
    - menú «Agregar capa»;
    - escudos;
    - guardado y conflicto;
    - indicador y panel de validación con acción recomendada;
    - modo Vista previa con valores, observaciones y «Descargar muestra», y valor resuelto de vuelta en Diseño;
    - el cambio de modo conserva los cambios sin guardar y no hace peticiones;
    - apertura con `?panel=preview`;
    - portada y cierre;
    - publicación;
    - versión publicada;
    - fallo de carga.
  - `TemplatesPage.test.tsx`: las dos pestañas y la pestaña en la dirección.
  - `VisualTemplatesSection.test.tsx`: la lista en la primera pestaña y la propuesta en la segunda.
  - `App.test.tsx`: la variante `workspace` del editor.
- **Resultados:**
  - TypeScript web sin errores;
  - ESLint sin errores;
  - Prettier sin diferencias en `apps/web/src`;
  - pruebas web 675/677: las 2 que fallan son las de breadcrumbs, preexistentes (`App.test.tsx` y `ReviewPage.test.tsx`);
  - build de producción OK;
  - `git diff --check` OK.
- **Revisión visual:**
  - Capturas reales con Chromium sin interfaz a 1440 × 900, 1280 × 800 y 1024 × 768, sobre el servidor de desarrollo
    del operador y solo con lecturas (no se guardó ni previsualizó nada).
  - La página ya no se desplaza a 1440 y 1280: solo queda fuera el pie de página.
  - Se revisaron el panel de validación, la pestaña Recursos, el modo Vista previa y las dos pestañas de «Crear
    plantilla».
- **Sin llamadas externas:** ninguna prueba llama a OpenAI ni a la red.

### 15.7 Validación manual

1. Con el servidor de desarrollo levantado, abre «Plantillas» → «Crear plantilla»:
   - comprueba las pestañas «Plantillas visuales» y «Propuestas visuales con IA»;
   - recarga en la segunda y comprueba que se mantiene.
2. Abre una plantilla en borrador:
   - la página no se desplaza y el lienzo ocupa el centro;
   - prueba «Ajustar», «100 %», acercar, alejar y «Guías».
3. En «Capas»:
   - agrega capas con «Agregar capa»;
   - ocúltalas, bloquéalas, tráelas adelante o envíalas atrás con el menú ⋮, y elimínalas;
   - comprueba que una capa bloqueada no se mueve ni se edita.
4. Selecciona un dato deportivo:
   - comprueba «Dato vinculado», el campo y el estado «Sin vista previa todavía»;
   - pliega y despliega los grupos.
5. Pulsa «Vista previa»:
   - elige competición, temporada, jornada y partido, y pulsa «Previsualizar»;
   - comprueba la imagen, los valores, las observaciones y «Descargar muestra».
6. Vuelve a «Diseño»:
   - los cambios sin guardar siguen;
   - el dato seleccionado muestra el valor resuelto.
7. Abre el indicador de validación:
   - elige una observación con capa y comprueba que se selecciona.
8. Comprueba la publicación:
   - con errores, «Publicar plantilla» está deshabilitado y su tooltip explica el motivo;
   - sin errores ni cambios, publica y comprueba el modo solo lectura.
9. Achica la ventana a 1280 y 1024 px:
   - pliega y despliega los paneles;
   - comprueba que no hay desplazamiento horizontal.

### 15.8 Estado Git

- El cambio está en el árbol de trabajo de `work/PD-ARCH-01G-D`, sin commit y junto con los cambios pendientes de
  01G-D.
- Pendiente de aceptación del Product Owner. Sin merge, push ni deploy.
