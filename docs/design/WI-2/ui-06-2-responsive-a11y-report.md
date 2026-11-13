# UI-06.2 — Adaptación responsive y accesibilidad

**Estado:** aceptado por el Product Owner y cerrado el 2026-11-13, con O-1 y O-2 aprobadas e implementadas (sección
18). UI-06 no está terminado: falta UI-06.3, que no ha empezado.
**Rama:** `work/WI-2-UI-06`, sobre `cc0182d8f89940c42bdbaf8a85a4263f65a57474` (cierre de UI-06.1). Los commits de
UI-06.1 no se modificaron.
**Origen:** instrucción del Product Owner «WI-2 / UI-06.2 — Responsive, accesibilidad y corrección de hallazgos»
(2026-11-13), que acepta UI-06.1 y autoriza este incremento; cierre según «WI-2 / UI-06.2 — Aceptación y cierre
técnico» (2026-11-13).
**Alcance:** [`ui-06-scope-and-increments.md`](ui-06-scope-and-increments.md), sección UI-06.2.
**Evidencia:** [`evidence/UI-06/ui-06-2/`](evidence/UI-06/ui-06-2/) (antes y después, selección responsive y
registros de las verificaciones).

## 1. Resumen

- Los cuatro hallazgos obligatorios están corregidos: A11Y-01 (contraste de la trazabilidad), A11Y-02 (nombre
  accesible de las diapositivas), R-02 (tooltip de Inicio a 768 px) y R-03 (vista previa de la revisión a
  1280 × 720).
- La validación responsive recorre 34 pantallas y estados en los cinco anchos pedidos (1440, 1280, 1024, 768 y
  390 px, con alturas 900, 720, 768, 1024 y 844), más 640 × 360 (1280 × 720 al 200 %) y 320 × 256 (reflow a 400 %).
  En ninguna la página se desplaza en horizontal, nada se sale del marco y el control principal sigue disponible.
- La validación encontró tres hallazgos más, corregidos en este incremento porque impedían cumplir los criterios:
  R-04 (el editor de plantillas no dejaba ancho para el lienzo por debajo de 900 px), R-05 (el título de
  Competiciones desbordaba a 320 px) y A11Y-03 (ocho tooltips no se podían cerrar con Escape ni recorrer con el
  puntero; WCAG 1.4.13).
- La suite de accesibilidad ya no declara ninguna excepción: las de A11Y-01 y R-03 se retiraron al verificarse.
- Solo cambia la web. Sin cambios en el servidor, el contrato, la base de datos, las migraciones, las dependencias,
  la política de exportaciones, PD-33 ni PD-34. No se reutilizan ZIP. Sin llamadas a OpenAI ni a proveedores
  deportivos.
- Con la aceptación, el Product Owner aprobó O-1 (nota de Mi marca) y O-2 (nombres accesibles de las acciones de
  equipos), implementadas antes del cierre (sección 12).
- No se declara el cumplimiento de WCAG 2.2 AA: las verificaciones automáticas pasan, pero quedan comprobaciones
  manuales (sección 14).

## 2. Inspección inicial

- `git status`: limpio en `work/WI-2-UI-06`, `HEAD` en `cc0182d` (registro del cierre) sobre `bcdecc7` (cierre de
  UI-06.1).
- Leídos: `.orchestrate/source-of-truth.md` (PD-28, PD-32, PD-33, PD-34 y la fila UI-06), el alcance de UI-06, el
  informe de UI-06.1 (secciones 4.3, 4.4, 7.3 y 11), la suite de accesibilidad (`a11y.spec.ts`, con `KNOWN` para
  A11Y-01 y R-03), las pruebas responsive (`shell-responsive.spec.ts`, `dashboard.spec.ts`, `creation-visual.spec.ts`),
  los tokens (`apps/web/src/ui/tokens.css`, `global.css`) y los componentes compartidos (`ui/primitives`,
  `Layout`, `SlideWorkspace`, `SlidePreview`, `ReviewThumbnailRail`).
- No se repitió el assessment de UI-06.1. Antes de corregir, una medición de todas las pantallas en los siete tamaños
  confirmó R-03 y encontró R-05; R-04 y A11Y-03 aparecieron al ampliar las pruebas (sección 4).

## 3. Hallazgos obligatorios

### 3.1 A11Y-01 — Contraste en la trazabilidad (corregido)

- **Causa:** la trazabilidad de una diapositiva exportada (`/projects/:id/exports/:id/slides/:n/trace`) es un
  registro construido con los componentes de «Datos y verificación» (hechos, tablas de evidencia, disputas, avisos de
  datos atestiguados y de demostración), todos con los colores del tema claro (`History.module.css`,
  `Facts.module.css`, `StatusBadge`, `DemoBanner`, `AttestedNote`). La regla de rutas `contentVariantOf` la incluía
  en la superficie oscura del estudio por el patrón de las exportaciones. Además del contraste de 2,2 a 2,3 que
  detectaba axe, las cabeceras de las tablas de evidencia (texto claro sobre `#f5f5f5`) eran invisibles.
- **Corrección:** `contentVariantOf` sirve la trazabilidad en el panel claro heredado, como su página hermana
  «Datos y verificación». No se tocó ningún selector de la prueba: todos los estados de la página vuelven a la
  superficie para la que se diseñaron. La exportación (`/projects/:id/exports/:id`) sigue en el estudio.
- **Estados revisados con axe:** hechos aprobados manualmente con su aviso de datos atestiguados (datos locales),
  hechos verificados por dos fuentes con el aviso de demostración (exportación DEMO_DATA nueva en la suite), dirección
  inválida, y «Datos y verificación» de la ejecución de demostración. La disputa no se puede provocar con los datos
  sintéticos actuales (sección 14).
- **Pruebas:** `App.test.tsx` (la trazabilidad es `legacy`, la exportación `studio`); `a11y.spec.ts` sin la
  excepción y con los estados nuevos; `responsive.spec.ts` (trazabilidad en los siete tamaños).
- **Evidencia:** `ui-06-2/antes/A11Y-01-*.png` y `ui-06-2/despues/A11Y-01-*.png`.

### 3.2 A11Y-02 — Nombre accesible de las diapositivas (corregido)

- **Causa:** el carril construía el nombre de cada diapositiva con el estado de la versión
  (`versionStateLabel[state]`: «Lista para aprobar») mientras su insignia visible usaba el estado de revisión
  (`elementStatus`: «Advertencia por confirmar», «Bloqueada por datos», «Requiere regenerar»). El inspector mostraba
  la misma etiqueta de versión y, si estaba bloqueada, una segunda insignia «Bloqueada».
- **Corrección:** el nombre del carril (`carouselCopy.slideButton`), la insignia del inspector y la del panel de la
  página del proyecto usan `elementStatus`, el mismo estado que la insignia visible. El inspector muestra una sola
  insignia con ese estado; su tono sale de `statusBadgeTone` (aprobada, positiva; bloqueo o advertencia, precaución;
  el resto, neutra). Se retiraron `versionStateLabel` y `elementCopy.blocked`, que quedaron sin uso.
- **Acciones:** «Aprobar diapositiva» sigue deshabilitado y descrito por la lista de impedimentos cuando la
  validación lo impide; ningún nombre anuncia «Lista para aprobar» en ese caso.
- **Medición en el navegador** (`ui-06-2/*/medidas.json`, diapositiva 2 con una advertencia del control visual):

  | | Antes | Después |
  | --- | --- | --- |
  | Nombre en el carril | «Diapositiva 2: Resultado, Lista para aprobar» | «Diapositiva 2: Resultado, Advertencia por confirmar» |
  | Insignia visible del carril | «Advertencia por confirmar» | «Advertencia por confirmar» |
  | Insignia del inspector | «Lista para aprobar» | «Advertencia por confirmar» |

- **Pruebas:** prueba nueva en `ReviewModes.test.tsx` que recorre aprobada, bloqueada, advertencia, a regenerar,
  pendiente del control visual y lista: nombre, insignia del carril e inspector coinciden, ningún otro estado aparece
  en el inspector y la aprobación solo está habilitada cuando la diapositiva está lista. `ElementReview.test.tsx`
  comprueba el estado del inspector y el nombre del carril en los casos de bloqueo y de fallo del control visual.

### 3.3 R-02 — Tooltip de Inicio (corregido, junto con A11Y-03)

- **Causa:** el tooltip del selector de vista (`ViewModeToggle`) se centraba siempre sobre su botón; a 768 px el
  botón «Vista de tarjetas» queda junto al borde derecho y el tooltip sobresalía 6 px.
- **Corrección:** primitiva compartida `ui/primitives/Tooltip.tsx`, con el comportamiento de los overlays existentes
  (`ActionMenu`): se coloca sobre el control y se desplaza lo justo para quedar dentro de la ventana con un margen de
  4 px. Sin bibliotecas nuevas. Cumple WCAG 1.4.13: aparece con el puntero o el foco de teclado, permanece mientras el
  puntero pasa sobre él y Escape lo oculta sin mover el foco (en un diálogo, el primer Escape cierra solo el
  tooltip). Los identificadores fijos repetidos (`view-mode-tip-*`) pasan a `useId`.
- **Medición:** a 768 px, desplazamiento horizontal con el tooltip visible de 6 px antes y 0 px después.
- **Pruebas:** `primitives.test.tsx` (ajuste al borde derecho e izquierdo, Escape, foco, puntero sobre el tooltip,
  diálogo que sigue abierto tras el primer Escape); `responsive.spec.ts` (en Inicio, Mis proyectos, Competiciones,
  Equipos y Mi marca, con foco y con puntero, en los siete tamaños); `dashboard.spec.ts` ya no aparta el puntero ni
  quita el foco para medir: comprueba el tooltip visible y la página sin desplazamiento.
- **Evidencia:** `ui-06-2/antes/R-02-inicio-768-tooltip.png` y `ui-06-2/despues/R-02-inicio-768-tooltip.png`.

### 3.4 R-03 — Vista previa de la revisión a 1280 × 720 (corregido)

- **Causa:** la columna de la revisión tenía una altura fija igual a la ventana (mínimo 44 rem) y la cabecera ocupa
  unos 340 px a 1280 px, así que al espacio de trabajo le quedaban unos 350 px. El escenario de la imagen tiene un
  mínimo de 320 px y la barra de herramientas ocupaba dos filas, porque a ese ancho la columna central solo recibía
  unos 370 px (el carril y el inspector tomaban su ancho máximo antes que ella). La vista previa se salía de su
  columna y del marco, y el pie «1080 × 1350 px · Versión n» quedaba sobre el fondo blanco del documento (contraste
  1,7).
- **Corrección:**
  - `ReviewPage.tsx`: desde `lg`, la columna es una rejilla con la cabecera y las pestañas arriba y el espacio de
    trabajo debajo, que llena la ventana y nunca baja de 34 rem. En una ventana baja la página crece y se desplaza en
    vertical; nada se sale de su columna. El modo abierto lleva `contain: size`, así que su contenido se desplaza
    dentro de sus paneles y no estira la fila.
  - `SlideWorkspace.tsx`: entre `lg` y `xl` (1200 a 1439 px) el carril y el inspector toman su ancho mínimo (13 y
    18 rem), y la vista previa recibe unos 455 px a 1280 px. Desde `xl` no cambia nada.
  - `global.css`: el documento usa la superficie y el texto del estudio (`--color-surface-canvas`,
    `--color-text-primary`), así que ni un desbordamiento ni el rebote del desplazamiento muestran blanco. El panel
    claro conserva su superficie y su texto. La página de error de último recurso, fuera del marco, usa el color de
    enlace del estudio para mantener el contraste sobre ese fondo.
- **Proporción y protagonismo:** la imagen sigue con `object-fit: contain` (4:5). A 1280 × 720 es la columna más
  ancha, con la barra en una fila y la imagen a unos 285 × 356 px; a 1440 × 900 el resultado es idéntico al anterior.
- **Pruebas:** `responsive.spec.ts`, prueba R-03 a 1440 × 900 y 1280 × 720: la vista previa, su imagen y su pie
  terminan dentro del espacio de trabajo; nada pasa del marco; proporción 4:5 y `contain`; la vista previa es más
  ancha que el carril y el inspector, con al menos 320 px de alto; fondo del documento igual al del estudio.
  `a11y.spec.ts` ya no declara la excepción.
- **Evidencia:** `ui-06-2/antes/R-03-*.png` y `ui-06-2/despues/R-03-*.png`.

## 4. Hallazgos nuevos de la validación (corregidos)

| ID | Pantalla | Hallazgo | Criterio | Corrección |
| --- | --- | --- | --- | --- |
| R-04 | Editor de plantillas | Por debajo de 900 px las tres columnas fijas (raíl de 3 rem, lienzo y propiedades de 18 a 21 rem) dejaban el lienzo sin ancho: a 390 px medía 0 px y no se veía. | 1.4.10; funcionalidad crítica oculta | Como en `SlideWorkspace`: tres columnas desde `md` y paneles apilados por debajo, con el lienzo en un área de `min(80dvh, 48rem)`. La altura de ventana se aplica desde `md` en el diseño y desde `lg` en la vista previa (que tiene columnas desde `lg`); antes la vista previa se salía del marco a 1024 × 768. |
| R-05 | Competiciones | A 320 px el título «Competiciones» (40 px) no cabía y la página se desplazaba 16 px. | 1.4.10 | `text-heading-md` hasta `sm` y `text-heading-lg` desde `sm`, el mismo patrón que «Mis proyectos». |
| A11Y-03 | Inicio, Mis proyectos, Competiciones, Equipos, Temporada, Calendario, Vista previa de importación, Mi marca, Propuestas visuales | Ocho tooltips propios (CSS `group-hover`) sin cierre con Escape, sin poder pasar el puntero sobre ellos y sin ajuste a la ventana. | 1.4.13 | Todos usan la primitiva `Tooltip` (3.3). El de «Verificar cambios locales» recibe además su `aria-describedby`. |

## 5. Validación responsive

Prueba `e2e/tests/responsive.spec.ts` (`@a11y`, en `npm run test:a11y`). En cada tamaño y pantalla:
desplazamiento horizontal de la página igual a 0; ningún elemento fuera del borde de la ventana salvo dentro de un
panel con desplazamiento propio; nada pintado por debajo del marco de la aplicación; control principal visible; y
captura de página completa en `.cache/e2e/evidence/UI-06.2/<tamaño>/`. La medición está en
`e2e/support/layout.ts`.

| Área pedida | Pantallas y estados medidos | 1440 | 1280 | 1024 | 768 | 390 | 200 % | 320 px |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Navegación lateral | Menú fijo desde 1200 px y desplegable por debajo, con Escape y foco (`shell-responsive`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Dashboard | Inicio | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Proyectos | Mis proyectos, página del proyecto | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Generación de contenido | Los cinco pasos del asistente y el resultado de la generación | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Revisión visual | Diseño visual pendiente y con aprobación final | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Copy editorial | Antes de generar y con entregables generados y aprobados | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exportaciones | Exportaciones, una exportación, su trazabilidad, Datos y verificación | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Competiciones | Lista, competición, equipos | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Temporadas | Temporada, participantes, calendario | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Jornadas y gestión de partidos | Jornada con sus partidos y «Agregar partido» | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mi marca | Recursos (con un recurso) e identidad visual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editor de plantillas | Crear plantilla, plantillas del motor, editor (lienzo; capas y propiedades con una capa seleccionada; vista previa) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Otros | Datos (importación), página no encontrada | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Notas:

- Las distribuciones de varias columnas se apilan por debajo de `md` (revisión, página del proyecto, exportación,
  editor) o de `lg` (vista previa del editor). Los paneles internos (carril, inspector, tablas anchas) pueden
  desplazarse sin impedir el uso.
- A 640 × 360 y 320 × 256 la navegación pasa al menú desplegable y las pantallas se apilan; el editor de plantillas
  queda apilado y su lienzo se puede usar. WCAG admite que un lienzo necesite dos dimensiones; aquí no hace falta.
- Selección de 25 capturas en [`evidence/UI-06/ui-06-2/responsive/`](evidence/UI-06/ui-06-2/responsive/) (nueve
  áreas a 1280 × 720 y 390 × 844, tres a 768 × 1024, la revisión al 200 %, Inicio y Competiciones a 320 px y un
  diálogo a 390 px), tomadas antes de O-1 y O-2: las de Mi marca muestran la nota anterior (la nueva está en
  `despues/O-1-mi-marca-nota-1280x720.png`). El conjunto completo (34 pantallas en 7 tamaños) se regenera en
  `.cache/e2e/evidence/UI-06.2/` con `npm run test:a11y`.
- Antes y después de cada cambio visible: [`evidence/UI-06/ui-06-2/antes/`](evidence/UI-06/ui-06-2/antes/) (captura
  de `cc0182d`, compilado aparte) y [`evidence/UI-06/ui-06-2/despues/`](evidence/UI-06/ui-06-2/despues/), con las
  mismas pantallas y datos sintéticos, y sus medidas en `medidas.json`.

## 6. Interacción y accesibilidad

| Verificación | Cómo | Resultado |
| --- | --- | --- |
| Navegación por teclado | Recorrido de 40 paradas de Tab en la revisión, el asistente, Mi marca y Competiciones a 1280 y 390 px; pestañas con flechas; menú «Más opciones» con Enter y Escape; diálogos con Tab y Mayús+Tab | Sin trampas ni paradas en elementos invisibles |
| Foco visible | En cada parada del recorrido y dentro de los diálogos: anillo, contorno o borde dorado (opciones de menú), leído al terminar sus transiciones | Todas las paradas lo muestran |
| Orden lógico | La primera parada es «Saltar al contenido principal», después el shell y la página, en el orden del documento | Correcto |
| Escape en diálogos y paneles | «Subir un recurso de marca», «Editar equipo», «Confirmar aprobación de diapositivas»; menú «Más opciones»; navegación desplegable; tooltips | Cierran y no cierran el contenedor de fuera |
| Restauración del foco | Al cerrar cada diálogo o menú el foco vuelve a su control | Correcto a 1280 y 390 px |
| Nombres accesibles | A11Y-02; axe (`button-name`, `link-name`, `label`, `aria-*`) en todas las pantallas escaneadas | Sin violaciones |
| Estados deshabilitados | Aprobación según el estado (prueba A11Y-02); «Aprobar carrusel completo» descrito por sus motivos | Correcto |
| Mensajes de error | axe en el formulario de Datos con errores y la importación rechazada (suite existente) | Sin violaciones |
| Anuncios de progreso | Regiones `status` existentes de la generación, la descarga y las aprobaciones, comprobadas por las suites E2E | Sin cambios |
| Contraste de texto y de controles | axe (`color-contrast`) en todas las pantallas escaneadas, sin excepciones; tokens del estudio sin cambios | Sin violaciones |
| Estados de selección | `aria-current` en el carril y la navegación, `aria-pressed` en el selector de vista y las capas, `aria-selected` en pestañas | Comprobados en las pruebas de teclado y unitarias |
| Zoom al 200 % y reflow | 640 × 360 y 320 × 256 en las 34 pantallas | Sin desplazamiento horizontal |
| Espaciado de texto (1.4.12) | Interlineado 1,5, letras 0,12 em, palabras 0,16 em y párrafos 2 em en seis pantallas a 1280 × 720 | Sin desplazamiento horizontal |
| Movimiento reducido | `prefers-reduced-motion: reduce` en la revisión | Ninguna animación ni transición activa |
| Tamaño de los objetivos (2.5.8) | Regla `target-size` de axe (etiqueta `wcag22aa`) | Sin violaciones |

## 7. Componentes complejos

- **Editor de plantillas:** lienzo, panel de capas, panel de propiedades, barra de herramientas y vista previa en los
  siete tamaños (R-04), con una capa seleccionada. Los modales del editor usan `Modal` (foco atrapado, Escape y
  restauración, comprobados en otros diálogos). Los datos del editor son una plantilla sintética servida solo al
  navegador (`e2e/support/template-fixtures.ts`): crear una plantilla real necesita una propuesta visual del
  proveedor de imágenes de pago.
- **Revisión de contenido:** carril, vista previa, inspector, pestañas Diseño y Copy, diálogos de aprobación masiva
  y final, y descargas, en los siete tamaños, con teclado y con la prueba de R-03. La descarga y la aprobación siguen
  cubiertas por `content-journey` (E2E-F01 sigue siendo una prueba de regresión normal).
- **Generación de contenido:** asistente completo, selectores deportivos, estado sin partidos compatibles
  (`creation-entry`), estados sin competiciones y con error (`creation-visual`) y resultado de la generación.

## 8. Design system

Solo Tailwind y los tokens semánticos existentes (`surface-*`, `text-*`, `border-*`, `brand-gold`, `danger`,
`warning`, `focus`). Sin paletas nuevas ni colores fijos nuevos. Dorado primario, morado y neutros secundarios, rojo
destructivo, estados atenuados, tipografía (Montserrat e Inter) y logotipos oficiales y Ketsi sin cambios.

## 9. Pruebas añadidas y actualizadas

| Archivo | Cambio |
| --- | --- |
| `e2e/tests/responsive.spec.ts` (nuevo, `@a11y`, 10 pruebas) | Pantallas en siete tamaños; R-03; R-02 en cinco páginas; diálogos; pestañas, menú, foco y orden; espaciado de texto y movimiento reducido. |
| `e2e/support/layout.ts` (nuevo) | Medición del desplazamiento horizontal, de lo que sale de la ventana y de lo que pasa del marco. |
| `e2e/support/template-fixtures.ts` (nuevo) | Plantilla visual sintética servida al navegador. |
| `e2e/tests/a11y.spec.ts` | Sin excepciones declaradas; trazabilidad en sus estados (datos atestiguados, DEMO_DATA verificada, dirección inválida) y Datos y verificación de la ejecución de demostración. |
| `e2e/tests/shell-responsive.spec.ts` | Los cinco anchos (antes 1440, 768 y 390). |
| `e2e/tests/dashboard.spec.ts` | Mide con el tooltip visible en lugar de apartarlo. |
| `apps/web/src/ui/primitives/primitives.test.tsx` | Dos pruebas de `Tooltip`. |
| `apps/web/src/features/review/ReviewModes.test.tsx` | Prueba de A11Y-02 con seis estados. |
| `apps/web/src/features/review/ElementReview.test.tsx` | Estado del inspector y nombre del carril (bloqueo y control visual fallido). |
| `apps/web/src/features/brand/BrandPage.test.tsx`, `apps/web/src/features/competitions/pages/CompetitionListPage.test.tsx`, `e2e/tests/brand.spec.ts` | O-1 (texto nuevo de la nota) y O-2 (nombres con el equipo; tooltip y `title` sin cambios). |
| `apps/web/src/app/App.test.tsx` | Superficie de la trazabilidad y de la exportación. |

Ninguna prueba se eliminó; ninguna excepción nueva. La prueba de regresión de E2E-F01 no cambia.

## 10. Resultados

Ejecución del cierre, el 2026-11-13, sobre el árbol de UI-06.2 con O-1 y O-2
([`ui-06-2-verification.txt`](evidence/UI-06/ui-06-2/ui-06-2-verification.txt),
[`ui-06-2-e2e.txt`](evidence/UI-06/ui-06-2/ui-06-2-e2e.txt),
[`ui-06-2-a11y.txt`](evidence/UI-06/ui-06-2/ui-06-2-a11y.txt)).

| Verificación | Resultado |
| --- | --- |
| E2E completo (`--grep-invert @a11y`) | 22/22 correctas; E2E-F01 sigue como prueba de regresión normal |
| Accesibilidad, responsive y teclado (`--grep @a11y`) | 40/40 correctas (13 `a11y`, 10 `responsive`, 12 `dashboard`, 5 `shell-responsive`), sin excepciones declaradas |
| Unitarias | 2566/2566 (145 archivos; 3 más que en UI-06.1: A11Y-02 y dos de `Tooltip`) |
| Integración | 697/697 (58 archivos) |
| Contrato | 2419/2419 (7 archivos) |
| Identidad del contrato (`PRJ-CONTRACT-ID`) | Coincide: archivo y configuración `9bf188ca…22bc`; el contrato no cambió |
| Typecheck | Sin errores |
| ESLint | Sin errores ni advertencias |
| Prettier | Pasa en todo el repositorio |
| Build | Sin errores |
| `npm audit --audit-level=high` | Pasa: 0 altas o críticas; las mismas 13 moderadas de UI-06.1 (sección 7.1 de su informe) |
| Escaneo de secretos | 0 hallazgos en 1259 archivos |
| `git diff --check` | Limpio |
| Árbol tras ejecutar las suites | Sin cambios fuera de los de este incremento |
| Servidor, contrato, migraciones, `package.json`, `package-lock.json` | Sin cambios |

Las suites usan el adaptador `stub` para el texto de las diapositivas y el copy editorial, imágenes desactivadas,
datos sintéticos y directorios temporales; no tocan `data/edr.sqlite` ni llaman a proveedores deportivos ni a OpenAI.
La plantilla del editor se sirve al navegador desde la prueba.

## 11. Seguridad y dependencias

- Sin dependencias nuevas ni actualizadas. `package-lock.json` sin cambios.
- `@fastify/static`: sin actualizar. Consulta del registro de npm el 2026-11-13: `latest` sigue siendo 10.1.11
  (publicada el 2026-11-13 a las 12:20 UTC); la instalada es 10.1.6 con `glob` 13.0.6 y `minimatch` 10.2.6. La
  evaluación del informe de UI-06.1 (sección 7.3) sigue vigente y la propuesta queda para UI-06.3, con autorización
  aparte.
- Política de exportaciones, PD-33 y PD-34 sin cambios; ninguna reutilización de ZIP.

## 12. O-1 y O-2 (aprobadas e implementadas)

Ambas preguntas salieron de UI-06.1 (informe, sección 4.3) y se presentaron en este incremento sin aplicarlas. El
Product Owner las aprobó el 2026-11-13, en la instrucción de aceptación, y se implementaron antes del cierre. Ninguna
cambia funcionalidades, reglas de negocio ni controles.

### O-1 — Nota de Mi marca

- **Antes:** «Solo se registran recursos autorizados de El Deporte Rey GT. No se registran escudos de clubes,
  marcas de competiciones ni imágenes sin autorización: los nombres de equipos y competiciones aparecen como
  texto.» La última parte contradecía PD-28 y PD-32: los escudos de los equipos se suben en Competiciones y se
  dibujan.
- **Decisión:** actualizar la nota con el texto sugerido por el Product Owner, adaptado al espacio sin cambiar su
  significado.
- **Ahora** (`brandCopy.authorizedOnly`, Mi marca → Recursos): «Los escudos de los equipos se gestionan desde
  Competiciones, donde puedes cargar los archivos y registrar su procedencia y autorización de uso. Mi marca
  administra los recursos visuales propios de El Deporte Rey.» Única adaptación: «Mi marca» con la capitalización
  del menú y de la página. El texto ocupa el mismo lugar y estilo; la segunda nota (valores provisionales) no cambia.
- **Decisiones relacionadas:** PD-03 enmendada por PD-28; PD-32; BR-06. Sin cambios en las reglas.
- **Pruebas:** `BrandPage.test.tsx` comprueba el texto nuevo y que el anterior ya no aparece.
- **Evidencia:** `ui-06-2/antes/O-1-mi-marca-nota-1280x720.png` y `ui-06-2/despues/O-1-mi-marca-nota-1280x720.png`,
  con el texto en `O-1-O-2.json`.

### O-2 — Nombres accesibles de las acciones de equipos

- **Antes:** en Equipos asociados, cada fila y cada tarjeta tenía «Editar equipo» y «Quitar de competición» como
  nombre accesible, iguales en todas.
- **Decisión:** incluir el nombre del equipo en el nombre accesible, con el nombre real del estado de la
  aplicación, sin cambiar los textos visibles ni añadir controles.
- **Ahora:** «Editar equipo: <equipo>» y «Quitar de competición: <equipo>», con el nombre actual del equipo (tras
  editarlo, el nombre accesible usa el nuevo). El icono, el tooltip y el `title` siguen diciendo «Editar equipo» y
  «Quitar de competición»; el nombre empieza por ese texto (WCAG 2.5.3). Es el mismo patrón que «Eliminar:
  <proyecto>» en Mis proyectos. El diálogo «Editar equipo» y el botón de confirmación del diálogo de quitar no
  cambian.
- **Pruebas:** `CompetitionListPage.test.tsx` (nombres con el equipo, tooltip y `title` sin el equipo, nombre que
  sigue al equipo renombrado); `a11y.spec.ts`, `brand.spec.ts` y `responsive.spec.ts` buscan el botón por su nombre
  nuevo.
- **Medición en el navegador** (`O-1-O-2.json`): antes, ocho botones con dos nombres repetidos en la tabla y en las
  tarjetas; ahora, ocho nombres distintos en cada vista, por ejemplo «Editar equipo: Club Alfa …» y «Quitar de
  competición: Club Alfa …»; el tooltip visible sigue siendo «Editar equipo».

## 13. Registro de hallazgos

| ID | Tipo | Descripción | Estado | Incremento |
| --- | --- | --- | --- | --- |
| A11Y-01 | Accesibilidad (1.4.3) | Contraste de la trazabilidad (3.1). | Corregido, sin excepción en la suite | UI-06.2 |
| A11Y-02 | Accesibilidad (2.5.3, 4.1.2) | Nombre accesible frente al estado visible (3.2). | Corregido | UI-06.2 |
| R-02 | Responsive (1.4.10) | Tooltip de Inicio a 768 px (3.3). | Corregido | UI-06.2 |
| R-03 | Responsive y contraste (1.4.3, 1.4.10) | Vista previa de la revisión a 1280 × 720 (3.4). | Corregido, sin excepción en la suite | UI-06.2 |
| R-04 | Responsive (1.4.10) | Lienzo del editor sin ancho por debajo de 900 px (4). | Corregido | UI-06.2 |
| R-05 | Responsive (1.4.10) | Título de Competiciones a 320 px (4). | Corregido | UI-06.2 |
| A11Y-03 | Accesibilidad (1.4.13) | Tooltips sin cierre con Escape ni puntero (4). | Corregido | UI-06.2 |
| O-1 | Texto | Nota de Mi marca anterior a PD-28 (12). | Aprobado por el Product Owner e implementado | UI-06.2 |
| O-2 | Accesibilidad (mejora) | Acciones de la tabla de equipos sin el nombre del equipo (12). | Aprobado por el Product Owner e implementado | UI-06.2 |
| `@fastify/static` | Dependencias | Parche 10.1.11 (11). | Sin aplicar | UI-06.3, con autorización aparte |

Los hallazgos de UI-06.1 conservan su registro en el informe de ese incremento (sección 4.4), que no se modifica.

## 14. Limitaciones conocidas y pendientes

- **WCAG 2.2 AA no se declara.** Los resultados automáticos no bastan para una certificación. Quedan sin validar
  manualmente:
  - VoiceOver y otros lectores de pantalla (NVDA, JAWS, TalkBack);
  - el zoom real del navegador (200 % y 400 %), no solo su equivalente en tamaño de ventana;
  - los colores forzados (alto contraste de Windows, «Aumentar contraste» de macOS);
  - el comportamiento en dispositivos físicos (tabletas y móviles, pantallas táctiles);
  - la navegación compleja por teclado (el editor de plantillas, la edición del copy y los recorridos largos de la
    revisión).
- Las comprobaciones automáticas pasan (sección 10).
- **Navegador:** Chromium de escritorio con emulación de tamaño; no se probó en dispositivos táctiles reales,
  Safari ni Firefox. El zoom se emula con el tamaño de la ventana en píxeles CSS, que es lo que mide WCAG 1.4.10.
- **Colores forzados** (modo de alto contraste de Windows) y **lectores de pantalla** no tienen verificación
  automática.
- **Espaciado de texto:** se mide el desplazamiento horizontal, no el texto recortado dentro de un elemento.
- **Trazabilidad con disputa:** los datos sintéticos actuales no producen fuentes en conflicto; el componente es el
  mismo de «Datos y verificación» y usa la misma superficie clara.
- **Editor de plantillas:** se valida con una plantilla sintética servida al navegador; la vista previa con imagen
  y crear una plantilla real necesitan el proveedor de imágenes de pago.
- **Cambio de comportamiento a validar:** a 1280 × 720 la revisión ya no cabe en la ventana; la página se desplaza
  en vertical para dar a la vista previa al menos 34 rem de espacio de trabajo. A 1440 × 900 y más no cambia.
- **Editor por debajo de 900 px:** los paneles se apilan (capas, lienzo, propiedades); el panel de capas sigue
  plegado por defecto por debajo de 1280 px, como antes.

## 15. Validación manual recomendada

1. Revisión a 1280 × 720 en un portátil real: aprobar, cambiar de diapositiva y de modo, zoom y pantalla completa.
2. Trazabilidad de una diapositiva exportada: lectura y contraste en el panel claro.
3. Lector de pantalla (VoiceOver en macOS) en el carril y el inspector: el nombre de cada diapositiva coincide con su
   insignia y la aprobación deshabilitada anuncia sus motivos.
4. Tooltips con teclado y con ratón en Inicio a 768 px y en Equipos; Escape los cierra sin cerrar un diálogo.
5. Zoom real del navegador al 200 % y al 400 % en Inicio, Crear contenido, la revisión y Competiciones.
6. Editor de plantillas en una tableta en vertical (768 px) y en un móvil: capas, lienzo, propiedades y vista
   previa.
7. Colores forzados (Windows) o «Aumentar contraste» (macOS) en el shell, los botones y los diálogos.
8. Movimiento reducido del sistema: sin animaciones en la generación ni en los botones.
9. Navegación compleja por teclado: editar y guardar un copy, recorrer el editor de plantillas (capas, propiedades,
   lienzo con flechas) y una revisión completa sin ratón.
10. Equipos asociados con un lector de pantalla: la lista de controles distingue las acciones de cada equipo (O-2).

## 16. Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `apps/web/src/app/AppShell.tsx` | A11Y-01: la trazabilidad en el panel claro. |
| `apps/web/src/app/pages.tsx` | Enlace de la página de error de último recurso con el color del estudio. |
| `apps/web/src/ui/global.css` | Superficie y texto del estudio en el documento (R-03). |
| `apps/web/src/ui/primitives/Tooltip.tsx` (nuevo), `index.ts`, `Modal.tsx` | Primitiva `Tooltip`; `ViewModeToggle` la usa (R-02, A11Y-03). |
| `apps/web/src/features/review/ReviewPage.tsx` | Rejilla de la columna de revisión (R-03). |
| `apps/web/src/features/review/SlideWorkspace.tsx` | Anchos laterales entre `lg` y `xl` (R-03). |
| `apps/web/src/features/review/CarouselReview.tsx`, `ElementReview.tsx`, `model.ts`, `copy.ts` | A11Y-02. |
| `apps/web/src/features/projects/ProjectGeneratedContent.tsx` | A11Y-02 en el panel de la página del proyecto. |
| `apps/web/src/features/projects/ProjectCard.tsx` | Tooltips con `Tooltip` (A11Y-03). |
| `apps/web/src/features/competitions/pages/CompetitionListPage.tsx` | Título responsive (R-05). |
| `apps/web/src/features/competitions/pages/CompetitionTeamsPage.tsx`, `SeasonDetailPage.tsx`, `ImportPreviewPage.tsx` | Tooltips con `Tooltip` (A11Y-03); en Equipos, nombres accesibles con el equipo (O-2). |
| `apps/web/src/features/brand/copy.ts` | Nota de Mi marca (O-1). |
| `apps/web/src/features/visual-templates/TemplateEditorPage.tsx`, `editor/Workspace.tsx`, `editor/PreviewPanel.tsx` | Editor apilado por debajo de `md` y altura por modo (R-04). |
| Pruebas | Sección 9; para O-1 y O-2, `BrandPage.test.tsx`, `CompetitionListPage.test.tsx`, `brand.spec.ts` y los nombres en `a11y.spec.ts` y `responsive.spec.ts`. |
| Documentación | Este informe; alcance de UI-06; índice de WI-2; registro de decisiones; fuente de verdad (PD-35 y fila UI-06); evidencia en `evidence/UI-06/ui-06-2/`. |

## 17. Estado de Git

Rama `work/WI-2-UI-06`. El cierre de UI-06.2 está en `c2defce` (`c2defce797f41546b195b2c899189c7eb971a643`), sobre `cc0182d`; los commits de
UI-06.1 no cambian. Sin merge, push ni deploy. UI-06.3 no ha empezado.

## 18. Decisiones del Product Owner y cierre

### 18.1 Decisiones del 2026-11-13 («WI-2 / UI-06.2 — Aceptación y cierre técnico»)

1. Acepta los cambios de UI-06.2, sujetos a las verificaciones finales, y aprueba los siete hallazgos corregidos:
   A11Y-01, A11Y-02, A11Y-03, R-02, R-03, R-04 y R-05.
2. Aprueba O-1: la nota de Mi marca refleja PD-28 y PD-32, con su texto sugerido adaptado al espacio. Hecho: 12.
3. Aprueba O-2: el nombre accesible de las acciones de equipos incluye el nombre real del equipo, sin cambiar textos
   visibles ni añadir controles. Hecho: 12.
4. Conservar la evidencia antes y después y las capturas responsive, y registrar las limitaciones de la validación
   manual sin declarar WCAG 2.2 AA por los resultados automáticos. Hecho: 5, 14 y `evidence/UI-06/ui-06-2/`.
5. Si las verificaciones no encuentran defectos bloqueantes: actualizar este informe, el índice y la fuente de
   verdad, cerrar con un commit, registrar su hash y dejar el árbol limpio, sin merge, push ni deploy y sin empezar
   UI-06.3.

### 18.2 Cierre

Las verificaciones finales, con O-1 y O-2, pasan sin defectos bloqueantes (sección 10) y los siete hallazgos siguen
corregidos: sus pruebas pasan y ninguna excepción está declarada en la suite. **UI-06.2 queda aceptado por el
Product Owner y cerrado** en el commit `c2defce797f41546b195b2c899189c7eb971a643` de la rama `work/WI-2-UI-06`, sobre `cc0182d` y con solo los
cambios de este incremento. El hash se registra también en la fuente de verdad (fila UI-06) y en el registro de
decisiones del Product Owner (sección 7).

### 18.3 Pendientes concretos para UI-06.3

1. `@fastify/static` 10.1.11 (mismo mayor; quita los avisos de `glob` y `minimatch` en ejecución), solo con
   autorización aparte, con lock nuevo y las pruebas del servidor estático, CSP y cabeceras (informe de UI-06.1,
   7.3; sección 11).
2. Regresión de todas las suites y de los gates configurados.
3. Casos límite del plan de UI-06: textos largos en español e inglés, 20 diapositivas, conjuntos máximos de datos y
   errores de importación, estados lentos y fallidos, generación interrumpida.
4. Auditoría de los CSS Modules restantes (M5 de `tailwind-v4-migration-strategy.md`), entre ellos los de las
   páginas que siguen en el panel claro (Datos, Datos y verificación, trazabilidad).
5. Trazabilidad con una disputa entre fuentes: hace falta un escenario sintético con fuentes en conflicto.
6. La validación manual de la sección 15, si el Product Owner la incluye en ese incremento; sin ella WCAG 2.2 AA no
   se declara.
7. Comprobar el enlace de la página de error de sección (`RouteErrorPage`) dentro de las páginas del estudio: usa
   el color de enlace del panel claro sobre la superficie oscura. Es una observación de la revisión del código, no
   verificada con axe porque esa página solo aparece si falla la carga de una sección.
