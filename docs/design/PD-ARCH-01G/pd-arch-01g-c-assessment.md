# PD-ARCH-01G-C — Assessment arquitectónico: plantillas visuales estructuradas

Hecho el 2026-11-06 sobre `work/PD-ARCH-01G-C`, creada desde el cierre de 01G-B
(`9da113b11f572fcf062d950546a9cf4182a481fe`), antes de implementar.

## 1. Lo que existe

| Pieza | Estado actual | Archivo |
| --- | --- | --- |
| Plantillas del motor | Código versionado (`id@version`) por tipo de diapositiva; el registro toma la última versión de cada tipo. Construyen un `RenderModel` desde el texto guardado de la diapositiva. No son editables. | `modules/rendering/templates/*` |
| Modelo de render | Documento cerrado (`edr.render-model` v1): lienzo, paleta, 3 fuentes y elementos `text`, `rect`, `image` (solo los espacios `brand_logo` y `mascot`, `contain`) y `badge_slot` (siempre vacío, PD-03). | `modules/rendering/render-model.ts` |
| Renderizador | Satori (sin `loadAdditionalAsset`) + resvg con las fuentes empaquetadas; imágenes solo como `data:` de bytes verificados por hash; determinista (R-213). | `modules/rendering/renderer.ts` |
| Maquetación de texto | `fitText`/`layoutText` con las mismas fuentes; el texto que no cabe marca `overflow` y nada se corta en silencio. | `modules/rendering/layout.ts` |
| Fuentes | 3 roles: títulos Montserrat 800, cuerpo Inter 400, numérico Inter 700. No hay otras caras ni otros pesos. | `modules/rendering/fonts.ts`, `config/brand.json` |
| Colores | Solo los 5 roles de la paleta (OD-07). | `config/brand.json` |
| Vista previa del motor | PNG con datos sintéticos, en caché. | `modules/rendering/preview.ts` |
| Propuestas 01G-B | Fondo generado guardado aparte (`background_file_path`) y capas originales en píxeles (`layers_json`); archivos en `design-proposals/` con el almacén confinado de marca y hash. Eliminación lógica. | `modules/design/*`, migraciones 0025–0028 |
| Biblioteca de marca | Recursos con política (`protected`, `reference_only`, `reusable`, `transformable`), oficial, principal, activo; lectura con verificación de hash; eliminación lógica rechazada si diapositivas renderizadas usan el recurso. | `modules/brand/*` |
| Datos deportivos locales | Valores efectivos (datos manuales, importaciones confirmadas y overrides protegidos) leídos de las tablas operativas; `ContentBatchRepository.context()` y `seasonMatches()` son la lectura que usa la generación de 01E. | `modules/projects/content-batches/repository.ts` |
| Proyectos | Datos locales → importación congelada → hechos → texto guardado con segmentos de procedencia → plantilla del motor → render → QA visual → revisión y exportación. | `modules/projects`, `content`, `rendering`, `visual-qa` |
| Interfaz | Plantillas (`/templates`): «Propuestas visuales con IA» (Tabla por defecto, Cards, filtros) y «Plantillas del motor». Primitivas y tokens Tailwind (`ui/primitives`, `ui/tokens.css`). | `apps/web/src/features/{brand,design,templates}` |

Lo que no existe: plantillas persistidas o editables, capas definidas por el usuario, imágenes de fondo en el modelo de
render, ajuste `cover`, recursos de marca que no sean el logo o la mascota principal, hora del partido como texto, y
cualquier relación entre una propuesta y una plantilla.

## 2. Datos deportivos reales (catálogo de bindings)

Los contratos de Competiciones tienen: competición (`name`), temporada (`label`), fase (`name`, opcional), jornada
(`name`, opcional), partido (`homeTeam.name`, `awayTeam.name`, `kickoffAt`, `status`, `homeScore`, `awayScore`).
**No existen** sede (`venue`) ni escudos de equipo: PD-03 y R-231 prohíben logos de equipos no autorizados, y los
espacios de escudo están siempre vacíos. Por eso el catálogo no incluye `match.venue` ni `match.homeTeam.logo`.

Catálogo cerrado (constante del contrato, nunca una expresión):

| Binding | Tipos de contenido | Forma mostrada (la de 01E) | Campo de diapositiva (01G-D) |
| --- | --- | --- | --- |
| `competition.name` | todos | nombre | `footer` (parte) |
| `season.label` | todos | etiqueta (`2026/27`) | `footer` (parte) |
| `stage.name` | todos | nombre; falta si la jornada no tiene fase | — |
| `round.name` | todos | nombre; falta si el partido no tiene jornada | — |
| `match.homeTeam.name`, `match.awayTeam.name` | previa, partido programado, resultado | nombre oficial exacto | `team_home`, `team_away` |
| `match.kickoffDate` | previa, partido programado, resultado | `formatDate` (`27 oct 2026`) | `kickoff` |
| `match.kickoffTime` | previa, partido programado, resultado | `HH:MM` a la hora de visualización | — |
| `match.status` | previa, partido programado, resultado | etiqueta de estado de 01E-B | `match_status` |
| `match.score`, `match.homeScore`, `match.awayScore` | resultado | `formatScore` / entero; falta si no hay marcador | `score` |
| `round.fixtures` | calendario de jornada | una línea por partido: `Local vs Visitante · fecha` | `fixtures` |

Un binding sin valor (sin fase, sin hora, sin marcador) no se inventa: la capa no se dibuja y la vista previa lo
informa; si la capa es obligatoria, la vista previa lo marca como error.

## 3. Decisiones técnicas

| # | Decisión | Motivo |
| --- | --- | --- |
| D1 | **Un solo motor.** La plantilla estructurada se convierte en el mismo `RenderModel` y se dibuja con `renderSlide`. Se extiende el modelo de forma aditiva: `image.slot` admite `background` y `layer`, y `image.fit` opcional (`contain` por defecto, `cover`, `fill`). Los modelos ya guardados siguen siendo válidos y se dibujan igual. | «No crees un segundo motor»; vista previa = salida final. |
| D2 | **Módulo `visual-templates`** con tablas propias (`visual_templates`, `visual_template_versions`, migración 0029). Coexiste con las plantillas del motor, que no cambian. | Plantillas de código versionadas por tipo (OD-13) y plantillas de usuario son cosas distintas; 01G-D elegirá entre ellas. |
| D3 | **Tipos de capa:** fondo (campo único de la versión, a lienzo completo con `cover`), `image` (elementos gráficos y fondos de Mi marca), `brand_asset` (logotipo y mascota, siempre proporcional), `text` (texto fijo) y `sports_data` (texto con binding). `text` y `sports_data` comparten el estilo. | Los cinco tipos pedidos; el fondo no se mueve ni se apila, por eso es un campo. |
| D4 | **Coordenadas normalizadas** (fracciones 0–1 del lienzo, 4 decimales) y tamaño de letra en píxeles del lienzo de la versión, escalado como en las plantillas del motor. Apilamiento = orden de la lista (abajo → arriba). | Adaptable a otras resoluciones; sin `zIndex` duplicado que pueda contradecir el orden. |
| D5 | **Tipografía y color cerrados:** rol de fuente (familia y peso los da la cara empaquetada) y rol de paleta. Tamaño máximo, mínimo, líneas, alineación horizontal y vertical, y política de desborde `shrink` (reduce hasta el mínimo) o `fixed`. Nunca se corta texto: el desborde es un error visible. | El renderizador solo tiene esas caras y colores (OD-07, AD-07); un nombre oficial no se recorta (BR-05). |
| D6 | **Fondo por referencia, sin copia:** `design_proposal` (fondo limpio de la propuesta) o `brand_asset` (categoría Fondos de Mi marca), con su hash fijado. Se leen de sus almacenes confinados con verificación de hash. | Sin segundo almacenamiento; trazable. |
| D7 | **Dependencias:** no se puede eliminar un recurso de marca ni una propuesta que use una plantilla no eliminada (`ASSET_IN_USE`, `PROPOSAL_IN_USE`); desactivar sigue permitido y la validación lo marca. | Un recurso publicado debe seguir dibujándose y ser trazable (regla 7). |
| D8 | **Origen:** solo propuestas aprobadas y no eliminadas. Las de modo guiado avisan de que el modelo pudo no dejar vacías las zonas. Las de prompt propio pueden contener textos, personas, logos o una Ketsi generada: se aceptan solo con confirmación explícita y quedan con una advertencia permanente. | 01G-B dejó esta decisión para 01G-C; el encargo pide advertir y permitir otro fondo. |
| D9 | **Ciclo de vida:** plantilla `draft` → `published` → `archived` (y restaurar); versión `draft` → `published` (inmutable, también por un trigger de SQLite). Un solo borrador por plantilla; «Crear nueva versión» copia la última publicada. Eliminar solo una plantilla nunca publicada (lógica); con versiones publicadas se archiva. | Las versiones publicadas no se mutan; 01G-D registrará la versión usada por cada proyecto. |
| D10 | **Vista previa con datos locales:** el usuario elige competición, temporada, jornada y partido existentes; el servidor resuelve el catálogo con las lecturas de 01E y dibuja con el motor. JSON de resolución y PNG por URL (la CSP de la app no admite `data:`). | Mismos valores efectivos que la generación; sin datos inventados. |
| D11 | **Validación** en el servidor, con errores (impiden publicar) y advertencias (decide el usuario); el contraste se mide sobre el fondo rasterizado bajo cada caja. | Determinista y repetible; sin garantía de calidad perfecta. |
| D12 | **Sin OpenAI:** convertir, editar, validar, previsualizar y publicar son locales. El módulo no usa el proveedor de imágenes. | PD-27 cubre solo 01G-B. |

## 4. Riesgos

- **El fondo de IA no es limpio:** puede tener texto, personas o una mascota generada. Mitigación: advertencias y
  confirmación (D8); el usuario puede cambiar el fondo por otra propuesta aprobada o por un fondo de Mi marca.
- **Diferencias editor/salida:** el lienzo del editor es una ayuda de posición en HTML; la referencia es la vista
  previa del servidor, que sí usa el motor.
- **Contraste aproximado:** se compara con el color medio del fondo bajo la caja; un fondo con mucho detalle puede
  engañar. Es una advertencia, no un bloqueo.
- **Texto variable:** un nombre largo puede no caber. La validación prueba cada binding con un valor de estrés
  sintético (advertencia) y la vista previa con el dato real (error).
- **Formato:** BR-08 fija 1080 x 1350 para los carruseles. Las plantillas 1:1 y 9:16 se pueden crear y previsualizar,
  pero usarlas en proyectos (01G-D) necesita una decisión del Product Owner.

## 5. Dependencias para 01G-D

- Elegir plantilla y versión publicada en `/projects/generate` y registrar `{templateId, versionId, version}` en el
  proyecto (el contrato `VisualTemplateVersionRef` queda definido, sin usarse todavía).
- Resolver los bindings desde el texto guardado de la diapositiva (columna «Campo de diapositiva» del catálogo), para
  que el QA visual siga comparando con los hechos. `match.kickoffTime`, `stage.name` y `round.name` no tienen hoy un
  campo de diapositiva: 01G-D debe agregarlo o excluirlos.
- Decidir los formatos admitidos en carruseles (BR-08) y qué hacer con plantillas cuyos recursos se desactivaron
  después de publicarse.

## 6. Migraciones

Solo una, aditiva: `0029_visual_templates.sql` (dos tablas, índices y el trigger de inmutabilidad). No se modifica
ninguna migración anterior ni ninguna tabla existente.
