# UI-06.3 — Regresión integral y estabilización final

**Estado:** aceptado por el Product Owner y cerrado el 2026-11-13 como incremento técnico (sección 22), con D06, D07
y D08 corregidos. Con él termina UI-06. WCAG 2.2 AA no se declara y la v1.0 no ha pasado la validación manual.
**Rama:** `work/WI-2-UI-06`, sobre `3c11a9a5d310d9a0fa188f7c0276a2b17cc9a164` (registro del cierre de UI-06.2). Los
commits de UI-06.1 y UI-06.2 no se modificaron.
**Origen:** instrucción del Product Owner «WI-2 / UI-06.3 — Regresión integral y estabilización final» (2026-11-13).
**Alcance:** [`ui-06-scope-and-increments.md`](ui-06-scope-and-increments.md), sección UI-06.3.
**Evidencia:** [`evidence/UI-06/ui-06-3/`](evidence/UI-06/ui-06-3/).

## 1. Resumen

- **Regresión integral en verde** (sección 4): 2597 unitarias, 730 de integración (sin fallos esperados), 2419 de
  contrato, 22 E2E y 44 de accesibilidad, responsive y teclado; typecheck, ESLint, Prettier,
  build, `npm audit` (0 altas), hash del contrato, escaneo de secretos, `git diff --check` y `npm ci` limpio.
- **v1.0 registrada como PD-36**: IA de imágenes solo para propuestas de plantilla, plantillas estructuradas por el
  operador, renderización determinista de las diapositivas finales sin IA de imágenes, IA editorial para los textos,
  aprobaciones independientes y publicación manual. Una prueba nueva demuestra AC-05: 0 peticiones al proveedor de
  imágenes en una generación, renderización y exportación completas con el proveedor configurado.
- **Escenarios extremos** de carrusel, datos deportivos y copy editorial, **errores y recuperación** y **fuentes en
  conflicto**: 8 archivos de prueba de integración nuevos y 4 de la web (secciones 5 a 7).
- **Nueve defectos reales encontrados y corregidos** (secciones 13, 21 y 22): el enlace de la página de error de sección
  (ERR-01), el estado seleccionado en colores forzados (FC-01), tres de la importación de proveedores (un conflicto con
  un valor protegido que no se mostraba, una procedencia manual sin proteger y un reintento imposible tras una caída
  parcial), nombres de clubes reales en dos pruebas (TD-01), el emoji compuesto del copy que no se podía volver a
  guardar (UI06.3-D07), el encabezado de `copy-editorial.txt` sin la jornada (UI06.3-D08) y el marcador de 100 o más
  que hacía fallar la confirmación del lote (UI06.3-D06, con el motivo nuevo `score_not_supported` autorizado).
- **`@fastify/static` 10.1.11 aplicado** (sección 11): mismo mayor, endurecimiento de seguridad, `npm audit` de 13 a 11
  moderadas, sin cambios en otras dependencias.
- **CSS Modules auditados**: 637 líneas de CSS sin consumidores eliminadas, sin cambio de estilos (sección 8).
- **Accesibilidad**: matriz PASS/FAIL/NOT TESTED/BLOCKED (sección 9). WCAG 2.2 AA no se declara.
- **Resolución final de pendientes** (secciones 21 y 22): el emoji compuesto (ZWJ) del copy ya se puede volver a
  guardar (UI06.3-D07), el encabezado de `copy-editorial.txt` usa la jornada (UI06.3-D08) y un marcador de 100 o más se
  excluye con su motivo sin rechazar el lote (UI06.3-D06). TEAM-DISPLAY-01 queda registrado como iniciativa posterior.
- **Cambios autorizados de contrato:** dos, aditivos y compatibles (21.2 y 22.2), y una migración nueva (0037) que solo
  amplía la restricción de los motivos de omisión y conserva cada fila; las migraciones anteriores no cambian.
- **Sin cambios** en las reglas de negocio, PD-28, PD-33, PD-34, PD-35 ni PD-36; sin reutilización de ZIP, sin
  proveedores nuevos y sin llamadas pagadas.

## 2. Inspección inicial

- Rama `work/WI-2-UI-06`, `HEAD` `3c11a9a`, árbol limpio.
- Leídos: `.orchestrate/source-of-truth.md` (PD-27 a PD-35, BR-06, la fila UI-06 de pendientes), los informes de
  UI-06.1 y UI-06.2 y el alcance de UI-06.
- Gates obligatorios (`.orchestrate/config.json`): `FW-TRACKER`, `FW-CONFIG`, `FW-SECURITY`, `FW-AC`,
  `PRJ-INSTALL` (`npm ci`), `PRJ-TYPECHECK`, `PRJ-LINT` (ESLint y Prettier), `PRJ-UNIT`, `PRJ-INTEGRATION`,
  `PRJ-CONTRACT`, `PRJ-CONTRACT-ID`, `PRJ-BUILD`, `PRJ-E2E`, `PRJ-A11Y` y `PRJ-AUDIT`.
- Pruebas al empezar: 2566 unitarias (web y servidor), 697 de integración, 2419 de contrato, 22 E2E y 40 de
  accesibilidad, responsive y teclado; todas en verde en el cierre de UI-06.2
  ([`ui-06-2-verification.txt`](evidence/UI-06/ui-06-2/ui-06-2-verification.txt)), sobre el mismo `HEAD`.
- Cobertura de casos extremos al empezar: calendarios paginados, escudos ausentes, copy aprobado y no exportable,
  fixtures de demostración con disputas (`fixtures/sports/disputed-*`), nombres con acentos (`accented-names`) y
  demasiadas diapositivas (`too-many-slides`), repartidos en pruebas de integración sin un recorrido de casos
  extremos de carrusel, deporte y copy.
- Deuda y riesgos conocidos: los pendientes de la sección 18.3 del informe de UI-06.2 (`@fastify/static`, casos
  límite, CSS Modules, trazabilidad con disputa, validación manual, enlace de la página de error de sección).

## 3. Definición de producto v1.0 (PD-36)

Registrada en `.orchestrate/source-of-truth.md` como **PD-36**, una decisión nueva que no reescribe las anteriores:

1. La IA de imágenes genera **propuestas visuales de plantillas** (PD-27; `providers/images`).
2. El operador revisa una propuesta aprobada y la convierte en una **plantilla estructurada y reutilizable**
   (PD-ARCH-01G-C). Una propuesta nunca es una diapositiva final.
3. Las plantillas tienen capas dinámicas, vínculos con datos deportivos y recursos de marca protegidos, en versiones.
4. Los datos deportivos vienen de competiciones locales, importaciones confirmadas y proveedores autorizados; los
   escudos, solo como permite PD-28.
5. El **motor de renderización** (`modules/rendering`, satori y resvg) produce las diapositivas finales con el
   snapshot de datos del proyecto y las plantillas publicadas o las del motor.
6. La generación de diapositivas finales **no usa IA generativa de imágenes**: generar propuestas de plantilla y
   dibujar las imágenes finales son operaciones distintas, y la segunda es determinista.
7. La IA editorial escribe textos a partir del contexto deportivo y las evidencias (PD-30, PD-ARCH-01H).
8. Diapositivas (con la aprobación final del carrusel) y textos tienen aprobaciones independientes (PD-33); cada
   descarga escribe una exportación nueva (PD-34).
9. El operador descarga los archivos y los publica a mano; no hay publicación automática.

Fuera de la v1.0: otros formatos, vídeo, publicación, programación, cuentas y la migración a la nube.

**Evidencia en el código:** el proveedor de imágenes solo se inyecta en el módulo de diseño (`container.ts` lo crea y
solo `modules/design/index.ts` lo recibe); el renderizador importa satori y resvg y ningún proveedor. La prueba nueva
`final-slides-without-image-ai.test.ts` lo comprueba en ejecución (sección 5).

## 4. Regresión integral

Ejecución final del 2026-11-13 sobre el árbol de UI-06.3, con la resolución final de pendientes y D06 (secciones 21
y 22)
([`ui-06-3-verification.txt`](evidence/UI-06/ui-06-3/ui-06-3-verification.txt),
[`ui-06-3-e2e.txt`](evidence/UI-06/ui-06-3/ui-06-3-e2e.txt),
[`ui-06-3-a11y.txt`](evidence/UI-06/ui-06-3/ui-06-3-a11y.txt)).

| Gate | Verificación | Resultado |
| --- | --- | --- |
| `PRJ-INSTALL` | `npm ci --ignore-scripts` con el lockfile nuevo, en una copia aislada (no se reinstaló el `node_modules` que usan los servidores de desarrollo) | Correcto |
| `PRJ-TYPECHECK` | `npm run typecheck` | Sin errores |
| `PRJ-LINT` | ESLint y Prettier | Sin errores ni advertencias |
| `PRJ-UNIT` | Unitarias (web y servidor) | 2597/2597 (149 archivos; 31 más que en UI-06.2) |
| `PRJ-INTEGRATION` | Integración | 730/730, 66 archivos, sin fallos esperados ni errores no gestionados (33 más que en UI-06.2) |
| `PRJ-CONTRACT` | Contrato | 2419/2419 |
| `PRJ-CONTRACT-ID` | Hash del contrato | Coincide: `8cadafd1…7a5a`, registrado con los dos cambios autorizados (21.2 y 22.2) |
| `PRJ-BUILD` | Build | Sin errores |
| `PRJ-E2E` | E2E | 22/22; E2E-F01 sigue como regresión normal |
| `PRJ-A11Y` | Accesibilidad, responsive y teclado | 44/44 (4 nuevas), sin excepciones declaradas |
| `PRJ-AUDIT` | `npm audit --audit-level=high` | 0 altas o críticas; 11 moderadas (antes 13) |
| Seguridad | Escaneo de secretos | 0 hallazgos |
| — | `git diff --check` | Limpio |

Las suites no llaman a proveedores deportivos ni a OpenAI: escritores `stub` o locales de prueba, proveedor de imágenes
de prueba sin red, datos sintéticos y directorios temporales; nunca `data/edr.sqlite`.

**Sin fallos esperados:** la prueba de UI06.3-D06, declarada con `it.fails` mientras el defecto estuvo abierto, es una
regresión normal desde su corrección (sección 22); evidencia en
[`ui-06-3-d06.txt`](evidence/UI-06/ui-06-3/ui-06-3-d06.txt).

**Incidencia durante la regresión, corregida:** la primera ejecución completa terminó con un error no gestionado: una
prueba nueva (`import-recovery.test.ts`) lanzaba una aplicación de importación en segundo plano y terminaba sin
esperarla. Ahora espera su fin; tres ejecuciones seguidas y la suite completa terminan sin errores.

**Mutación de los defectos del servidor:** sin las correcciones fallan exactamente sus tres pruebas
([`ui-06-3-defects-mutation.txt`](evidence/UI-06/ui-06-3/ui-06-3-defects-mutation.txt)).

## 5. Escenarios extremos

Pruebas nuevas de integración del servidor (`apps/server/test/integration/delivery/`), con datos sintéticos creados por
la API («Liga Sintética …», «Club Sintético …»), los escritores `stub` o un escritor local de prueba, y ninguna llamada
a proveedores reales: `extreme-carousels.test.ts` (4), `extreme-sports-data.test.ts` (8), `final-slides-without-image-ai.test.ts` (2), `extreme-editorial-copy.test.ts` (3) y
`editorial-copy-exports.test.ts` (1), con sus ayudantes `extreme-support.ts` y `editorial-copy-support.ts`.

### 5.1 Carruseles

| Escenario | Resultado y prueba |
| --- | --- |
| Una diapositiva | Ningún tipo lo permite: el mínimo es 3 (`MIN_SLIDES_PER_CAROUSEL`). El carrusel más pequeño (un resultado; una previa) es portada, contenido y cierre, exportado como `01`–`03.png` («a single result and a single preview…») |
| Varios partidos | 18, 19 y 32 partidos (nuevas); subconjuntos de una jornada en `local-content-batches.test.ts` |
| Veinte diapositivas | 18 resultados → un carrusel de 20 (el máximo, `maxSlidesPerCarousel`): generado, revisado, aprobado y exportado en orden |
| Por encima del máximo | 19 resultados → dos carruseles numerados (20 + 3, portadas 1/2 y 2/2), cada uno aprobado y exportado por separado; 33 partidos → 400 sin guardar nada; un límite de configuración de 21 se rechaza (`config.test.ts`) |
| Más de un carrusel por jornada | 19 → 2 carruseles; 32 resultados → 20 + 16; calendario de 32 partidos → 3 carruseles en un proyecto |
| Calendarios paginados | 32 partidos → páginas de 6, 6, 6, 6, 6 y 2 en 3 carruseles; 7 → 6 + 1 en `engine-calendar-rows.test.ts` |
| Escudos ausentes (PD-28, PD-32) | Hueco vacío y advertencia no bloqueante en el carrusel de 20 y en cada página del calendario de 32 |
| Aprobación individual y masiva | En el carrusel de 20: la aprobación de todas sin confirmar advertencias aprueba las elegibles y responde 409 `QA_ACK_REQUIRED` a las demás; la aprobación final rechazada nombra `not_approved` y `qa_ack_required` por diapositiva; después, aprobaciones individuales. 21 aprobaciones concurrentes sin pérdidas (19 partidos) |
| Aprobación final, descarga, manifiesto y orden | En los carruseles de 1, 20, divididos y de calendario: `01.png`…`NN.png` en el orden del carrusel a 1080 × 1350; registro de exportación = manifiesto = SHA-256 de cada archivo = PNG guardado; entradas del ZIP en el orden del registro; `carousel {sequence,total}` en el manifiesto |
| AC-05: las diapositivas finales no usan IA de imágenes | Con el proveedor de imágenes configurado y listo: todos los tipos de contenido, escudos, regeneración, aprobaciones, copy `stub`, exportación, ZIP y trazabilidad → 0 peticiones de imágenes, 0 llamadas a `generate` y `checkModelAccess`, ninguna generación de diseño y 0 salidas de red; control positivo: una generación de diseño hace exactamente una petición. Lo mismo con una plantilla visual publicada (ninguna petición después de la propuesta de la propia plantilla) |

### 5.2 Contenido deportivo

| Escenario | Resultado y prueba |
| --- | --- |
| Nombres de equipo muy largos, acentos y caracteres especiales | Competición de 80 caracteres, equipos de 64, una entrada NFD guardada como NFC: los nombres se conservan exactos en el render, el manifiesto, `caption.txt` y el ZIP, en español e inglés |
| Competiciones, temporadas y jornadas extensas | Nombres al máximo del contrato generados sin cortes; una fase y jornada de más de 80 caracteres se omite como `context_not_supported` (la web ya lo explica). Ver la limitación L-01 |
| Reglas de nombres | Los nombres fuera de las reglas se rechazan y las grafías equivalentes cuentan como un equipo |
| Marcadores de dos dígitos | 12-11, 99-98, 10-0 y 99-10 |
| Partidos pendientes, en curso y finalizados; datos incompletos | Todos los estados locales de una jornada, más `cancelled`, finalizado sin hora y marcador incompleto rechazado |
| Overrides manuales | Un equipo renombrado y un marcador corregido después de una exportación: la exportación anterior no cambia byte a byte, el proyecto queda congelado y un lote nuevo usa los valores nuevos |
| Marcador por encima de 99 | UI06.3-D06, corregido: el partido se excluye con `score_not_supported` y el lote sigue con los compatibles (sección 22) |

### 5.3 Copy editorial

| Escenario | Resultado y prueba |
| --- | --- |
| Español e inglés | Proyecto en español con cada límite; proyecto en inglés que exporta sus textos sin cambios, solo los aprobados |
| Textos extensos | Cada límite se acepta, aprueba y exporta byte a byte (titular 90, cuerpo de 100 a 160 palabras, pregunta 200, 8 hashtags con uno de 60 letras, TikTok 70 palabras, titulares 100, título de YouTube 100, descripción 1500 y un cuerpo de 5000 caracteres, el máximo del contrato); un carácter, palabra, hashtag o salto más se marca y la aprobación se rechaza con `CONTENT_FLAGGED` (13 casos); más de 5000 → 400 sin guardar nada |
| Emojis y Unicode | Emojis dentro y fuera del plano básico, tonos de piel, banderas, selectores de variación, acentos combinados, letras matemáticas y saltos de línea; secuencias con ZWJ desde el redactor. Las marcas de dirección (U+200E, U+200F, U+202E…) y otros caracteres de control nunca se aceptan y nunca llegan al ZIP |
| Copy parcialmente aprobado | Exportaciones con uno y con varios entregables aprobados |
| Editado después de aprobar | La versión nueva no está aprobada; aprobar la anterior → 409 `VERSION_CONFLICT`; ninguno de los dos textos se exporta |
| Retirado | Su texto sale de la exportación siguiente |
| Deja de ser publicable | Aprobado pero no exportable hasta la exportación y el ZIP (proyecto de Copa Demo con dos carruseles) |
| Exportaciones sucesivas | Cinco exportaciones, cada una en su carpeta, de la más reciente a la más antigua, con la misma aprobación final; cada ZIP anterior se vuelve a descargar idéntico y las diapositivas coinciden en todos |
| Integridad de `copy-editorial.txt` | Comparado byte a byte con un texto construido desde el formato aceptado (no desde el código de exportación): UTF-8 estricto sin BOM ni CR, termina en salto de línea, orden de secciones; entrada del ZIP igual al archivo en disco; el manifiesto lista el hash del archivo y, por sección, versión, número, fecha de aprobación y hash del texto. El ZIP se lee con un lector propio (firmas, CRC-32, nombre UTF-8, método almacenado) |

## 6. Errores y recuperación

Inventario de lo que ya se probaba y pruebas nuevas para los huecos: `recovery.test.ts` e `import-recovery.test.ts`
(servidor) y `RunProgress.failures.test.tsx` y `ReviewDownload.recovery.test.tsx` (web).

| Situación | Cobertura |
| --- | --- |
| Error de importación | Existentes: `manual-import.spec.ts` (E2E), `imports.int`, `manual-import.test.ts`, `import-apply.int` (deshace todo y se puede reintentar). Nueva: un timeout del proveedor falla la operación con `PROVIDER_FAILED` y mensaje en español, sin guardar nada, y el reintento termina |
| Datos inválidos | Existentes: pruebas de datos malformados de investigación, del proveedor de fixtures, de importación adversa y manual |
| Timeout | Existentes: escenario `timeout` con reinicio y reintento; credenciales. Nuevas: timeout de importación; etiqueta en español del timeout en el progreso |
| Generación interrumpida | Existentes: `runner.test.ts`, proyectos, diseño, importación con reinicio. Nueva: etiqueta de la interrupción. La generación editorial interrumpida por un reinicio no tiene prueba (sección 15) |
| Operaciones canceladas | Existentes: operaciones de importación, ejecuciones, borrado de proyectos, vista previa de importación. La exportación y el render no tienen cancelación en el contrato |
| Reinicio del servidor | Existentes: `failure-restart.spec.ts` (E2E), historial de exportaciones, investigación. Nueva: el registro de disputa y los hechos anteriores sobreviven a un reinicio |
| Pérdida de conectividad | Existentes: `failure-restart` (proveedor no disponible), credenciales, `ErrorBanner`, cliente. Nuevas: una caída parcial deja la vista previa incompleta, se rechaza en español y no escribe nada (con la corrección de UI06.3-D05 el reintento vuelve a consultar al proveedor); mensaje de conexión perdida en la descarga |
| Errores de persistencia | Existentes: fallo de disco en la aplicación de importaciones, SQLite, migraciones. Nuevas: la escritura de una exportación falla a medias → 500, nada registrado, aprobación final conservada, carpeta parcial sin referencia y reintento en una carpeta nueva; directorio de exportaciones sin permisos (se omite si se ejecuta como root) |
| Recursos gráficos ausentes | Existentes: archivo de marca, escudo sobrescrito. Nueva: el archivo de un recurso de marca borrado hace fallar la redacción en el render con `internal`, sin exponer rutas; la exportación anterior sigue intacta; se recupera al restaurar el archivo |
| Errores de renderización | Existentes: etapa de render, escudos (500). Nuevas: el caso anterior; etiqueta del error interno |
| Errores de exportación | Existentes: integridad y escenarios A, B y C. Nuevas: falta el render de una diapositiva → 500, sin carpeta ni registro, aprobación conservada, reintento tras restaurarlo; en la web, el 500 se explica en español sin decir que la aprobación dejó de valer y se reintenta; mensajes de `EXPORT_FILES_MISSING` y `CORRUPT`; un doble clic envía una sola petición |

Garantías comprobadas: las aprobaciones válidas se conservan tras los fallos de exportación; ninguna exportación
incompleta queda registrada (0 filas en `exports` y `export_files`); sin duplicados (idempotencia de importación y doble
clic); los snapshots no cambian (hechos y versiones de la ejecución anterior, exportación anterior tras una redacción
fallida); mensajes comprensibles en español y reintento donde el contrato lo permite.

Nota de diseño, no un defecto: una nueva redacción cuya etapa de contenido termina sustituye al borrador aprobado e
invalida su aprobación final aunque el render falle después; el carrusel anterior responde 409
`FINAL_APPROVAL_REQUIRED`. La prueba fija este comportamiento.

## 7. Trazabilidad de fuentes en conflicto

Existen dos mecanismos, y los dos están cubiertos con datos sintéticos y sin APIs reales:

1. **Importación de un proveedor contra un valor manual** (competiciones locales; procedencia por campo).
2. **Verificación de un hecho entre dos fuentes deportivas** (fixtures de demostración `disputed-*`).

| Mecanismo | Paso | Verificado por |
| --- | --- | --- |
| 1 | El valor importado guarda su procedencia `provider` (clave, referencia externa, valor y aplicación) | Nueva: `source-conflicts.test.ts`; existente: `import-apply.int` |
| 1 | La corrección del operador es un `manual_override` protegido que conserva el valor del proveedor, con su evento | Nueva y existente |
| 1 | Una observación nueva del proveedor (2-2) contradice la corrección (3-1) y la vista previa muestra el conflicto | Nueva; fallaba con el formato real de hora del proveedor: **UI06.3-D03, corregido** |
| 1 | El plan conserva el valor local por defecto, solo ofrece `accept_incoming` y no se bloquea | Nueva y existente |
| 1 | Aplicar sin decisión no sustituye el valor, su protección, procedencia, eventos ni historial; `notApplied` y el historial lo registran | Nueva |
| 1 | Solo una aceptación explícita y auditada lo sustituye: fila de decisión, evento `accept_provider` e historial | Nueva y existente |
| 1 | Una hora reprogramada a mano se conserva frente a una hora posterior del proveedor, con su procedencia protegida | Nueva; la procedencia quedaba sin proteger: **UI06.3-D04, corregido** |
| 1 (web) | El conflicto se presenta con texto («Conflicto», Local / Entrante / Base importada, «Se conserva el valor local por defecto»); conservar es lo predeterminado; confirmar envía `decisions: []`; solo el selector etiquetado envía `accept_incoming`; el resultado dice «se conservó el valor local» | Nueva: `ImportPreviewPage.conflicts.test.tsx` (3) |
| 2 | Un hecho en disputa bloquea la publicación y la aprobación manual se rechaza | Existentes: `verification.test.ts`, `verification-status.test.ts`, `ManualApproval.test.tsx` |
| 2 | El registro de disputa conserva las dos observaciones con sus fuentes, grupos y evidencia; el partido sale del contenido; persiste tras un reinicio | Nueva: `source-conflicts.test.ts` |
| 2 | Una ejecución posterior en disputa no reescribe el valor verificado de la anterior | Nueva |
| 2 (web) | Tabla del registro (título, cabeceras de columna y de fila), cada resultado dicho con palabras, valor resuelto solo si se resolvió, sin controles; la tarjeta en disputa no muestra valor ni botones | Nueva: `DisputeRecord.test.tsx` (10); existentes: `FactsPage.test.tsx`, `TracePage.test.tsx` |

La accesibilidad de la página «Datos y verificación» y de la trazabilidad se escanea con axe en la suite (incluida una
ejecución de demostración); los fixtures de disputa de demostración no llegan a una exportación, porque la disputa
bloquea la publicación, así que la trazabilidad de una diapositiva exportada no puede mostrar una disputa.

## 8. Auditoría de CSS Modules

Inventario de los ocho CSS Modules que quedan en `apps/web/src`, con sus consumidores y las clases que ningún
consumidor referencia (detalle en
[`ui-06-3-css-modules-audit.txt`](evidence/UI-06/ui-06-3/ui-06-3-css-modules-audit.txt)):

| Módulo | Consumidores | Clasificación | Clases sin referencia | Acción |
| --- | --- | --- | --- | --- |
| `features/facts/Facts.module.css` | 6 (Datos y verificación, trazabilidad) | En uso; legacy necesario (panel claro) | 1 (`visuallyHidden`, duplicado de `sr-only`) | Eliminada |
| `features/history/History.module.css` | 2 (`TracePage`, `ExportFiles`) | En uso; legacy necesario; parcialmente obsoleto (restos de las páginas de exportación anteriores a UI-05B) | 12 | Eliminadas (21 reglas) |
| `features/imports/Imports.module.css` | 11 (Datos) | En uso; legacy necesario | 0 | Sin cambios |
| `features/projects/Projects.module.css` | 3 (`ProjectDetailPage`, `RunProgress`, `SelectionFields`) | En uso; parcialmente obsoleto (formulario de creación guiada retirado por PD-ARCH-01F) | 33 | Eliminadas (87 reglas o selectores) |
| `features/review/Review.module.css` | 8 (revisión) | En uso | 0 | Sin cambios |
| `ui/ErrorBanner.module.css` | 1 | En uso; parcialmente obsoleto (tabla de errores trasladada a `ImportErrorTable`) | 2 (`tableWrapper`, `table`) | Eliminadas |
| `ui/Notice.module.css` | 4 | En uso | 0 | Sin cambios |
| `ui/StatusBadge.module.css` | 1 (acceso dinámico por tono) | En uso | 0 | Sin cambios |

- **Duplicados que siguen en uso** (no se migran, por la instrucción de no hacer una migración masiva):
  `visuallyHidden` en `Imports` y `Review` (equivale a `sr-only` de Tailwind) y `tableWrapper`/`table` en `History`,
  `Imports` y `Projects`. Quedan para una migración futura.
- **Cómo se demostró que no tenían consumidores:** un CSS Module solo aplica una clase cuando un componente la
  referencia por el objeto del módulo; el análisis recorre cada consumidor (`styles.x` y `styles['x']`), ninguno usa
  `:global` ni `composes`, y `StatusBadge` (acceso dinámico) se excluyó. Se eliminaron los selectores con alguna clase
  sin referencia, que nunca podían coincidir; en las listas de selectores solo se quitó el selector afectado.
- **Sin cambio de comportamiento:** huellas de 25 propiedades de estilo calculado de cada elemento de seis páginas
  (proyecto con sus desplegables, Datos y verificación, exportación, trazabilidad, Crear contenido y Datos con
  errores; 1852 elementos) antes y después, a 1280 × 900: cero diferencias. El ancho y el alto se excluyeron porque
  dependen de los nombres sintéticos de cada ejecución. Las suites E2E, de accesibilidad y responsive pasan.
- **Resultado:** 637 líneas menos de CSS sin uso. Design system sin cambios.

## 9. Accesibilidad

### 9.1 Automática

axe (WCAG 2.0, 2.1 y 2.2, A y AA, serio y crítico) en todas las pantallas escaneadas sin excepciones declaradas;
responsive y reflow en 34 pantallas y 7 tamaños; teclado, foco y diálogos (suite `@a11y`, sección 4). UI-06.3 añade:
la página de error de sección (10), la edición del copy con teclado, el editor de plantillas con teclado (seleccionar
una capa con Enter y moverla con flechas y Mayús+flechas) y la distinción del estado seleccionado en colores forzados.

### 9.2 Revisión estructurada

Estados: **PASS** (verificado), **FAIL** (defecto encontrado; se indica si se corrigió), **NOT TESTED** (no
realizado), **BLOCKED** (no realizable en este entorno). La columna «Revisión del agente» es una revisión hecha por el
agente en Chromium (navegación por teclado con Playwright y lectura de capturas); no sustituye la validación humana,
que figura aparte y no se marca como hecha por el resultado de una prueba automática.

| Verificación | Automática | Revisión del agente (Chromium) | Validación humana |
| --- | --- | --- | --- |
| VoiceOver y otros lectores de pantalla | Nombres, roles y relaciones con axe y Testing Library | BLOCKED: el agente no puede oír ni manejar un lector de pantalla | NOT TESTED |
| Navegación completa por teclado | PASS: 40 paradas de Tab en revisión, asistente, Mi marca y Competiciones a 1280 y 390 px; pestañas; menú; diálogos | PASS: copy editorial (elegir entregable, editar, guardar) y editor de plantillas (capa con Enter, flechas) | NOT TESTED |
| Foco visible | PASS en cada parada y en los diálogos | PASS también en colores forzados (anillo `Highlight`); FAIL en la página de error de sección (anillo del panel claro), corregido (ERR-01) | NOT TESTED |
| Diálogos y restauración del foco | PASS: subir recurso, editar equipo y aprobación masiva a 1280 y 390 px; Escape del menú y de los tooltips | PASS | NOT TESTED |
| Zoom real al 200 % y 400 % | Equivalente en tamaño de ventana (640 × 360 y 320 × 256): PASS | NOT TESTED con el zoom real del navegador | NOT TESTED |
| Reflow | PASS a 320 px en 34 pantallas | PASS | NOT TESTED |
| Contraste | PASS (axe, sin excepciones); FAIL en la página de error de sección, corregido (ERR-01) | PASS en las capturas revisadas | NOT TESTED |
| Estados deshabilitados | PASS (aprobación según el estado, motivos de la aprobación final) | PASS: en colores forzados se distinguen (color del sistema para texto deshabilitado) | NOT TESTED |
| Movimiento reducido | PASS (ninguna animación ni transición con `reduce`) | PASS | NOT TESTED con el ajuste del sistema |
| Colores forzados | PASS tras la corrección (prueba nueva) | FAIL: pestaña seleccionada, página actual y capa seleccionada indistinguibles (FC-01); corregido con `forced-colors:` y colores del sistema. PASS tras la corrección en la emulación de Chromium | NOT TESTED en Windows ni macOS reales |
| Editor de plantillas | PASS (7 tamaños; teclado; colores forzados) | PASS | NOT TESTED |
| Revisión editorial | PASS (pestañas, edición y guardado con teclado) | PASS | NOT TESTED |
| Revisión gráfica | PASS (carril, inspector, aprobaciones, R-03) | PASS | NOT TESTED |
| Asistente de generación | PASS (tab order y foco en los cinco pasos; reflow) | NOT TESTED: elegir opciones de los selectores nativos solo con teclado | NOT TESTED |

**Conclusión:** no se declara el cumplimiento de WCAG 2.2 AA. Las verificaciones automáticas pasan y la revisión del
agente encontró y corrigió dos defectos, pero faltan los lectores de pantalla, el zoom real, los colores forzados en un
sistema real, los dispositivos físicos y la navegación compleja por teclado hecha por una persona.

Evidencia: [`colores-forzados/`](evidence/UI-06/ui-06-3/colores-forzados/) (capturas antes y después de FC-01).

## 10. Página de error de sección

- **Defecto reproducido (ERR-01):** si falla la carga de una sección del estudio (por ejemplo, el código de
  Exportaciones), el router muestra la página de error de sección dentro del marco, sobre la superficie oscura. Su
  enlace «Volver a la lista de proyectos» usaba el color de enlace del panel claro (`#0b4f8a`): axe lo marcaba como
  contraste insuficiente (`color-contrast`, serio) y el anillo de foco también era el del panel claro.
- **Corrección:** `RouteErrorPage` mira la superficie de la ruta (`contentVariantOf`). En el estudio, el enlace usa
  las mismas clases que los enlaces de la ruta de navegación del shell: `text-text-link`, subrayado,
  `hover:text-text-primary` y `focus-studio`. En el panel claro no cambia. Sin rediseño.
- **Verificado:** prueba E2E nueva en `a11y.spec.ts` que corta la carga del código de la sección, comprueba axe sin
  violaciones, llega al enlace con Tab, comprueba el color y el anillo de foco del estudio y vuelve a Inicio con
  Enter; dos pruebas unitarias en `App.test.tsx` (superficie del estudio y panel claro). El mensaje del error nunca
  se muestra.

## 11. `@fastify/static` 10.1.11

| Comprobación | Resultado |
| --- | --- |
| Versión instalada | 10.1.6 |
| Versión mayor | 10 en ambas; sin cambios incompatibles en la API que usa el servidor (`root`, `prefix`, `dotfiles`, `list`, `index`, `redirect`, `wildcard`, `allowedPath`, `sendFile`) |
| Cambios del paquete (comparación de los paquetes publicados) | Endurecimiento: rechaza rutas no canónicas (`//`, segmentos `.`), alias de mayúsculas y `%23`/`%3F` codificados; vuelve a comprobar `allowedPath` sobre el archivo final; trata las promesas rechazadas de `sendFile`. Tipos: `allowedPath` recibe `root: string \| undefined`; nuestra firma `(pathName: string) => boolean` es compatible |
| Stack | Node 22.22.2 (`glob` 14 pide Node 20 o ≥ 22); `fastify` 5.12.7 sin cambios; `@fastify/send` 4.2.0 ya instalado |
| Lockfile | Solo la cadena del plugin: `@fastify/static` 10.1.11, `glob` 14.0.6, `path-scurry` 3.0.0, `minimatch` 11.0.8 anidado bajo `glob`, `@isaacs/nonrecursive-glob-match` 1.1.0 (nuevo, licencia BlueOak-1.0.0 como `glob`); `minimatch` 10.2.6 queda solo para desarrollo. Ninguna otra dependencia cambia |
| Advisories | Desaparecen GHSA-3g3m-2fjr-6pw4 (`glob`) y la ruta de ejecución de GHSA-g3hv-75wg-m249 (`minimatch`). `npm audit`: de 13 a 11 moderadas, 0 altas o críticas. Quedan `fflate` (OD-33, no alcanzable) y `minimatch` en las herramientas de desarrollo (`eslint`, `typescript-eslint`), sin corrección sin bajar de versión mayor |
| Pruebas del servidor estático | Las 20 existentes pasan (raíz, archivos ocultos, rutas fuera de la raíz, sin listado, SPA, `/api` sin SPA, guardas de Host y de mutación) y dos nuevas fijan el endurecimiento: rutas no canónicas y alias responden el 404 del producto, nunca el archivo ni un 500; los recursos con parámetros y la ruta normalizada se siguen sirviendo |
| Instalación limpia | `npm ci --ignore-scripts` con el lockfile nuevo, en una copia aislada: correcto |
| Cambio de comportamiento | Una navegación con `//` en la ruta recibe el 404 del producto en lugar de la aplicación; las rutas de la SPA no usan `//` |

Recomendación: **actualizado** a 10.1.11 con versión exacta en `apps/server/package.json`.

## 12. Políticas preservadas

PD-28 (escudos), PD-33 (aprobaciones independientes), PD-34 (exportación nueva por descarga, sin reutilización de
ZIP), PD-35 (nota de Mi marca y nombres accesibles), snapshots inmutables, versionado de plantillas, exportaciones
históricas, protección de los recursos de marca, generación determinista de diapositivas y ausencia de publicación
automática. Ninguna regla de negocio ni proveedor cambia; el contrato solo cambia en lo autorizado (21.2 y 22.2) y hay
una migración nueva, la 0037 (22.3). Las pruebas nuevas lo comprueban donde aplica: exportaciones anteriores idénticas byte a byte, aprobaciones
conservadas tras los fallos, valores protegidos que no se sustituyen sin una decisión explícita, y ninguna petición al
proveedor de imágenes al generar las diapositivas.

## 13. Defectos encontrados y corregidos

| ID | Área | Defecto | Causa | Estado |
| --- | --- | --- | --- | --- |
| ERR-01 | Web, página de error de sección | Enlace con contraste insuficiente y anillo de foco del panel claro sobre la superficie del estudio | Clases del panel claro en todas las superficies | Corregido (10) |
| FC-01 | Web, colores forzados | Pestaña seleccionada, página actual del menú y capa seleccionada indistinguibles | El estado dependía de un fondo o de un borde dorado que el modo forzado neutraliza | Corregido con `forced-colors:` y colores del sistema en `Tabs`, `AppShell` y `LayerList`; sin efecto en el modo normal |
| UI06.3-D03 | Servidor, vista previa de importación | Un partido ya importado con un valor manual protegido aparecía como «nuevo», sin conflicto, cuando el proveedor envía la hora sin milisegundos (`…:00Z` frente a `…:00.000Z`). No se sustituía ningún dato | Comparación literal de la hora (`import-preview.ts`) | Corregido: se comparan instantes con `normalizeKickoff` |
| UI06.3-D04 | Servidor, procedencia por campo | Una edición manual de un partido importado (hora, estado, fase o jornada) se registraba como `manual`, no como `manual_override` protegido; la página de la temporada lo contaba mal. El plan conservaba el valor igualmente | `resourceOf('match')` buscaba la identidad bajo `match` y las importaciones la guardan bajo `matches` (`field-provenance.ts`) | Corregido |
| UI06.3-D05 | Servidor, vista previa y operación de importación | Tras una caída parcial del proveedor, el reintento que pide el mensaje («Genera otra vista previa») devolvía la misma vista previa incompleta durante 30 minutos sin volver a consultar al proveedor | La reutilización de instantáneas no miraba si estaban incompletas (`import-preview.ts`, `import-operation.ts`) | Corregido: una instantánea incompleta nunca se reutiliza; el criterio es el mismo que bloquea el plan (`previewIncomplete`) |
| UI06.3-D06 | Servidor, lotes de contenido locales | Un marcador de 100 o más se acepta al registrar el resultado y la vista previa da la pieza por lista, pero la confirmación rechaza todo el lote con 409 `CONTENT_BATCH_NOT_GENERATABLE` (tampoco genera la pieza válida) | El snapshot congelado solo admite marcadores de 0 a 99 y la regla de elegibilidad local no lo comprueba | Corregido con el motivo `score_not_supported`, autorizado por el Product Owner (22) |
| UI06.3-D07 | Contrato y servidor, edición del copy | Un emoji compuesto con ZWJ que produce el redactor se aprueba y exporta, pero al editar ese campo la edición se rechaza con 400 | El patrón `Note` de `EditorialEditField.text` excluye todo carácter de formato, incluido U+200D, mientras la comprobación del contenido lo admite dentro de un emoji (T10-A1-05) | Corregido con un cambio de contrato autorizado (21.2) |
| UI06.3-D08 | Servidor, `copy-editorial.txt` | El encabezado usaba solo la fase («Temporada Regular»), y dos jornadas de la misma fase compartían encabezado | `editorialCopyText` no usaba la jornada del proyecto | Corregido (21.3) |
| TD-01 | Pruebas | `visual-template-projects.test.ts` y `structured.test.ts` usaban nombres de clubes reales (con marcadores inventados en la primera), contra los datos sintéticos de SC-04 | Datos de prueba | Corregido: nombres sintéticos que conservan acentos, diéresis y longitudes |

Los tres defectos del servidor se demostraron con una mutación: sin las correcciones fallan exactamente sus tres
pruebas; con ellas pasan (sección 4). Esas correcciones no tocan el contrato, las migraciones ni las reglas de
negocio. UI06.3-D07 y D08 se resolvieron después (sección 21) y UI06.3-D06 con su autorización (sección 22).

## 14. Registro de riesgos de la v1.0

| ID | Riesgo | Impacto | Mitigación o decisión | Estado |
| --- | --- | --- | --- | --- |
| RV-01 | Accesibilidad sin validación humana (lectores de pantalla, zoom real, colores forzados reales, dispositivos, teclado complejo) | Medio | Validación manual de la sección 17; WCAG 2.2 AA no se declara | Abierto |
| RV-02 | UI06.3-D06: marcador ≥ 100 rechazado al confirmar el lote | Bajo | Motivo `score_not_supported` autorizado e implementado (22) | Cerrado |
| RV-03 | L-01: con nombres al máximo del contrato algunas diapositivas no se pueden aprobar (`text_fit` o titular del redactor por encima de su límite) y regenerar no lo resuelve | Medio | Decisión del Product Owner del 2026-11-13: nombres de presentación por equipo, configurados a mano. Requiere migración, contrato y varios subsistemas, así que se propone como refinamiento separado de UI-06.3 (sección 20) | Abierto; refinamiento propuesto |
| RV-04 | Un emoji compuesto con ZWJ que produce el redactor no se podía volver a guardar al editar | Bajo | UI06.3-D07: patrón de edición ampliado con autorización | Cerrado |
| RV-05 | El encabezado de `copy-editorial.txt` usaba la fase y no la jornada | Bajo | UI06.3-D08: encabezado con la jornada; solo cambian las exportaciones nuevas | Cerrado |
| RV-06 | Avisos moderados restantes de `npm audit`: `fflate` (OD-33, no alcanzable) y `minimatch` en ESLint (desarrollo) | Bajo | Sin corrección sin bajar de versión mayor; revisar cuando `satori` y `eslint` publiquen versiones nuevas | Aceptado |
| RV-07 | Importaciones de proveedores reales sin recorrido en el navegador (las pruebas usan adaptadores de prueba) | Medio | Integración y pruebas web con adaptadores de prueba; validación manual con el proveedor autorizado | Abierto |
| RV-08 | Cobertura de un solo navegador (Chromium) | Medio | Validación manual en Safari y Firefox | Abierto |
| RV-09 | El editor de plantillas se valida en el navegador con una plantilla sintética; las propuestas reales necesitan el proveedor de imágenes de pago | Bajo | Pruebas de integración del módulo; validación manual con una propuesta real | Abierto |
| RV-10 | Una redacción nueva invalida la aprobación final aunque el render falle después | Bajo | Comportamiento de diseño fijado por la prueba; el operador vuelve a aprobar | Aceptado |
| RV-11 | La generación editorial interrumpida por un reinicio no tiene prueba | Bajo | El escritor tiene timeout y la regeneración es manual | Abierto |
| RV-12 | `@fastify/static` 10.1.11 responde con el 404 del producto a rutas con `//` | Bajo | La SPA no genera esas rutas; pruebas del servidor estático | Aceptado |
| RV-13 | Aplicación local de un solo operador; la nube está fuera de la v1.0 | — | PD-36 | Fuera de alcance |

## 15. Limitaciones pendientes

- **Validación manual pendiente:** VoiceOver y otros lectores de pantalla; zoom real del navegador; colores forzados en
  Windows y macOS; dispositivos físicos; navegación compleja por teclado hecha por una persona. WCAG 2.2 AA no se
  declara.
- **L-01, nombres al máximo:** con equipos de 64 caracteres y temporada o jornada de 80, la portada, las filas del
  calendario y la previa no pasan el ajuste de texto, y el titular del redactor `stub` supera su límite; regenerar no
  lo resuelve. Los nombres no se cortan nunca. La solución decidida (nombres de presentación) queda como refinamiento
  separado (sección 20).
- **Observaciones del copy:** los títulos de sección y el encabezado siguen en español en los proyectos en inglés
  (coincide con el formato aceptado, que no tiene variante inglesa); un cuerpo puede contener una línea que imite una
  sección, aunque el manifiesto identifica las secciones reales por su hash. El `.txt` que la web descarga desde el
  menú de la revisión (no es el archivo del ZIP) sigue con su encabezado propio, con la fase.
- **Títulos de proyecto** de más de 200 caracteres se cortan sin puntos suspensivos.
- **Sin prueba:** generación editorial interrumpida por un reinicio; cancelación de exportaciones y del render (el
  contrato no la ofrece); escudo borrado del disco (sigue el mismo camino de lectura que el recurso de marca, que sí
  se prueba).
- **Un navegador:** Chromium.

## 16. Estado de preparación de la v1.0

| Criterio | Estado |
| --- | --- |
| AC-01 Todas las suites obligatorias pasan | Cumplido (sección 4), sin fallos esperados declarados |
| AC-02 Sin defectos nuevos bloqueantes | Cumplido: nueve defectos encontrados y corregidos |
| AC-03 Escenarios extremos cubiertos por pruebas | Cumplido (sección 5), con la excepción de «una diapositiva», que el producto no permite (mínimo 3) |
| AC-04 La exportación mantiene su consistencia | Cumplido: orden, hashes, manifiesto, ZIP, exportaciones sucesivas y fallos sin registros incompletos |
| AC-05 La generación determinista no invoca IA de imágenes | Cumplido: 0 peticiones con el proveedor configurado (sección 5.1) |
| AC-06 Snapshots y aprobaciones históricas preservados | Cumplido (secciones 5.2, 6 y 7) |
| AC-07 Los datos inconsistentes no se aceptan en silencio | Cumplido tras UI06.3-D03 y D04: el conflicto se muestra y el valor protegido solo cambia con una decisión explícita |
| AC-08 Accesibilidad documentada | Cumplido (sección 9), con la validación humana pendiente |
| AC-09 Dependencias evaluadas | Cumplido: `@fastify/static` 10.1.11 aplicado; avisos restantes clasificados |
| AC-10 Definición de la v1.0 registrada | Cumplido: PD-36 |
| AC-11 Flujos de proyecto, generación, revisión y descarga funcionales | Cumplido: E2E y accesibilidad en verde |
| AC-12 Nada fuera del alcance | Cumplido: sin formatos, pantallas, proveedores ni reglas nuevas; TEAM-DISPLAY-01 separado |

**Preparación:** la v1.0 local queda técnicamente lista para su cierre, sujeta a la aceptación de este incremento, a
la validación manual (accesibilidad, dispositivos y recorrido completo), que no se ha realizado. L-01 queda como
limitación conocida, con TEAM-DISPLAY-01 como iniciativa posterior (21.4).

## 17. Instrucciones de validación manual

1. **VoiceOver (macOS):** recorrer Inicio, Crear contenido, la revisión (carril, inspector, aprobación y descarga),
   el copy editorial y Competiciones → Equipos con VO + flechas y el rotor; comprobar que cada control dice su nombre,
   su estado y, si está deshabilitado, sus motivos.
2. **Zoom real:** Cmd + hasta 200 % y 400 % en Inicio, Crear contenido, la revisión y Competiciones; sin
   desplazamiento horizontal y sin funciones ocultas.
3. **Colores forzados:** Windows con un tema de contraste, o macOS con «Aumentar contraste»; comprobar la pestaña
   seleccionada, la página actual, la capa seleccionada, el foco y los botones deshabilitados.
4. **Dispositivos físicos:** una tableta en vertical y un móvil: navegación, revisión, editor de plantillas y descarga.
5. **Teclado:** un recorrido completo sin ratón: crear contenido (eligiendo en los selectores), revisar y aprobar,
   editar y aprobar un copy, aprobación final y descarga; y el editor de plantillas (capas, propiedades, lienzo).
6. **Página de error de sección:** con la red de desarrollo cortada al cambiar de sección, el enlace se lee y se ve
   el foco.
7. **Conflicto de importación:** con el proveedor autorizado, corregir a mano un marcador importado y volver a
   previsualizar: aparece el conflicto y se conserva el valor local por defecto.

## 18. Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `.orchestrate/source-of-truth.md`, `.orchestrate/config.json` | PD-36 (v1.0), la fila UI-06 y TEAM-DISPLAY-01 en los pendientes, y el hash nuevo del contrato con su nota (sección 6) |
| `contracts/http-api.openapi.yaml`, `packages/contracts/src/http/primitives.ts`, `packages/contracts/src/http/editorial.ts` | UI06.3-D07: patrón `EditorialText` del texto editado (21.2) |
| `apps/server/src/modules/export/manifest.ts`, `manifest.test.ts` | UI06.3-D08: encabezado de `copy-editorial.txt` con la jornada (21.3) |
| `packages/contracts/src/http/content-batches.ts`, `packages/contracts/src/http/imports.ts`, `contracts/http-api.openapi.yaml` | UI06.3-D06: motivo `score_not_supported` y el límite compartido `IMPORT_SCORE_MAX` (22.2) |
| `apps/server/migrations/0037_content_skip_reason_score_not_supported.sql` (nueva), `apps/server/src/platform/db/migrations.int.test.ts`, `schema.int.test.ts` | UI06.3-D06: restricción de los motivos de omisión (22.3) |
| `apps/server/src/providers/sports/ingestion/local-selection.ts`, `apps/web/src/features/projects/generationCopy.ts`, `GenerateContentPage.test.tsx`, `apps/server/test/integration/delivery/extreme-sports-data.test.ts` | UI06.3-D06: regla de elegibilidad, texto del motivo y pruebas (22) |
| `apps/server/package.json`, `package-lock.json` | `@fastify/static` 10.1.11 (11) |
| `apps/server/src/modules/competitions/import-preview.ts`, `import-operation.ts`, `import-transform.ts`, `field-provenance.ts` | UI06.3-D03, D04 y D05 |
| `apps/server/src/platform/http/static.test.ts` | Dos pruebas del endurecimiento de `@fastify/static` |
| `apps/server/src/modules/rendering/structured.test.ts`, `apps/server/test/integration/delivery/visual-template-projects.test.ts` | TD-01, nombres sintéticos |
| `apps/server/test/integration/**` (nuevos) | `extreme-carousels`, `extreme-sports-data`, `final-slides-without-image-ai`, `extreme-editorial-copy`, `editorial-copy-exports`, `recovery`, `import-recovery`, `source-conflicts` y sus ayudantes |
| `apps/web/src/app/pages.tsx`, `App.test.tsx` | ERR-01 |
| `apps/web/src/ui/primitives/Tabs.tsx`, `apps/web/src/app/AppShell.tsx`, `apps/web/src/features/visual-templates/editor/LayerList.tsx` | FC-01 |
| `apps/web/src/features/**/*.module.css` (cuatro) | Limpieza de CSS sin uso (8) |
| `apps/web/src/**` (pruebas nuevas) | `ImportPreviewPage.conflicts`, `DisputeRecord`, `RunProgress.failures`, `ReviewDownload.recovery` |
| `e2e/tests/a11y.spec.ts`, `e2e/tests/responsive.spec.ts` | Página de error de sección; copy y editor con teclado; colores forzados |
| Documentación | Este informe; alcance de UI-06; índice de WI-2; registro de decisiones; evidencia en `evidence/UI-06/ui-06-3/` |

## 19. Estado de Git

Rama `work/WI-2-UI-06`. El cierre de UI-06.3 está en `4ef6c06` (`4ef6c0615a109e016928c180f0070aa8217205c7`), sobre `3c11a9a`; los commits de
UI-06.1 y UI-06.2 no cambian. Sin merge, push ni deploy. Ni TEAM-DISPLAY-01 ni CLOUD-ARCH-01 han empezado.

## 20. L-01 — Nombres de presentación de equipos (decisión del Product Owner del 2026-11-13)

### 20.1 Decisión

El Product Owner cambió el criterio de L-01: no resolver los nombres largos solo reduciendo la tipografía, sino
**permitir configurar a mano un nombre de presentación por equipo** (por ejemplo, «Espanyol» para «Reial Club
Deportiu Espanyol de Barcelona»), usado con preferencia en las plantillas visuales y del motor, con el nombre oficial y
la identidad interna conservados, los escudos por `teamId`, el nombre manual protegido frente a las sincronizaciones,
el nombre usado guardado en el snapshot del proyecto, el nombre actual como alternativa, sin IA para inventar
abreviaturas y sin cambios retroactivos. Condición: una solución de bajo impacto. Si necesita una migración, cambios
sustanciales del contrato o varios subsistemas, no se implementa todavía: se documenta el impacto y se propone
separarla de UI-06.3.

### 20.2 Inspección: no existe una capacidad equivalente

- Un equipo local (`ManagedTeam`) tiene `id`, `name` (regla `TeamName`), `region` y su escudo. No hay nombre corto,
  de presentación ni alias, ni en el contrato ni en la base de datos.
- football-data entrega `shortName` y `tla`, pero el adaptador solo los usa como alias para emparejar equipos al
  importar (`providers/sports/adapters/football-data/mapping.ts`); no se guardan ni se muestran.
- Hoy el nombre del equipo es un dato verificado en todo el recorrido:
  - BR-05 y PD-06: los nombres se usan como texto y se conservan como el nombre oficial verificado;
  - los hechos `team_official_name` del snapshot y de la verificación;
  - las comprobaciones de contenido (`content/checks.ts`) marcan como `NON_OFFICIAL_TEAM_NAME` cualquier forma
    distinta del nombre oficial, en las diapositivas y en el copy;
  - el control visual `team_names` (bloqueante) exige que cada elemento de nombre dibujado sea exactamente el oficial;
  - las plantillas del motor y los vínculos de las plantillas visuales (`match.homeTeam.name`) dibujan ese nombre;
  - los escudos ya se asocian por `teamId` en un snapshot por proyecto (PD-32), sin comparar nombres.

### 20.3 Cambio mínimo necesario

1. **Datos:** una columna opcional `display_name` en `managed_teams` (migración nueva, la 0037), con las mismas reglas
   de caracteres que `TeamName` y un máximo más corto a decidir; solo la escribe el operador; su procedencia es
   `manual_override` protegida y las importaciones nunca la escriben.
2. **Contrato (aditivo):** `displayName` opcional en el alta, la edición y la respuesta de `ManagedTeam`; nuevo hash
   registrado.
3. **Snapshot del proyecto:** el nombre de presentación usado, por `teamId`, junto al snapshot de escudos (una versión
   nueva), para reproducir las imágenes; los proyectos anteriores no cambian.
4. **Renderización:** los elementos de nombre de equipo de las plantillas del motor y de las visuales usan el nombre
   de presentación del snapshot, con el nombre oficial como alternativa.
5. **Comprobaciones:** el control visual `team_names` y las comprobaciones de contenido aceptan el nombre de
   presentación registrado para ese `teamId`, y solo ese; cualquier otra forma sigue bloqueada.
6. **Copy editorial:** decidir si usa el nombre oficial (recomendado; el de presentación solo en las imágenes) o
   también el de presentación con la misma regla.
7. **Web:** un campo «Nombre para mostrar (opcional)» en el diálogo «Editar equipo» de Competiciones → Equipos.
8. **Decisión:** una nueva que enmiende BR-05 y PD-06 (el nombre oficial sigue como dato; se puede dibujar el de
   presentación).
9. **Pruebas:** persistencia, protección frente a importaciones, renderización, comprobaciones, snapshot (proyectos
   anteriores sin cambios) y compatibilidad.

### 20.4 Impacto y propuesta

Una migración, un cambio aditivo del contrato con hash nuevo, la enmienda de una regla de negocio y cambios en siete
subsistemas (competiciones, contrato, snapshot del proyecto, renderización, control visual, comprobaciones de contenido
y copy, y web). No es de bajo impacto: **se propone como un refinamiento separado, después del cierre de UI-06.3**, con
su propia autorización. No se implementó nada de esto en UI-06.3. El Product Owner aprobó la separación el
2026-11-13 como **TEAM-DISPLAY-01** (21.4).

Mientras tanto, L-01 sigue como limitación conocida. No se recomienda acortar el nombre del equipo en Competiciones
como alternativa, porque cambiaría el nombre oficial local que la decisión quiere conservar.

## 21. Resolución final de pendientes (instrucción del Product Owner del 2026-11-13)

Instrucción «WI-2 / UI-06.3 — Resolución final de pendientes»: resolver D06 sin ampliar el contrato ni crear reglas
deportivas (o documentar y pedir autorización si hace falta un motivo nuevo), corregir el ZWJ y el encabezado del TXT,
mantener L-01 como limitación y registrar TEAM-DISPLAY-01, sin commit.

### 21.1 UI06.3-D06 — Marcador de 100 o más (abierto; requiere un cambio de contrato)

- **Causa exacta:** el resultado local se registra con `CompetitionMatchResultUpdateSchema`, que admite cualquier
  entero ≥ 0. Al confirmar, `ContentBatchService` congela la selección con una importación de formulario
  (`createImport`, canal `form`) cuyo documento solo admite marcadores de 0 a 99 (`packages/contracts/src/http/
  imports.ts`, `score.home|away max(99)`): la importación falla y el lote entero responde 409
  `CONTENT_BATCH_NOT_GENERATABLE`, que la web traduce como «Ninguna pieza de la selección se puede generar con los
  datos locales», aunque la vista previa la había dado por lista. La vista previa no lo detecta porque
  `localResultIneligibility` (`providers/sports/ingestion/local-selection.ts`) no comprueba ese rango, aunque su
  documentación dice que la vista previa y el congelado aplican las mismas reglas.
- **¿Permite el contrato actual excluir el registro sin rechazar el lote?** No. Los motivos de exclusión
  (`ContentMatchIneligibility`: `not_finished`, `score_missing`, `kickoff_missing`, `team_name_not_supported`; y
  `ContentPieceSkipReason`) son listas cerradas, y la vista previa no tiene un aviso a nivel de lote. Reutilizar
  `score_missing` («El marcador es desconocido») diría algo falso, y excluir el partido sin motivo lo ocultaría. Limitar
  la entrada a 0–99 sería una regla nueva en el registro de resultados.
- **Cambio propuesto (sin implementar; pide autorización):**
  1. Contrato (aditivo): un motivo nuevo `score_not_supported` en `ContentMatchIneligibility` y
     `ContentPieceSkipReason` (Zod y OpenAPI), con el hash nuevo y su evaluación de compatibilidad.
  2. Servidor: `localResultIneligibility` devuelve `score_not_supported` cuando un marcador queda fuera de 0–99, el
     límite que ya aplica el snapshot congelado (no es una regla deportiva nueva: es la misma restricción de la
     confirmación, reconocida antes). El partido queda marcado como incompatible y su pieza se omite con ese motivo;
     las demás piezas válidas del lote se generan.
  3. Web: el texto del motivo, por ejemplo «El marcador supera el máximo que admite el registro de la selección (0 a
     99).»
  4. Trazabilidad: el dato local no cambia y sigue visible en Competiciones; nada se corrige en silencio.
  5. Pruebas: la de fallo esperado (`extreme-sports-data.test.ts`, `DEFECT UI06.3-D06`) pasa a ser una regresión
     normal; vista previa, confirmación parcial y texto de la web.
- **Estado:** abierto, no bloqueante, hasta su autorización. Autorizado y corregido después: sección 22.

### 21.2 UI06.3-D07 — Emoji compuesto (ZWJ) en la edición del copy (corregido)

- **Causa:** el texto de una edición (`EditorialEditCreate.fields[].text`) usaba el patrón `Note`,
  `^(?:[^\p{Cc}\p{Cf}]|\n)+$`, que rechaza todo carácter de formato. U+200D lo es, así que un texto válido del
  redactor con 👨‍👩‍👧‍👦 o ❤️‍🔥 se aprobaba y exportaba, pero no se podía volver a guardar: 400 en `/fields/n/text`.
  La comprobación del contenido ya tenía la regla precisa (T10-A1-05: U+200D solo dentro de una secuencia de emoji).
- **Solución (cambio de contrato autorizado por el Product Owner el 2026-11-13):** un patrón nuevo `EditorialText`,
  `^(?:[^\p{Cc}\p{Cf}]|\n|\u200D)+$`, solo para el texto editado, en `ContractPatterns`, `EditorialEditFieldSchema`
  y el documento OpenAPI. Un U+200D fuera de un emoji llega a la comprobación del contenido, que lo marca
  `FORBIDDEN_CONTENT` y la versión no se puede aprobar. Siguen prohibidos los demás caracteres de control y formato
  (marcas y aislamientos de dirección, U+200B, BOM, guion suave, etiquetas, CR, tabulador). `Note` no cambia en sus
  otros usos. Compatible hacia atrás: toda petición válida antes lo sigue siendo, y ninguna respuesta cambia. Hash
  registrado: `c5acca7e…188f` (fuente de verdad, sección 6).
- **Pruebas:** en `extreme-editorial-copy.test.ts`, el texto generado con emojis compuestos se abre, se guarda de
  nuevo sin cambios (versión `edited`, sin marcas, mismo texto), se guarda con cambios, se aprueba y se exporta con las
  secuencias intactas byte a byte, y la exportación anterior conserva su copy. Un U+200D fuera de un emoji se marca
  `FORBIDDEN_CONTENT` y no se puede aprobar. Las 10 formas prohibidas siguen respondiendo 400. Mutación: con el
  patrón anterior fallan las dos pruebas; con el nuevo pasan. En la web, guardar sin cambios no envía nada (ya era
  así) y la edición envía el texto tal cual.

### 21.3 UI06.3-D08 — Encabezado de `copy-editorial.txt` (corregido)

- **Causa:** `editorialCopyText` (`modules/export/manifest.ts`) escribía `competición · fase · temporada` con la fase
  del proyecto (`stageLabel`) y no usaba su jornada (`matchday`), así que «Jornada 2» de «Temporada Regular»
  aparecía como «Liga Demo · Temporada Regular · 2026/27».
- **Solución:** el encabezado usa `stageDisplay`, la misma función que el título del proyecto. Con jornada:
  «Liga Demo · Temporada Regular · Jornada 2 · 2026/27». Sin jornada, por ejemplo una fase eliminatoria o una
  selección local cuya etiqueta ya es el nombre de la jornada: la etiqueta sola («Copa Demo · Octavos de final ·
  2026/27», «Liga Sintética · Jornada 1 · 2026/27»). En español, como el resto del archivo, también en los proyectos
  en inglés. No se inventa nada: solo se usan la fase y la jornada guardadas del proyecto.
- **Compatibilidad:** solo cambian las exportaciones nuevas; las anteriores se vuelven a descargar idénticas (las
  pruebas de historial y de exportaciones sucesivas lo comprueban). No forma parte del contrato.
- **Pruebas:** `manifest.test.ts` (jornada, fase sin jornada, selección local y proyecto en inglés) y las pruebas de
  integración del copy con el encabezado esperado construido aparte.

### 21.4 TEAM-DISPLAY-01 (registrado; no se implementa)

El Product Owner aprobó separar los nombres de presentación de equipos como iniciativa independiente posterior a
UI-06.3, con el nombre provisional **TEAM-DISPLAY-01**. No se implementa ni se modifican BR-05, PD-06, los contratos
deportivos, el esquema de equipos, los snapshots ni las reglas de validación de nombres. Análisis e implicaciones: sección
20.

Política provisional propuesta, que no autoriza todavía su implementación ni cambia reglas históricas:

- nombre oficial para la identificación y el copy editorial;
- nombre de presentación opcional para el contenido visual;
- asociación por `teamId`;
- snapshots históricos protegidos;
- configuración manual del operador.

L-01 queda como limitación documentada: no se resuelve reduciendo la tipografía sin límite ni cambiando nombres
oficiales.

### 21.5 Decisiones que requieren un cambio de contrato

| Tema | Cambio | Estado |
| --- | --- | --- |
| UI06.3-D07 (ZWJ) | Patrón `EditorialText` en `EditorialEditField.text` | Autorizado e implementado |
| UI06.3-D06 (marcador ≥ 100) | Motivo `score_not_supported` en `ContentMatchIneligibility` y `ContentPieceSkipReason`, con la migración 0037 | Autorizado e implementado (22) |
| TEAM-DISPLAY-01 | `displayName` en los equipos, migración y snapshot | Iniciativa posterior, sin implementar |

## 22. UI06.3-D06 autorizado y cierre de UI-06.3 (instrucción del Product Owner del 2026-11-13)

Instrucción «WI-2 / UI-06.3 — Autorización D06 y cierre final»: el Product Owner acepta las correcciones de D07 y D08,
autoriza el cambio aditivo `score_not_supported` y los ajustes necesarios para integrarlo, sin otras reglas deportivas,
y pide cerrar UI-06.3 si no hay regresiones.

### 22.1 Corrección

- **Vista previa:** `localResultIneligibility` (`providers/sports/ingestion/local-selection.ts`) devuelve
  `score_not_supported` cuando un marcador supera `IMPORT_SCORE_MAX` (99), el límite que ya aplica la importación de
  formulario con la que se congela la selección (`packages/contracts/src/http/imports.ts`, que ahora usa la misma
  constante). No es una regla deportiva nueva ni una ampliación del rango: es la restricción de la confirmación,
  reconocida antes. El marcador no se califica de falso ni de inválido: este recorrido no puede registrarlo.
- **Lote:** el partido queda marcado como incompatible; su pieza individual se omite con `score_not_supported`, la
  pieza de jornada lo excluye y sigue con los compatibles, y si ninguno es compatible el lote se rechaza como antes
  (`CONTENT_BATCH_NOT_GENERATABLE`, nada guardado). Las reglas de selección parcial y de atomicidad no cambian: las
  piezas omitidas quedan registradas con su motivo y sus partidos, sin proyecto.
- **Web:** «Este recorrido no admite marcadores de más de 99 goles por equipo; el resultado se conserva sin cambios en
  Competiciones.» en la vista previa y en el resultado del lote.
- **Datos:** el resultado local no cambia; nada se oculta ni se corrige en silencio.

### 22.2 Contrato

`score_not_supported` se añade a `ContentMatchIneligibility` y a `ContentPieceSkipReason` (Zod y OpenAPI). Es un valor
nuevo en respuestas: ninguna petición, operación, campo, patrón ni valor anterior cambia, así que los consumidores
anteriores siguen funcionando; quien traduzca los motivos debe añadir el nuevo (la web lo hace). Las pruebas de contrato
(paridad Zod, conformidad, diferencias registradas) pasan. Hash registrado con el procedimiento de UI-06.1:
`8cadafd1…7a5a` en `.orchestrate/config.json`, con su nota en la sección 6 de la fuente de verdad.

### 22.3 Migración 0037

La tabla de piezas de un lote (`content_generation_items`) tiene una restricción `CHECK` con la lista de motivos de
omisión, que rechazaba el nuevo (la primera ejecución de la prueba de regresión respondió 500 por ella). La migración
`0037_content_skip_reason_score_not_supported.sql` reconstruye esa tabla y la de sus partidos con la definición de
0023 más el motivo nuevo, conservando cada fila, identificador y orden; las migraciones anteriores no se tocan.

- Prueba de migración nueva (`migrations.int.test.ts`): la versión 36 rechaza el motivo; tras la 0037 las filas son
  idénticas, el motivo se acepta, un motivo desconocido sigue rechazado, no quedan tablas temporales, el índice existe
  y `foreign_key_check` e `integrity_check` están limpios.
- Comprobación sobre una copia de la base local del operador (`data/edr.sqlite` con su WAL, copiada al scratchpad; la
  base real no se tocó): en la versión 36, 9 piezas y 48 partidos de lotes; tras aplicar la 0037 en una transacción,
  filas idénticas, sin violaciones de claves foráneas, integridad correcta, y la definición solo cambia en el motivo
  nuevo.
- El servidor de desarrollo del operador aplica las migraciones al arrancar: al recompilar, aplicará la 0037 a la base
  local con ese mismo resultado.

### 22.4 Compatibilidad

- Cambio aditivo y consumidores anteriores: 22.2.
- Proyectos históricos y snapshots aprobados: el lote solo cambia lo que se congela al confirmar; los proyectos ya
  generados no se tocan. La prueba lo comprueba: el borrador de un proyecto generado antes no cambia tras corregir el
  resultado local y generar otro lote.
- Manifiestos anteriores: las exportaciones no cambian (las pruebas de historial y de exportaciones sucesivas pasan).
- Partidos excluidos: no aparecen en ningún contenido generado ni en la selección congelada; la pieza de jornada solo
  muestra los compatibles.
- Conteos: vista previa (`requested`, `ready`, `skipped`) y lote (`requested`, `skipped` y piezas completadas)
  coinciden.

### 22.5 Pruebas

`extreme-sports-data.test.ts`: la prueba de fallo esperado pasa a ser una regresión normal. Cubre:

- marcadores de 99, 100 y 250, compatibles e incompatibles en el mismo lote;
- todos incompatibles: lote rechazado sin guardar nada;
- datos locales conservados y motivos de exclusión (`score_not_supported`, nunca `score_missing`);
- conteos de la vista previa y de la confirmación;
- recuperación: al registrar un marcador admitido el partido vuelve a ser compatible y se genera;
- integridad del proyecto generado antes.

Además: la caracterización de dos dígitos, la prueba de la migración y la del texto en la web
(`GenerateContentPage.test.tsx`).

### 22.6 Cierre

UI-06.3 se cierra como incremento técnico con la aceptación del Product Owner de los cambios autorizados (D06, D07 y
D08), en el commit `4ef6c0615a109e016928c180f0070aa8217205c7` de la rama `work/WI-2-UI-06`, sobre `3c11a9a` y con solo los cambios de
este incremento. El hash se registra también en la fuente de verdad (fila UI-06) y en el registro de decisiones
(sección 7). WCAG 2.2 AA no se declara,
porque faltan las comprobaciones manuales, y la v1.0 no ha pasado una validación manual: está técnicamente lista,
pendiente de esa validación. TEAM-DISPLAY-01 sigue pendiente y separado de UI-06.3; CLOUD-ARCH-01 no ha empezado.

