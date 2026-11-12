# PD-ARCH-01G-E.2 — Informe de implementación: calendarios de jornada por filas con escudos

## Estado

- **Implementado el 2026-11-12 en `work/PD-ARCH-01G-E` y aprobado por el Product Owner el mismo día**, tras su
  revisión manual y funcional. **01G-E: CLOSED — PRODUCT OWNER ACCEPTED.**
- Empezó después de que el Product Owner aceptara E.1 ese mismo día («E.1 queda aceptada, sigue con E.2»).
- Commits: E.1 en `7dfbde3` y E.2 en `066bdad`; el cierre documental, en el commit que registra este estado
  (sección 15).
- Base: `7a4c9f1`. Los commits `3538af1`, `3359476` y `7a4c9f1` no se reescribieron.
- Nada de E.2 llama a OpenAI, a un proveedor deportivo ni a la red. No hay migración.

## Decisiones aplicadas (PD-32)

| Decisión | Cómo se aplica en E.2 |
| --- | --- |
| DE-E3 | Los proyectos anteriores conservan sus páginas, la versión de plantilla y el PNG (sección 7). |
| DE-E4 | Un equipo sin escudo deja su espacio vacío, conserva el nombre y la revisión muestra la advertencia de QA que ya existía, ahora con el partido. Sin banners nuevos. |
| DE-E5 | Seis partidos por diapositiva de 1080 x 1350, confirmado con una prueba visual (sección 1). Con más partidos hay más diapositivas; el calendario nunca se sustituye por un bloque de texto. |
| DE-E6 | Cada fila: escudo y nombre del local, fecha y hora, estado cuando el partido no está «Programado», nombre y escudo del visitante. El calendario del motor y las plantillas visuales usan el mismo modelo. |
| PD-28 | Solo escudos subidos a mano, del snapshot del proyecto, por la identidad local del equipo y dibujados desde su archivo con el hash comprobado. |

## 1. Prueba visual de DE-E5

Antes de implementar el resto se dibujó la plantilla del motor 2.0.0 con datos sintéticos difíciles:

- seis partidos con nombres largos («Real Sociedad Deportiva Ejemplo», «Unión Deportiva Muestra del Norte»);
- nombres casi iguales («Club Deportivo Ejemplo» y «Club Deportivo Ejemplo B»);
- un partido aplazado y otro suspendido;
- un equipo sin escudo;
- escudos de proporción 4:1 y JPEG;
- con y sin la banda de demostración.

Resultado:

- Los seis partidos caben. Los nombres largos usan dos líneas sin desbordarse.
- El estado se lee bajo la hora, y el espacio del equipo sin escudo queda vacío con el nombre visible.
- Queda margen antes del titular.
- Siete filas no caben sin invadir el titular o bajar el tamaño de los escudos y de la letra.

Por eso el criterio inicial de seis se confirma. Las imágenes de la prueba no se guardaron en el repositorio. La prueba
automática «fits six rows with long names» comprueba lo mismo: sin desbordes, dentro del lienzo, sin solapes y por
encima del titular.

## 2. Qué hace E.2

- **Proyectos nuevos de calendario:** el contenido parte los partidos en páginas de seis (antes, ocho). Cada línea
  guarda también la hora del partido y, si no está programado, su estado.
- **Calendario del motor:** versión 2.0.0. Dibuja una fila por partido con los dos escudos del snapshot del proyecto.
- **Plantillas visuales de calendario:** tienen una capa nueva, «Lista de partidos». El operador diseña una fila en el
  editor y el motor la repite por cada partido de la diapositiva.
- **QA:** compara cada valor de cada fila con su hecho. La advertencia `team_badges` indica el partido y el lado de cada
  escudo vacío.
- **Sin cambios:** la portada, el cierre, las diapositivas de partido, la exportación y el flujo de aprobación.

## 3. Calendario del motor 2.0.0

- `rendering/templates/round-overview.ts` tiene dos versiones registradas. La 1.0.0 es la de siempre, una línea de
  texto por partido; es idéntica byte a byte a la de `7a4c9f1` (sección 7). La 2.0.0 dibuja filas.
- **Fila de la 2.0.0** (diseño de referencia de 1080 x 1350):
  - banda de 104 px con 10 px entre filas, desde y = 326, así que las seis filas acaban en y = 998;
  - escudos de 80 x 80 a los lados;
  - nombres de hasta dos líneas, alineados hacia el centro;
  - en el centro, la fecha, la hora y el estado;
  - el título, el titular, la descripción y el logotipo no cambian.
- **Elementos del modelo de render:**
  - cada valor de una fila es su propio elemento de texto: `row-N-home`, `row-N-away`, `row-N-date`, `row-N-time` y
    `row-N-status`, con la semántica `team_name`, `kickoff`, `kickoff_time` o `match_status`;
  - cada escudo es un espacio `badge_slot` con `row: N`, el equipo y el escudo, como en E.1.
- **Una séptima fila** no se descarta: se dibuja debajo, marcada como desbordada, y el QA de ajuste de texto la
  bloquea. El contenido nunca la genera.
- `TemplateDefinition.rows` declara las filas. El contrato `Template.badgeSlots` de esta plantilla vale 12 (seis filas
  de dos), y «Plantillas del motor» lo muestra con el texto que ya existía.
- El registro elige la versión con `forContent`: la última versión del tipo que no dibuja escudos o que dibuja los que
  la diapositiva tiene (`badges` de E.1 o `rowBadges` de E.2).
- La vista previa del motor (datos sintéticos) muestra la hora y un partido aplazado. Igual que en E.1, no muestra
  escudos reales.

## 4. Capa «Lista de partidos» de las plantillas visuales

**Contrato** (aditivo): `VisualTemplateFixtureListLayer`, con `type: 'fixture_list'`.

- La caja de la capa es la primera fila, en fracciones del lienzo.
- `rowGap` es el espacio entre filas, en fracción del alto del lienzo.
- `row` tiene siete partes: `homeBadge`, `homeName`, `kickoffDate`, `kickoffTime`, `status`, `awayName` y `awayBadge`.
  Cada parte tiene su caja en fracciones de la fila y `visible`; las de texto, también su estilo.
- Una lista dibuja como máximo seis filas (`VISUAL_TEMPLATE_FIXTURE_LIST_ROWS`).

**Validación** (`visual-templates/validation.ts`, con la geometría compartida en `fixture-list.ts`). La lista cumple el
requisito `round.fixtures` del calendario. No hay códigos de incidencia nuevos.

- Errores que impiden publicar:
  - la lista fuera de un calendario, o una segunda lista;
  - las seis filas no caben en el lienzo;
  - una parte que sale de su fila o es demasiado pequeña;
  - un nombre oculto (PD-28 punto 4);
  - un tamaño mínimo de letra mayor que el máximo.
- Advertencias:
  - un valor largo que puede no caber;
  - un contraste bajo en alguna fila, una vez por parte;
  - partes de la fila superpuestas.

**Composición** (`compose.ts`):

- Cada fila se dibuja en orden.
- Un escudo ausente se omite con una advertencia que nombra el partido y el lado.
- Un nombre ausente es un error.
- El estado solo aparece si el partido tiene uno que mostrar.
- Más de seis partidos es un error; nunca se descarta una fila en silencio.

**De dónde salen los datos:**

| Uso | Valores | Escudos |
| --- | --- | --- |
| En un proyecto | Las líneas guardadas de la página, con sus hechos | Los del snapshot, por la identidad de cada equipo |
| Vista previa del editor | La primera página de la jornada elegida en Competiciones | Los escudos activos, por el ID local del equipo |

**Editor web** (`apps/web/src/features/visual-templates/`):

- «Agregar capa» ofrece «Lista de partidos» solo en plantillas de calendario y solo si la versión no tiene una lista.
- **Valores iniciales:** reproducen la fila del calendario del motor 2.0.0.
- **Lienzo:** la primera fila se mueve y redimensiona como cualquier capa. Las filas 2 a 6 y las partes de la fila se
  dibujan como contornos.
- **Propiedades:**
  - «Espacio entre filas»;
  - una sección por parte con X, Y, Ancho y Alto en porcentaje de la fila, y «Visible» (salvo los nombres);
  - para las partes de texto, los mismos controles de estilo de las capas de texto, extraídos sin cambios a
    `editor/TextStyleControls.tsx`.

## 5. Paginación y contenido

- `content/structure.ts`: `CALENDAR_ROWS_PER_SLIDE = 6` para los calendarios con filas, y
  `OVERVIEW_ROWS_PER_SLIDE = 8` para los demás. El orden de los partidos no cambia.
- `content/compose.ts`: con filas, cada línea guarda, en este orden, el nombre del local, el nombre del visitante, la
  fecha, la hora y, si el partido no está programado, el estado. Todos son segmentos de hecho. El renderer los lee por
  ese orden (`fixtureRowsOf`).
- El contenido sabe si el proyecto tiene filas por la versión de su snapshot de escudos (`calendarRows`, como
  `templateFields` de 01G-D). La regeneración de una página usa la misma paginación del proyecto.
- El motor editorial (01H) no cambia: no usa las páginas del calendario.

## 6. Cómo se elige cada escudo

- El equipo de cada fila sale del segmento de hecho de su nombre y sigue la cadena: hecho, evidencia y observación
  local, cuyo `teamKey` es el ID local del equipo (`slideTeams`, ahora con `rows`). Es la misma cadena de E.1 y
  01G-D. **Nunca se comparan nombres.**
- El escudo es el del snapshot guardado al crear el proyecto. Durante el render no se consulta a ningún proveedor.
- Las pruebas usan nombres casi iguales y los mismos equipos con los lados invertidos.

## 7. Proyectos anteriores

El snapshot de escudos tiene una **versión 3** (`projects/badge-snapshot.ts`) que marca los proyectos creados desde
E.2. La columna acepta cualquier objeto JSON, así que no hace falta migración.

| Snapshot del proyecto | Páginas del calendario | Calendario del motor | Partidos del motor |
| --- | --- | --- | --- |
| Ninguno o versión 1 (01G-D) | 8 | 1.0.0, texto | 1.0.0 |
| Versión 2 (E.1) | 8 | 1.0.0, texto | 1.1.0, con escudos |
| Versión 3 (E.2) | 6 | 2.0.0, filas con escudos | 1.1.0, con escudos |

- La 1.0.0 del calendario da el mismo PNG y el mismo modelo que `7a4c9f1`, comprobado byte a byte con dos y con ocho
  partidos. Esos hashes están en las pruebas.
- **Base de datos real** (leída en una copia): 11 proyectos, uno de calendario sin snapshot, cinco sin snapshot y cinco
  con la versión 1. Ninguno cambia. E.2 no aplica ninguna migración; la última sigue siendo la 0035 de E.1.

## 8. Contrato

Cambios aditivos en `contracts/http-api.openapi.yaml` y `packages/contracts`:

- tres esquemas nuevos: `VisualTemplateFixtureRowBadge`, `VisualTemplateFixtureRowText` y
  `VisualTemplateFixtureListLayer`;
- una variante nueva de `VisualTemplateLayer`;
- el detalle opcional `emptyRowBadgeSlots` del resultado `team_badges`, una lista de `{ row, slot }`, como mucho 128.

Contract Safety:

| Condición | Resultado |
| --- | --- |
| CS-1: sin operaciones, rutas ni campos eliminados | Se cumple. |
| CS-2: sin cambios de tipo ni de obligatoriedad de lo existente | Se cumple. `emptyRowBadgeSlots` es opcional y solo aparece en los calendarios con filas. |
| CS-3: las respuestas anteriores siguen siendo válidas | Se cumple. Las versiones de plantilla guardadas antes siguen validando y dibujando igual. |
| CS-4: el único cliente se actualiza a la vez | Se cumple. La interfaz incluida entiende la capa nueva y el detalle por fila. |
| CS-5: pruebas de contrato | 2418/2418. Paridad Zod, muestras y deltas registrados (214 esquemas). |

El hash registrado en `.orchestrate/config.json` sigue desactualizado desde fases anteriores (DEP-4). Se actualiza al
cierre del bloque.

## 9. QA

- **`data_match` y `team_names`:** comparan cada fecha, hora, estado y nombre de cada fila con su hecho, tanto en el
  calendario del motor como en la lista de una plantilla visual.
- **`text_fit`:** mide cada valor por separado.
- **`team_badges`:** examina los espacios con fila del calendario del motor.
  - Detalle: `{ emptyBadgeSlots: [], emptyRowBadgeSlots: [{ row: 2, slot: 'team-badge-away' }] }`.
  - La revisión muestra «Escudos de equipo — Sin escudo: partido 2 (equipo visitante)».
  - Sigue siendo una advertencia que se confirma antes de aprobar (OD-09).
  - Los calendarios sin filas no tienen espacios y pasan como antes.
- **Plantillas visuales:** como en 01G-D, un escudo ausente en una lista solo deja una advertencia de composición
  (`VALUE_MISSING`), no una advertencia de QA del proyecto.

## 10. Migración

Ninguna.

## 11. Archivos

Principales del servidor:

- `rendering/templates/round-overview.ts`, `common.ts`, `registry.ts`, `core.ts`, `stage.ts`, `render-model.ts`,
  `slide-content.ts` y `preview.ts`;
- `content/structure.ts`, `compose.ts`, `core.ts`, `regenerate.ts`, `repository.ts`, `request.ts`, `schemas.ts` y
  `stage.ts`;
- `projects/badge-snapshot.ts`;
- `visual-templates/fixture-list.ts` (nuevo), `validation.ts`, `compose.ts`, `project.ts` y `service.ts`;
- `visual-qa/core.ts`.

Web:

- `features/review/QaResults.tsx` y `copy.ts`;
- `features/visual-templates/layers.ts`, `copy.ts` y `TemplateEditorPage.tsx`;
- `editor/EditorCanvas.tsx`, `LayerList.tsx`, `LayerProperties.tsx` y `TextStyleControls.tsx` (nuevo).

Contrato: `contracts/http-api.openapi.yaml`, `packages/contracts/src/http/visual-templates.ts`, `review.ts` y
`components.ts`.

## 12. Pruebas y resultados

Verificación final en el árbol de trabajo. Todas las pruebas usan datos sintéticos y bases temporales, y ninguna llama a
OpenAI.

| Verificación | Resultado |
| --- | --- |
| Tipos (`npm run typecheck`) | Sin errores |
| ESLint | Sin errores |
| Prettier | Solo los 3 archivos que ya fallaban antes |
| Unitarias (servidor y web) | 2555/2555 (+30 sobre E.1) |
| Integración | 689/689 (+5) |
| Contrato | 2418/2418 (+9) |
| Build | Sin errores |
| `npm audit --audit-level=high` | Pasa; 13 moderadas, sin cambios de dependencias |
| `git diff --check` y escaneo de secretos | Limpios |
| E2E y accesibilidad | No se ejecutaron, por instrucción |

**Verificación de cierre (2026-11-12).** Antes de los commits se repitió todo sobre el estado final:

| Verificación | Resultado |
| --- | --- |
| Tipos, ESLint y build | Sin errores |
| Unitarias | 2556/2556 |
| Integración | 689/689 |
| Contrato | 2418/2418 |
| Prettier | Solo los 3 archivos que ya fallaban |
| `npm audit --audit-level=high` | Pasa; 13 moderadas, sin cambios de dependencias |
| `git diff --check` | Limpio |

- El árbol de E.1 se probó aparte en un worktree temporal: unitarias 2525, integración 684 y contrato 2409.
- En el cierre se agregaron dos comprobaciones, incluidas en `066bdad`:
  - una jornada larga de 18 partidos se reparte en tres páginas de seis y dos carruseles numerados, en orden de inicio
    del partido, con portada y cierre en cada carrusel y claves únicas (`content/structure.test.ts`);
  - el flujo completo exporta cada diapositiva en el orden del carrusel, con todas las páginas del calendario
    (`engine-calendar-rows.test.ts`).

Pruebas nuevas:

- `rendering/calendar-rows.test.ts` (13):
  - escudos de cada fila en su lado, desde su archivo;
  - identidad y no nombres, con nombres casi iguales y lados invertidos;
  - equipo sin escudo;
  - fecha, hora y estado;
  - seis filas sin desborde ni solape y una séptima marcada;
  - transparencia, JPEG, 4:1 y 1:4;
  - determinismo;
  - archivo alterado o ausente;
  - orden de los valores;
  - 1.0.0 idéntica a `7a4c9f1` con snapshot ninguno o versión 2;
  - lectura de modelos y una fila inválida rechazada.
- `visual-qa/core.test.ts` (+4): calendario correcto; advertencia por fila; hora, estado y nombre alterados detectados;
  calendario sin filas no examinado.
- `visual-templates/visual-templates.test.ts` (+4): requisito y validación de la lista; errores de validación;
  advertencias de solape, ajuste y contraste; composición por fila y valores ausentes.
- `projects/badge-snapshot.test.ts`: versiones 1, 2 y 3.
- `content/structure.test.ts`: páginas de seis con los mismos partidos en el mismo orden.
- `rendering/templates.test.ts` (+1): versión elegida para cada snapshot.
- Integración `delivery/engine-calendar-rows.test.ts` (3):
  - siete partidos en páginas de 6 y 1, colores de cada escudo por fila, partido aplazado, advertencias por fila,
    confirmación, aprobación y exportación, sin red;
  - snapshot conservado al regenerar tras sustituir y retirar escudos, mismo PNG byte a byte;
  - proyectos anteriores (ninguno, v1 y v2) con páginas de 8, versión 1.0.0 e imagen repetible.
- Integración `delivery/visual-template-projects.test.ts` (+1): proyecto de calendario con una plantilla con lista;
  filas, escudos por identidad, equipo sin escudo y QA sin fallos.
- Integración `visual-templates.int.test.ts` (+1): vista previa de una lista con datos locales.
- Web (+7): valores iniciales y regla de «Agregar capa», contornos de seis filas, edición de espacio, partes, visibilidad
  y estilo guardada en el documento.

Pruebas ajustadas:

- lista de plantillas del motor (2.0.0 y 12 espacios);
- calendario local de 01E-B: líneas con hora y estado, advertencia por fila;
- contrato: 214 esquemas, deltas y detalle por fila.

## 13. Riesgos y limitaciones

- **Contenido de la línea:** la fila depende del orden de los segmentos de hecho que escribe el contenido. Está
  documentado en los dos módulos y cubierto por pruebas.
- **Contraste de la plantilla del motor:** el estado usa el color de acento en letra pequeña (20 px) sobre la banda. Se
  lee bien en la prueba visual, pero conviene revisarlo con el fondo real de la marca.
- **Vista previa del editor:** muestra la primera página de la jornada (seis partidos). No avisa si la jornada tiene
  más; los proyectos sí los reparten en páginas.
- **Lista de partidos sin advertencia de QA:** como el resto de las plantillas visuales (01G-D), un escudo ausente en
  una lista no genera la advertencia `team_badges` del proyecto, solo la de composición.
- **Snapshot como marca de versión:** la versión del snapshot decide la paginación y la plantilla de los proyectos. Un
  cambio futuro del calendario necesitaría otra versión, o una marca propia.
- **E2E y accesibilidad:** no se ejecutaron.
- **Hash del contrato:** sigue desactualizado (DEP-4).

## 14. Validación manual

No hace falta reiniciar nada: los servidores de desarrollo usan este árbol de trabajo. No hay migración.

1. **Escudos:** en Competiciones, deja algunos equipos de una jornada con escudo y al menos uno sin escudo.
2. **Calendario del motor:** genera «Calendario de jornada» con las plantillas del motor para una jornada de más de
   seis partidos.
   - Debe haber varias páginas de como máximo seis filas.
   - Cada escudo debe estar en su lado y un partido aplazado debe mostrar «Aplazado».
   - Las páginas con un equipo sin escudo muestran «Sin escudo: partido N (equipo …)». Confirma la advertencia,
     aprueba y exporta.
3. **Snapshot:** sustituye un escudo y regenera una página del calendario. Debe conservar el escudo anterior.
4. **Proyecto anterior:** regenera la página del calendario existente en tu base. Debe seguir como texto, con hasta
   ocho partidos.
5. **Plantilla visual:**
   - En «Plantillas visuales», crea o abre una plantilla de «Calendario de jornada» y agrega «Lista de partidos».
   - Ajusta la fila (posiciones, estilos y espacio entre filas) y previsualiza con una jornada.
   - Publícala y genera un calendario con ella.
6. **Plantillas del motor:** «Calendario de jornada» debe mostrar la versión 2.0.0 y 12 espacios para escudos.

## 15. Estado de Git

Commits del cierre en `work/PD-ARCH-01G-E`, sobre `7a4c9f1`:

| Commit | Contenido |
| --- | --- |
| `178067f` | Notas de PD-33 y del refinamiento REVIEW-APPROVAL-01. Vienen del mismo encargo, pero se separaron porque son otro refinamiento. |
| `7dfbde3` | E.1, con el árbol exacto que se aceptó. |
| `066bdad` | E.2 (61 archivos, 5 nuevos). |
| Cierre documental | Fuente de verdad, índice, assessment e informes. Es el commit que registra este estado. |

- Los commits anteriores no se reescribieron.
- No se hizo merge, push ni deploy.
- El worktree bloqueado `.claude/worktrees/brand-submenus` sigue sin tocar.
