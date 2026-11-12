# PD-ARCH-01G-E.1 — Informe de implementación: escudos en las plantillas del motor

## Estado

- **Implementado el 2026-11-12 en `work/PD-ARCH-01G-E` y aceptado por el Product Owner el mismo día**, sin commit
  todavía. E.2 se implementó después sobre el mismo árbol de trabajo
  ([informe de E.2](./pd-arch-01g-e2-implementation-report.md)).
- Para separar el diff de E.1 del de E.2 se guardó el árbol aceptado como un objeto de commit que ninguna rama
  referencia: `e2cbf2e26e893477d92785a52e88c11d96ebed04` (`git diff 7a4c9f1 e2cbf2e`). Una limpieza de Git puede
  eliminarlo con el tiempo; sirve mientras E.1 y E.2 sigan sin commit.
- Base: `7a4c9f1` (assessment de 01G-E), sobre el cierre de 01G-D (`3538af1`) y el commit de 01H, UX-REVIEW-01 y el
  menú lateral (`3359476`). Esos commits no se reescribieron.
- Nada de E.1 llama a OpenAI, a un proveedor deportivo ni a la red.

## Decisiones del Product Owner aplicadas (2026-11-12)

Aprobación formal de DE-E1 a DE-E7 del [assessment](./pd-arch-01g-e-assessment.md), registrada como **PD-32** en
`.orchestrate/source-of-truth.md`. Para E.1 cuentan:

| Decisión | Cómo se aplica en E.1 |
| --- | --- |
| DE-E1 | 01G-E vuelve a ser una fase propia. Segunda enmienda del punto 5 de PD-28, sin borrar la del 2026-11-09. |
| DE-E2 | Solo E.1: Previa de partido, Partido programado y Resultado de partido. |
| DE-E3 | Los proyectos anteriores conservan versión de plantilla, modelo de render y PNG (sección 6). |
| DE-E4 | Escudo ausente: espacio vacío, nombre visible, advertencia de QA `team_badges` que no bloquea (sección 5). |
| DE-E5, DE-E6 | Solo para E.2. No se tocaron. |
| DE-E7 | Fuera de 01G-E. Queda como iniciativa INI-BRAND-BG en la sección 9 de la fuente de verdad. |

## 1. Resumen funcional

- Un proyecto nuevo creado desde el asistente de contenido guarda el escudo de cada equipo de sus partidos en ese
  momento (snapshot versión 2), haya o no elegido plantillas visuales.
- Con ese snapshot, las diapositivas Resultado de partido, Partido programado y Previa de partido de las plantillas
  del motor dibujan el escudo del local y del visitante en sus espacios reservados. Partido programado incluye las
  diapositivas de partido de los calendarios de jornada. La diapositiva de resumen del calendario no cambia (E.2).
- Un equipo sin escudo deja su espacio vacío y conserva su nombre. La revisión muestra la advertencia «Escudos de
  equipo — Sin escudo: equipo visitante» en el control visual que ya existía. No hay banners nuevos.
- Sustituir o retirar un escudo después no cambia los proyectos ya creados. Los proyectos nuevos usan los escudos
  vigentes.
- Los proyectos creados antes de E.1 se dibujan como antes, también al regenerar una diapositiva.
- «Plantillas del motor» muestra la versión 1.1.0 de las tres plantillas de partido y el nuevo texto de los espacios
  para escudos.

## 2. Cambios del renderer

| Componente | Cambio |
| --- | --- |
| `rendering/render-model.ts` | `BadgeSlotElement` añade `team` (opcional): el ID local del equipo (null si no se identificó) y el escudo dibujado (`assetId`, `sha256`, `mime`) o null. `empty` pasa a booleano, con dos reglas: un espacio está vacío si y solo si no tiene escudo, y un escudo siempre pertenece a un equipo identificado. Los modelos guardados antes (`empty: true`, sin `team`) siguen siendo válidos. |
| `rendering/renderer.ts` | Un espacio con escudo dibuja la imagen desde sus bytes verificados como URI `data:`, con `objectFit: contain`, en la caja del espacio. Si el archivo falta o su hash no coincide, el render se rechaza (`RenderError`). Un espacio vacío no dibuja nada. |
| `rendering/templates/*.ts` | `match-result`, `fixture` y `match-preview` pasan a la versión 1.1.0 (`drawsBadges: true`). La 1.0.0 sigue registrada. El diseño es el mismo; solo cambia el contenido del espacio. |
| `rendering/templates/registry.ts` | `currentWithoutBadges(slideType)`: la última versión que deja los espacios vacíos (1.0.0 en las plantillas de partido). |
| `rendering/templates/common.ts` | `ModelBuilder.badge` registra el equipo y el escudo solo si la plantilla dibuja escudos y la diapositiva los trae. |
| `rendering/core.ts` | Una diapositiva sin escudos usa `currentWithoutBadges`; con escudos, la versión actual. `RenderDeps.badgeFiles` lleva los archivos del snapshot. |
| `rendering/slide-content.ts` | `SlideContent.badges`: equipo y escudo de cada lado, sin bytes. |
| `rendering/stage.ts` | Carga el snapshot del proyecto con sus archivos verificados. Resuelve los equipos de las diapositivas de partido también para las plantillas del motor, y pasa los escudos al render. Vale para la etapa y para la regeneración de un elemento. |

Geometría (lienzo de referencia de 1080 × 1350, sin cambios desde 1.0.0):

- **Resultado de partido:** espacios de 180 × 180 en (150, 345) y (750, 345). El marcador ocupa x 340 a 740; los
  nombres empiezan en y 550.
- **Partido programado y Previa:** espacios de 180 × 180 en (150, 370) y (750, 370). La marca «vs» ocupa x 390 a 690;
  los nombres empiezan en y 565.

Una prueba comprueba que ningún espacio se cruza con un texto y que todos dejan al menos 40 px de margen lateral y
quedan por debajo de la cabecera.

## 3. Reglas de resolución de escudos

1. **Snapshot al crear el proyecto** (`projects/content-batches/service.ts`): para cada pieza, el escudo activo de
   cada equipo local de sus partidos, o null. Se guarda en `projects.badge_snapshot_json` en la misma transacción que
   crea el proyecto, con el formato versión 2 (`projects/badge-snapshot.ts`):
   `{ "version": 2, "teams": { "<teamId>": "<badgeId>" | null } }`.
2. **Equipos de una diapositiva** (`visual-templates/project.ts`, `slideTeams`): el hecho del nombre del equipo, su
   evidencia de apoyo o consulta y la observación de la fuente local, cuyo `teamKey` es el ID local del equipo. **Nunca
   se compara un nombre.** Dos equipos con nombres casi iguales tienen IDs distintos.
3. **Escudo de cada lado** (`engineSlideBadges`): el del snapshot para ese ID. Un equipo sin escudo, fuera del
   snapshot o sin identificar no tiene escudo.
4. **Archivo:** se lee del almacén confinado con el hash comprobado (`TeamBadgeService.read`) y se vuelve a comprobar
   en el renderer. Las filas y los archivos de escudo nunca se borran, así que un escudo sustituido o retirado sigue
   disponible para los proyectos que lo registraron.
5. **Sin red:** el render no consulta proveedores. El campo de escudo de football-data.org no se lee (PD-28, SC-07).

Quién dibuja escudos:

| Snapshot del proyecto | Plantillas visuales | Plantillas del motor de partido |
| --- | --- | --- |
| Ninguno (proyectos del motor anteriores a E.1, proyectos del flujo de WI-1) | — | 1.0.0, espacios vacíos y sin `team` |
| Versión 1 (proyectos de 01G-D con plantilla visual) | Sí, como en 01G-D | 1.0.0, espacios vacíos y sin `team` |
| Versión 2 (proyectos nuevos desde E.1) | Sí | 1.1.0, con escudos |

## 4. Flujo

```
Asistente ─ POST /content-batches ─ snapshot v2 (escudo activo de cada equipo, por ID)
   └─ etapa de render ─ loadProjectBadges (archivos con hash) ─ slideTeams (hecho → evidencia → teamKey)
        └─ engineSlideBadges ─ plantilla 1.1.0 ─ BadgeSlotElement.team ─ renderer (contain)
             └─ QA visual ─ team_badges (advertencia si un espacio con equipo no tiene escudo)
```

## 5. Advertencia de QA `team_badges` (DE-E4)

- Check nuevo de QA visual, con severidad `warning`. Falla cuando un espacio de escudo registra su equipo pero no
  tiene escudo. Los detalles son cerrados: `emptyBadgeSlots`, con `team-badge-home` y/o `team-badge-away`.
- Pasa en las diapositivas sin espacios, en los modelos sin `team` (proyectos anteriores) y cuando ambos equipos
  tienen escudo. No se ejecuta sobre el texto del carrusel.
- No detiene la generación: el estado del QA queda en `warnings` y la diapositiva queda `ready`. **Como toda
  advertencia de QA (OD-09), se confirma en la revisión antes de aprobar la diapositiva.** El botón es el habitual:
  «Confirmar la advertencia: Escudos de equipo».
- En la interfaz se muestra en la lista de resultados del control visual que ya existía, con el lado sin escudo y una
  línea de ayuda. No hay banners ni insignias nuevas.
- **Migración `0035_qa_team_badges.sql`:** es necesaria porque `qa_results.check_name` tiene una lista cerrada (CHECK) y
  la etapa de QA solo ejecuta los checks que esa lista acepta. Reconstruye `qa_results` con el mismo procedimiento que
  `0002`: tabla nueva, copia, borrado y renombrado. Solo cambia el séptimo nombre. Ninguna tabla referencia
  `qa_results`.
  - Antes de crear el archivo se validó sobre una copia de la base de desarrollo (con su WAL): 494 resultados idénticos
    byte a byte, DDL igual al de una base nueva, `integrity_check` y `foreign_key_check` correctos.
  - **El servidor de desarrollo del Product Owner ya la aplicó** al reiniciarse (2026-11-12 13:57 UTC). Se comprobó
    sobre una copia: versión 35, 494 resultados y el mismo DDL que una base nueva.

## 6. Compatibilidad con proyectos anteriores (DE-E3)

- **Imágenes y modelos guardados:** no se tocan. Las versiones de elemento son inmutables, y E.1 no modifica ningún
  proyecto existente ni su snapshot.
- **Regeneración de un proyecto anterior:** usa la plantilla 1.0.0 (`currentWithoutBadges`). Da la misma versión, el
  mismo modelo y el mismo PNG que antes. Tampoco aparece una advertencia de coherencia visual por mezclar 1.0.0 y 1.1.0
  en el mismo carrusel.
- **Prueba byte a byte frente al código anterior:** se dibujaron cuatro diapositivas de muestra con el commit
  `7a4c9f1` (antes de E.1) y se guardaron los hashes del PNG y del modelo. La prueba
  `rendering/badges.test.ts` comprueba que el código actual produce exactamente esos hashes para proyectos sin escudos
  en el motor.
- **Proyectos de 01G-D con plantilla visual:** su snapshot versión 1 sigue alimentando solo las plantillas visuales.
  Si alguno usaba el motor para las diapositivas de partido, estas siguen sin escudos.
- **Base de desarrollo (copia del 2026-11-12):** 11 proyectos, 5 con snapshot versión 1, todos con la diapositiva de
  partido en plantilla visual. Ninguno cambia.
- **Modelos guardados:** el esquema nuevo lee los modelos con `empty: true` sin `team`. Hay una prueba con un modelo
  anterior serializado.
- **Flujo de WI-1** (proyectos con datos de proveedor o de demostración): no guarda snapshot y sus equipos no son
  equipos locales, así que nunca dibuja escudos.

## 7. Contrato (`http-api`) — evaluación Contract Safety

Cambios, todos aditivos dentro de v1 (PD-11):

- `QaResult`: variante nueva `team_badges` (`severity: warning`, `details.emptyBadgeSlots` cerrado,
  `acknowledgedAt` como las demás advertencias).
- Lista de checks y enum de `acknowledgeQaWarnings` (`checks.items`): se añade `team_badges`.
- Descripción de `Template.badgeSlots` y del encabezado del documento.
- Espejo Zod en `packages/contracts/src/http/review.ts` (`QA_CHECKS`, `QA_WARNING_CHECKS`, `QaResultSchema`).

| Condición | Resultado |
| --- | --- |
| CS-1 compatible hacia atrás | Se cumple. Solo se añaden un valor cerrado y una variante. Ninguna operación, ruta, campo o tipo se quita o cambia. El único cliente es la interfaz incluida, actualizada en el mismo cambio. Los resultados ya guardados siguen siendo válidos. |
| CS-2 dentro del alcance aprobado | Se cumple. Aplica DE-E4 (PD-32) y el punto 4 de PD-28. |
| CS-3 respeta los límites de autorización | Se cumple. No hay operación nueva. La confirmación usa la operación existente, con su protección local (cliente, origen, tipo de contenido). |
| CS-4 no debilita ningún control de seguridad | Se cumple. Los detalles son una lista cerrada de dos valores; no hay texto libre ni entrada nueva. Los escudos se leen con el hash comprobado dos veces. |
| CS-5 no cambia la semántica de las reglas de negocio | Se cumple. Las advertencias se siguen confirmando antes de aprobar (OD-09); los bloqueos no cambian; BR-06 se aplica como enmienda PD-28 y PD-32. |

El hash registrado del contrato (`PRJ-CONTRACT-ID`) ya no coincidía desde fases anteriores (DEP-4). Se actualiza al
cierre del bloque. Las pruebas de contrato (paridad Zod/OpenAPI, conformidad y lista de diferencias registradas)
incluyen el cambio.

## 8. Interfaz

- `features/review/QaResults.tsx` y `copy.ts`: etiqueta «Escudos de equipo», detalle «Sin escudo: equipo local /
  equipo visitante» y la ayuda «El espacio queda vacío. Sube el escudo del equipo en Competiciones; se usa en los
  proyectos nuevos.». La confirmación usa el botón existente.
- `features/brand/copy.ts` («Plantillas del motor»): «2 espacios con los escudos subidos en Competiciones; un equipo
  sin escudo deja su espacio vacío.»
- La vista previa de «Plantillas del motor» usa datos sintéticos, sin clubes reales, así que sus espacios siguen
  vacíos.
- No cambian 01H, el diseño de UX-REVIEW-01 ni el menú lateral.

## 9. Pruebas

Todas usan datos sintéticos y bases temporales. No modifican proyectos reales, no llaman a OpenAI y no salen a la red.

| Tipo | Archivo | Qué cubre |
| --- | --- | --- |
| Unitarias | `rendering/badges.test.ts` (12, nuevo) | Escudo local y visitante en su lado, en las tres plantillas. Elección por identidad, no por nombre: nombres casi iguales y lados invertidos. Un equipo sin escudo: espacio vacío y nombre visible. Ningún equipo con escudo: la misma imagen que sin escudos. PNG semitransparente. Escudos 4:1 y 1:4 contenidos sin deformar ni recortar. JPEG. Márgenes y ausencia de solapes. PNG idéntico byte a byte. Archivo ausente o alterado: no se dibuja. Hashes de PNG y modelo iguales a `7a4c9f1`. 1.0.0 ignora los escudos. Lectura de modelos guardados y rechazo de espacios incoherentes. |
| Unitarias | `visual-qa/core.test.ts` (+5) | `team_badges` pasa con escudos y con modelos sin equipo. Advierte de un lado y de los dos. No se ejecuta en el texto del carrusel. Defecto sembrado por nombre de check. |
| Unitarias | `projects/badge-snapshot.test.ts` (4, nuevo) | Sin snapshot, versión 1, versión 2 y formas rechazadas. |
| Unitarias | `rendering/templates.test.ts` (+1, 2 ajustadas) | Versiones registradas y `currentWithoutBadges`. |
| Integración | `test/integration/delivery/engine-template-badges.test.ts` (4, nuevo) | Flujo completo (servidor, etapas reales, SQLite temporal). Resultados, partidos programados y previas con escudos por identidad: nombres casi iguales, lados invertidos y escudo semitransparente. Equipo sin escudo y partido sin escudos: advertencia que no bloquea, confirmación, aprobación y exportación. Sustituir y retirar escudos: regeneración idéntica byte a byte, y el proyecto nuevo usa los escudos vigentes. Proyectos anteriores (sin snapshot y con snapshot versión 1): versión 1.0.0, sin escudos ni advertencia, imagen idéntica al regenerar. Archivo de escudo alterado en disco: error 500, ninguna imagen dibujada y la versión anterior intacta. Ninguna petición de red. |
| Integración | `platform/db/migrations.int.test.ts` (+1) | `0035` sobre una base en la versión 34: filas idénticas byte a byte, mismo DDL salvo el nombre nuevo, acepta `team_badges` y rechaza nombres desconocidos o duplicados. |
| Integración | `schema.int.test.ts`, `visual-qa/stage.int.test.ts`, `rendering/*.int.test.ts`, `delivery/*.test.ts` | Ajustes: lista de migraciones, siete checks, versión 1.1.0 y advertencia esperada en los partidos programados sin escudo de `local-fixture-content`. |
| Contrato | `test/contract/openapi-document.test.ts` | Variante `team_badges` cerrada y advertencia, enum de confirmación y las dos diferencias nuevas registradas frente a la propuesta. |
| Web | `ElementReview.test.tsx` (+1), `TemplatesPage.test.tsx` | La advertencia muestra el lado sin escudo y su confirmación envía `checks: ['team_badges']`. Nuevo texto de los espacios. |

## 10. Resultados de verificación

Ver la sección 13.

## 11. Riesgos y puntos pendientes

1. **Migración ya aplicada en la base de desarrollo.** Si E.1 se rechazara y se descartaran los cambios, el servidor
   no arrancaría: la base tiene registrada la versión 35 y faltaría su archivo. En ese caso hay que conservar
   `0035_qa_team_badges.sql`, que solo amplía la lista de checks y no hace daño, o restaurar una copia de la base.
2. **La advertencia se confirma antes de aprobar**, como todas las de QA (OD-09). Para un partido sin escudos hace
   falta una confirmación por diapositiva. Si el Product Owner quiere una advertencia que no pida confirmación, hace
   falta una severidad nueva (contrato y migración): es una decisión aparte.
3. **Plantillas visuales:** en los proyectos, un equipo sin escudo en una plantilla visual sigue sin advertencia de QA.
   Así quedó en 01G-D: el aviso solo aparece en el asistente. DE-E4 lo pide en general. Extenderlo es pequeño:
   registrar en el modelo estructurado la capa de escudo que queda vacía para que `team_badges` la vea. Queda para la
   decisión del Product Owner; no se hizo para no cambiar 01G-D dentro de E.1.
4. **Archivo de escudo dañado o manipulado:** el render se rechaza con 500 y la nueva versión queda sin imagen ni QA,
   así que no se puede aprobar ni exportar. Es el mismo comportamiento que en 01G-D. Nunca se dibuja un sustituto.
5. **La vista previa del motor** (asistente y «Plantillas del motor») usa datos sintéticos, así que no muestra
   escudos reales. La revisión del asistente ya muestra los escudos de cada partido.
6. **E2E y accesibilidad no se ejecutaron**, por instrucción. La suite ya estaba desactualizada.
7. **Hash del contrato** desactualizado (DEP-4), como antes.
8. **Calendarios:** las diapositivas de partido de un calendario usan Partido programado y ya tienen escudos. La
   diapositiva de resumen sigue siendo texto hasta E.2.

## 12. Validación manual

El servidor de desarrollo ya está en marcha con E.1 y aplicó la migración 0035. No hace falta reiniciarlo.

1. **Escudos en Competiciones:** sube escudos (PNG con transparencia y JPEG) para algunos equipos de una competición
   y deja al menos un equipo sin escudo.
2. **Resultado de partido:** en el asistente, genera «Resultado de partido» o «Resultados de jornada» con las
   plantillas del motor, sin plantilla visual de partido. En Revisión, cada escudo aparece en su lado, sin deformarse
   y con la transparencia respetada.
3. **Partidos sin jugar:** genera «Próximos partidos» o «Previa» con un partido en el que un equipo no tiene escudo.
   Su espacio queda vacío y se ve su nombre. El control visual muestra «Escudos de equipo — Sin escudo: equipo …».
   Confírmala, aprueba y exporta.
4. **Snapshot:** sustituye el escudo de un equipo en Competiciones y regenera una diapositiva del proyecto del paso 2.
   Sigue con el escudo anterior. Genera un proyecto nuevo: usa el escudo nuevo.
5. **Proyectos anteriores:** abre un proyecto creado antes de hoy y regenera una diapositiva de partido. No aparecen
   escudos ni la advertencia nueva.
6. **Plantillas del motor:** Resultado de partido, Partido programado y Previa de partido muestran la versión 1.1.0 y
   el nuevo texto de los espacios para escudos.

## 13. Verificación final (2026-11-12)

Se ejecutó en un worktree limpio en `7a4c9f1`, con el mismo conjunto de cambios aplicado, para no tocar el `dist` que
usa el servidor de desarrollo del Product Owner.

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| ESLint (`--max-warnings 0`) | Sin errores. |
| Prettier | Los archivos de E.1 cumplen. `prettier --check .` solo señala los 3 archivos que ya fallaban antes de esta fase: `competitions/import-preview.int.test.ts`, `projects/respond.ts` y `platform/http/errors.ts`. No se tocaron. |
| Unitarias (`unit` y `unit-web`) | 2525 de 2525. Antes: 2502 (1798 y 704). Servidor 1820 (+22), web 705 (+1). |
| Integración | 684 de 684 (antes 679; +4 de E.1 y +1 de la migración). |
| Contrato | 2409 de 2409. |
| Render | Incluido en las unitarias (`rendering/badges.test.ts`, `templates.test.ts`) y en la integración (`rendering/*.int.test.ts`, `engine-template-badges.test.ts`). |
| `npm run build` | Sin errores. |
| `npm audit` (umbral alto) | Sin errores. Informa 13 advertencias moderadas: `fflate` vía `satori` (aceptada en OD-33) y `glob` y `minimatch` de las herramientas de desarrollo. E.1 no cambia dependencias. |
| `git diff --check` | Limpio. |
| Escaneo de secretos de los cambios y los archivos nuevos | Sin coincidencias. |
| E2E y accesibilidad | No se ejecutaron, por instrucción. |

No hubo llamadas a OpenAI ni a ningún proveedor. Las pruebas usan bases temporales y datos sintéticos.

## 14. Estado de Git

- Rama `work/PD-ARCH-01G-E`, en `7a4c9f1`. Los commits `3538af1`, `3359476` y `7a4c9f1` no se tocaron.
- **E.1 y la documentación de esta entrega están sin commit**, por instrucción. Son 47 archivos modificados y 7 nuevos:
  - la migración `0035_qa_team_badges.sql`;
  - `projects/badge-snapshot.ts` y su prueba;
  - `rendering/badges.test.ts`;
  - `engine-template-badges.test.ts`;
  - este informe;
  - `docs/design/REVIEW-APPROVAL-01/README.md`.
- No hubo merge, push ni deploy.
- La migración 0035 ya está aplicada en `data/edr.sqlite` (sección 5).
