# UI-06.1 — Recuperación de E2E y accesibilidad automatizada

**Estado:** aceptado por el Product Owner y cerrado el 2026-11-13: recuperación de las suites y corrección del
defecto E2E-F01. Los hallazgos de accesibilidad y responsive siguen abiertos para UI-06.2 (sección 4.4). UI-06 no está
terminado.
**Rama:** `work/WI-2-UI-06`, creada desde `9f5963fa0517ac4220acf4577fe92f3188c6217f` (cierre de REVIEW-APPROVAL-01).
**Alcance y criterios:** [`ui-06-scope-and-increments.md`](ui-06-scope-and-increments.md), sección UI-06.1.
**Evidencia:** [`evidence/UI-06/`](evidence/UI-06/).
**Cierre y commit:** sección 10.

## 1. Resumen

| Suite | Antes | Después |
| --- | --- | --- |
| `npm run test:e2e` | 17 pruebas: 5 correctas, 12 fallidas | 22 pruebas: 22 correctas, incluida la regresión de E2E-F01 |
| `npm run test:a11y` | 33 pruebas: 12 correctas, 5 fallidas, 16 sin ejecutar | 28 pruebas: 28 correctas (dos hallazgos conocidos declarados) |

Las suites vuelven a cubrir el producto aprobado: crear contenido desde una competición local, revisar y aprobar
diapositivas, generar y aprobar el copy editorial con el escritor `stub`, dar la aprobación final, descargar el ZIP y
comprobar dentro de él `copy-editorial.txt` y el manifiesto. Las ejecuciones no hacen llamadas a proveedores ni a
OpenAI, usan datos sintéticos en directorios temporales y no dejan cambios en el árbol de trabajo.

La recuperación encontró un defecto real del producto (E2E-F01, sección 4.1), una contradicción de texto con PD-33
(sección 4.2) y cuatro hallazgos de accesibilidad o responsive (sección 4.3). El Product Owner aprobó el 2026-11-13
corregir los dos primeros dentro de UI-06.1, y lo están: cada descarga lleva solo el copy aprobado y publicable en ese
momento, sin repetir la aprobación final ni tocar los ZIP anteriores. Los cuatro hallazgos de accesibilidad o
responsive quedan asignados a UI-06.2 y siguen declarados en la suite.

Cambios en la aplicación (sección 5.3): solo en la web, en la descarga del carrusel y en dos textos. Sin cambios en el
contrato, el servidor, la base de datos ni las migraciones. Además, formato de Prettier en tres archivos del servidor.

## 2. Preparación

- `git status`: limpio en `work/REVIEW-APPROVAL-01` en `9f5963f`, el commit de cierre confirmado. La rama
  `work/WI-2-UI-06` sale de ese commit; el historial anterior no cambia.
- Alcance documentado de UI-06: sección UI-06 de `incremental-ux-ui-implementation-plan.md` (validación desktop,
  tablet y móvil; WCAG 2.2 AA; casos límite; regresión unitaria, de integración, contrato, E2E y axe) y la auditoría
  de CSS Modules de `tailwind-v4-migration-strategy.md` (M5).
- `source-of-truth.md`: los gates `PRJ-E2E`, `PRJ-A11Y` y `PRJ-CONTRACT-ID` están configurados y son obligatorios;
  DEP-4 (hash del contrato) y la suite E2E figuran como pendientes en los cierres de PD-ARCH-01G-E y
  REVIEW-APPROVAL-01. PD-UI-21 (el PO es dueño de las pruebas E2E) queda en suspenso solo para UI-06 por la
  instrucción explícita del PO.
- Decisiones pendientes encontradas: las de la sección 10.

## 3. Diagnóstico de las suites

Línea base ejecutada en `9f5963f` sin cambios (`evidence/UI-06/ui-06-1-e2e-baseline.txt` y
`ui-06-1-a11y-baseline.txt`).

### 3.1 Causa común: el arnés no tenía la fuente de competiciones locales

Desde PD-ARCH-01F el producto crea contenido solo desde competiciones locales (`/projects/generate`); el formulario
de catálogo `/projects/new` se retiró y redirige al asistente. El arnés generaba su configuración desde
`fixtures/config/demo-manual.config.json` (T23), anterior a PD-ARCH-01E, que no declara la fuente
`local-competitions`. Ninguna prueba podía crear contenido como lo hace hoy el operador.

### 3.2 Causa de cada fallo

| Prueba (línea base) | Causa |
| --- | --- |
| `smoke` — abre en la lista de proyectos | El menú ya no tiene 6 enlaces con Plantillas y Mi marca: son 6 enlaces (con Competiciones y Exportaciones) y dos grupos desplegables. |
| `shell-responsive` — enlaces a secciones de marca | Las anclas `/brand#brand-templates-title` y `/brand#brand-assets-title` se retiraron; Mi marca y Plantillas son grupos con subpáginas. |
| `dashboard` — acción principal | Espera `/projects/new`; la acción lleva a `/projects/generate` (PD-ARCH-01F). |
| `dashboard` — estado con proyectos (3 anchos) | Espera 4 tarjetas; la biblioteca abre en vista de tabla (UI-05B) y las acciones son «Ver contenido» y «Eliminar». |
| `creation-visual` (2) | Esperan el grupo de radios «Competición» del catálogo (UI-03), retirado. |
| `catalogue` (3) | Flujo de catálogo retirado por PD-ARCH-01F. |
| `delivery` | Crea el proyecto con el formulario retirado; además la revisión, la exportación y el historial cambiaron (UX-REVIEW-01, UI-05B, REVIEW-APPROVAL-01). |
| `failure-restart` | Igual: creación por el formulario retirado y selectores de la revisión anterior. |
| `manual-import` | La importación pasaba; falla al crear el proyecto con el formulario retirado. |
| `brand` | La página «Marca y plantillas» se dividió en Mi marca (Recursos, Identidad visual) y Plantillas; PD-28 permite escudos subidos manualmente en Competiciones. |
| `a11y` (17 + 1) | La preparación (`beforeAll`) y el proyecto con ejecución fallida usan el formulario retirado; todas las páginas quedaban sin escanear. |

Además, `dashboard` y `creation-visual` escribían sus capturas sobre la evidencia aceptada de UI-02 y UI-03 en
`docs/design/WI-2/evidence/`: la ejecución de la línea base modificó cinco PNG versionados, que se restauraron con
`git restore` (eran archivos del repositorio, no datos del usuario).

## 4. Hallazgos

### 4.1 E2E-F01 — La descarga reutilizaba un ZIP con el copy de antes (corregido)

**Estado:** corregido el 2026-11-13 con la aprobación del Product Owner. Prueba de regresión normal, sin marca de
fallo esperado.

#### 4.1.1 Hallazgo y decisión

- **Regla vigente** (PD-33, opción A de REVIEW-APPROVAL-01, confirmada por el Product Owner el 2026-11-13): la
  aprobación gráfica del carrusel y la aprobación editorial son independientes. Un copy puede aprobarse o retirarse
  después de la aprobación gráfica, y cada exportación nueva refleja solo las versiones editoriales aprobadas y
  publicables en ese momento. El diálogo de la aprobación final lo dice: «Puedes aprobarlos después y volver a
  descargar; los cambios en el copy no anulan la aprobación del carrusel».
- **Comportamiento observado:** «Descargar carrusel» volvía a descargar la exportación ya escrita para la aprobación
  final vigente. Un texto aprobado después no llegaba al ZIP; uno editado o retirado después seguía en él, hasta que
  cambiara la aprobación final.
- **Decisión del Product Owner (2026-11-13):** corregirlo antes del cierre de UI-06.1. La autoridad sobre el
  contenido es el servidor; se reutiliza la arquitectura existente sin un segundo sistema de exportaciones; no se
  modifican ZIP ni manifiestos anteriores; no se invalida la aprobación gráfica por cambios solo editoriales ni se
  obliga a repetirla. Una exportación anterior puede reutilizarse solo si el servidor confirma que coincide con el
  estado exportable actual.

#### 4.1.2 Diagnóstico definitivo

| Elemento | Situación antes de la corrección |
| --- | --- |
| Endpoints | `POST /api/v1/carousels/{carouselId}/exports` (`exportCarousel`): responde 201 «Export written» y escribe siempre una exportación nueva. `GET /api/v1/exports/{exportId}/download`: arma el ZIP con los archivos ya escritos de una exportación, comprobando cada hash. |
| Servicio | `ExportService.exportCarousel` (`apps/server/src/modules/export/service.ts`). Planifica en una transacción desde la aprobación final válida y el copy exportable (`#approvedEditorial`, con la regla única `editorialExportable`). Escribe en una carpeta nueva y registra la exportación en `BEGIN IMMEDIATE` tras volver a comprobar la aprobación final y los IDs del copy (`VERSION_CONFLICT` si cambiaron). |
| Referencia al ZIP anterior | `exports.final_approval_id`. Las versiones editoriales de una exportación solo constan en su `manifest.json` (sección `editorial`); `export_files` registra `copy-editorial.txt` sin versión de elemento. |
| Criterio de reutilización | Solo en la web: `currentExport` (`apps/web/src/features/history/CarouselDownload.tsx`, regla de PD-ARCH-01F) elegía la exportación más reciente del carrusel con el mismo `finalApprovalId` y la descargaba sin llamar a `exportCarousel`. |
| Manifiesto | Lista cada versión editorial exportada con su ID, número de versión, `textSha256` y hechos. Su SHA-256 se guarda en `exports.manifest_sha256`. |
| Versiones editoriales y estado exportable | Aprobar, editar (una versión nueva sin aprobar) o retirar un copy no cambia la aprobación final (PD-33 opción A), así que el criterio de la web no veía el cambio. |
| Concurrencia | El servidor ya protegía la escritura: planificación en una transacción, nueva comprobación al registrar, una carpeta nueva por exportación y nada se borra ni se sobrescribe. La web impide el doble clic mientras prepara la descarga. |

**Causa raíz:** la regla de reutilización de PD-ARCH-01F identificaba una exportación solo por su aprobación final.
Desde REVIEW-APPROVAL-01 el contenido de una exportación depende también del copy editorial, que cambia sin tocar la
aprobación final, así que la web reutilizaba exportaciones cuyo contenido ya no era el estado exportable actual. El
servidor no tenía defecto: cada exportación nueva ya salía del estado actual.

#### 4.1.3 Alternativas evaluadas

| Alternativa | Evaluación |
| --- | --- |
| Comparar en la web el SHA-256 de `copy-editorial.txt` con el texto de los entregables exportables (propuesta inicial de este informe) | Descartada: el Product Owner pidió que la decisión no dependa de comparar textos en el frontend. |
| Reutilizar dentro de `exportCarousel` cuando el contenido coincida | Descartada: cambia la operación (201 «Export written») y el comportamiento verificado y cerrado por REVIEW-APPROVAL-01 (dos exportaciones seguidas, dos registros con el mismo copy). Exige cambiar el contrato. |
| Que el servidor confirme la identidad con una operación o un campo nuevo (por ejemplo, una respuesta 200 «reutilizada» o un campo en `Export`) | Posible, pero es un cambio aditivo del contrato, con evaluación CS-1 a CS-5, hash nuevo y la decisión del Product Owner. Queda como opción (sección 10). |
| **Elegida:** cada descarga pide al servidor que escriba la exportación desde el estado actual y descarga esa | Usa la operación y el pipeline aprobados sin cambios. El servidor es la única autoridad sobre el contenido. Sin cambios en el contrato, el servidor ni la base de datos, y sin un segundo sistema de exportaciones. |

#### 4.1.4 Solución implementada

- **Descarga** (`apps/web/src/features/history/CarouselDownload.tsx`): «Descargar carrusel» llama siempre a
  `exportCarousel` y descarga la exportación que el servidor acaba de escribir. Ya no carga el historial ni decide
  por su cuenta que una exportación anterior sigue valiendo.
- **Servidor, sin cambios:**
  - el contenido sale de la versión de la aprobación final válida y del copy exportable al planificar;
  - se vuelve a comprobar al registrar: si el copy cambió entretanto, responde `VERSION_CONFLICT` y no registra nada;
  - cada exportación tiene su propia carpeta y su propio manifiesto.
- **`currentExport`:** ya no interviene en la descarga. Solo marca en el historial del proyecto la exportación más
  reciente de la aprobación final válida («Vigente»).
- **Mensajes de error:**
  - `FINAL_APPROVAL_REQUIRED`: sin cambios.
  - `VERSION_CONFLICT`: en esta operación solo ocurre si el copy aprobado cambia mientras se escribe la exportación.
    Antes pedía volver a aprobar un carrusel que seguía aprobado; ahora dice «El copy editorial cambió mientras se
    preparaba la descarga. Vuelve a descargar el carrusel.».
- **Limpieza:** se quitó de `CarouselDownload` y `ReviewDownloads` la propiedad `projectId`, que dejó de usarse.
- **Sin cambios:** contrato, rutas y servicio del servidor, base de datos, migraciones, aprobación final, ZIP y
  manifiestos ya escritos.

| Escenario del Product Owner | Resultado |
| --- | --- |
| A. Aprobar el carrusel, descargar sin copy aprobado, aprobar Facebook / Instagram y volver a descargar | El ZIP nuevo trae `copy-editorial.txt` con el texto aprobado. En la prueba: ZIP con Facebook / Instagram, aprobación de TikTok / Reels y nuevo ZIP con las dos secciones. |
| B. Aprobar Facebook / Instagram, descargar, retirar la aprobación y volver a descargar | El ZIP nuevo no trae `copy-editorial.txt` ni la sección `editorial` del manifiesto. El ZIP anterior sigue igual. |
| C. Aprobar dos entregables, editar uno y volver a descargar | Solo va el texto cuya versión actual sigue aprobada. No va ni el texto aprobado antes ni el editado. |
| D. Descargar dos veces sin cambios | El servidor escribe otra exportación desde el mismo estado. PNG y `copy-editorial.txt` iguales byte a byte, con las mismas versiones editoriales; solo cambia el manifiesto (su `exportId` y su hora). No hay reutilización: el servidor no puede confirmarla sin cambiar el contrato (4.1.3). |

En los cuatro casos la aprobación final no cambia ni se repite.

#### 4.1.5 Historial de exportaciones

- **Una exportación por descarga:** cada «Descargar carrusel» desde la revisión o desde el proyecto escribe una
  exportación. Aparece en el historial del proyecto y en Exportaciones, la más reciente primero.
- **Estados del historial:** «Vigente» es la exportación más reciente de la aprobación final válida; las demás figuran
  como «Sustituida». El estado se refiere a la aprobación gráfica: no afirma que el copy de esa exportación siga
  aprobado, porque cada exportación conserva el estado en que se escribió.
- **Exportaciones anteriores:** no se modifican. Sus archivos, hashes y manifiesto siguen iguales, y el botón
  «Descargar» del historial las entrega exactamente como se escribieron.
- **Coste:** cada descarga crea una carpeta con su copia de las imágenes en el directorio de datos local.

#### 4.1.6 Evidencia del ZIP anterior y nuevo

[`evidence/UI-06/ui-06-1-e2e-f01-zips.json`](evidence/UI-06/ui-06-1-e2e-f01-zips.json), escrito por la prueba en la
ejecución final de la suite. Por cada descarga:

- secciones de `copy-editorial.txt` y versiones editoriales del manifiesto;
- si la aprobación final es la de la primera descarga;
- cada archivo con el inicio de su SHA-256.

Resumen:

| Descarga | Secciones del copy | Imágenes | Aprobación final |
| --- | --- | --- | --- |
| A0, primera | Facebook / Instagram (v1) | Las mismas 4 PNG en todas las descargas | La misma en todas |
| A, tras aprobar TikTok / Reels | Facebook / Instagram (v1), TikTok / Reels (v1) | Iguales | Igual |
| D, repetida sin cambios | Igual que A, mismo `copy-editorial.txt` | Iguales | Igual |
| C, tras editar TikTok / Reels | Facebook / Instagram (v1); el mismo `copy-editorial.txt` que A0 | Iguales | Igual |
| B, tras retirar Facebook / Instagram | Sin `copy-editorial.txt` | Iguales | Igual |

Después de las cinco descargas, cada ZIP se vuelve a pedir al servidor por su exportación y coincide archivo por
archivo con el descargado: el historial conserva los paquetes anteriores intactos.

#### 4.1.7 Pruebas de regresión

- **E2E** (`e2e/tests/content-journey.spec.ts`, prueba «every download carries the copy approved now, without a new
  final approval or touching earlier ZIPs (E2E-F01)»). Sigue al recorrido principal y recorre A, D, C y B en el
  navegador, con los ayudantes nuevos `editEditorialField` y `withdrawEditorialApproval`. Por cada ZIP comprueba:
  - las secciones de `copy-editorial.txt` y que no aparezcan el texto aprobado antes ni el editado;
  - el manifiesto: hashes, versiones editoriales y aprobación final;
  - que las imágenes sean idénticas a las de la primera descarga;
  - que el aviso «La aprobación final es válida» siga visible.

  Al final verifica el historial completo: el orden de la lista por la API, cada ZIP anterior descargado de nuevo e
  idéntico, un «Vigente» y cuatro «Sustituida» en el proyecto, y cinco tarjetas en Exportaciones.
- **Detecta la regresión:** con una mutación temporal que volvía a reutilizar la exportación, la prueba falla en el
  escenario C, donde el ZIP reutilizado traía todavía «TikTok / Reels»
  ([`ui-06-1-e2e-f01-mutation.txt`](evidence/UI-06/ui-06-1-e2e-f01-mutation.txt)). Se restauró el código y se volvió
  a compilar.
- **Web** (`ReviewDownload.test.tsx`, `ProjectDetailPage.test.tsx`):
  - aunque exista una exportación de la misma aprobación, la descarga escribe una nueva y descarga esa;
  - una segunda descarga vuelve a pedirla al servidor;
  - `VERSION_CONFLICT` muestra el mensaje del copy y no el de la aprobación final.
- **Servidor, sin cambios:** `export-editorial-copy.test.ts` y `export.int.test.ts` siguen cubriendo con la API real
  copy aprobado después, editado, retirado, cambiado durante la escritura y exportaciones seguidas.

#### 4.1.8 Limitaciones

- Cada descarga repetida añade una exportación al historial y una carpeta al disco, aunque su contenido coincida con
  la anterior. Evitarlo con una reutilización confirmada por el servidor requiere un cambio aditivo del contrato
  (sección 10).
- «Vigente» se refiere a la aprobación gráfica, no a si el copy de esa exportación sigue aprobado (4.1.5).
- Si el copy cambia justo mientras se escribe la exportación, el servidor la rechaza (`VERSION_CONFLICT`) y el
  operador vuelve a descargar.

### 4.2 Texto contradictorio con PD-33 en el panel del copy

**Estado:** corregido el 2026-11-13 con la aprobación del Product Owner.

`apps/web/src/features/review/editorial/copy.ts` (`approvalScope`) mostraba «El copy editorial no forma parte de la
descarga del carrusel», texto anterior a REVIEW-APPROVAL-01 que contradice la opción A aprobada. Ahora el panel dice,
con el texto pedido por el Product Owner: «Cada texto se aprueba por separado. Los textos editoriales aprobados y
listos para publicar se incluyen en la descarga del carrusel. Puedes aprobarlos después y volver a descargar el
contenido.» Se cambió solo el texto, en el mismo párrafo y con el mismo estilo de UX-REVIEW-01; el panel no cambia.

### 4.3 Accesibilidad y responsive

**Estado:** abiertos. El Product Owner los asignó el 2026-11-13 a UI-06.2, donde se corregirán. Siguen declarados en
la suite y no se ocultan.

| ID | Pantalla | Hallazgo | Criterio | Propuesta | Incremento |
| --- | --- | --- | --- | --- | --- |
| A11Y-01 | Trazabilidad de una diapositiva exportada | Colores del tema claro (`#4a4a4a`, `#0b4f8a`) sobre la superficie oscura del estudio: contraste 2,2 a 2,3 en la introducción, los enlaces y la evidencia. `contentVariantOf` trata `/projects/:id/exports/:id/slides/:n/trace` como página del estudio. | 1.4.3 | Servir la traza en el panel claro heredado o migrar sus colores a los tokens del estudio. | UI-06.2 |
| A11Y-02 | Revisión: carril de diapositivas | El nombre accesible de cada miniatura usa el estado de la versión («Lista para aprobar») mientras el texto visible dice «Advertencia por confirmar» o «Bloqueada». El inspector muestra a la vez «Lista para aprobar» y «Bloqueada». | 2.5.3, 4.1.2 | Construir el nombre con el mismo estado visible (`elementStatus`). | UI-06.2 |
| R-02 | Inicio, biblioteca de proyectos | A 768 px, el tooltip del botón «Vista de tarjetas» sobresale 6 px del borde derecho mientras está visible y crea desplazamiento horizontal. | 1.4.10 | Alinear el tooltip al borde cuando no cabe centrado. | UI-06.2 |
| R-03 | Revisión del contenido | A 1280 × 720 (el tamaño de las suites y de muchos portátiles) la vista previa sobresale de su columna y la página supera la altura de la ventana; debajo queda el fondo blanco de `html` y el pie «1080 × 1350 px · Versión n» queda sobre blanco (contraste 1,7). A 1440 × 1000 no ocurre. | 1.4.3, 1.4.10 | Ajustar la imagen al alto disponible en modo «Ajustada» y dar al documento el fondo del estudio. | UI-06.2 |

A11Y-01 y R-03 se comprueban en la suite como hallazgos conocidos (`KNOWN` en `a11y.spec.ts`): la prueba exige
exactamente esa regla, falla con cualquier violación nueva y también cuando se corrija, momento en que hay que quitar
la declaración. R-02 se documenta aquí; la prueba mide el diseño sin el tooltip visible. A11Y-02 no lo detecta axe.

Otras observaciones, sin violación automática:

- O-1: la nota de Mi marca dice que «los nombres de equipos y competiciones aparecen como texto»; desde PD-28 y
  PD-ARCH-01G-E los escudos subidos en Competiciones sí se dibujan.
- O-2: en la tabla de equipos, los botones «Editar equipo» y «Quitar de competición» se repiten sin el nombre del
  equipo; el contexto de la fila lo da, pero un listado de controles no los distingue.

El escaneo inicial de las pantallas principales a 1440, 768 y 390 px no encontró desplazamiento horizontal fuera de
R-02.

### 4.4 Registro de defectos y hallazgos

| ID | Tipo | Descripción | Estado | Incremento |
| --- | --- | --- | --- | --- |
| E2E-F01 | Defecto funcional | La descarga reutilizaba un ZIP con el copy de antes (4.1). | Corregido | UI-06.1 |
| Texto del panel del copy | Texto contradictorio | «El copy editorial no forma parte de la descarga del carrusel» (4.2). | Corregido | UI-06.1 |
| A11Y-01 | Accesibilidad (1.4.3) | Contraste de la trazabilidad (4.3). | Abierto, declarado en la suite | UI-06.2 |
| A11Y-02 | Accesibilidad (2.5.3, 4.1.2) | Nombre accesible de las miniaturas distinto del estado visible (4.3). | Abierto | UI-06.2 |
| R-02 | Responsive (1.4.10) | Tooltip de Inicio a 768 px (4.3). | Abierto | UI-06.2 |
| R-03 | Responsive y contraste (1.4.3, 1.4.10) | Vista previa de la revisión a 1280 × 720 (4.3). | Abierto, declarado en la suite | UI-06.2 |
| O-1 | Texto | Nota de Mi marca anterior a PD-28 (4.3). | Abierto | Decisión del Product Owner |
| O-2 | Accesibilidad (observación) | Botones de la tabla de equipos sin el nombre del equipo (4.3). | Abierto | Decisión del Product Owner |
| DEP-4 | Configuración | Hash registrado del contrato desactualizado (sección 6). | Corregido | UI-06.1 |
| Prettier | Formato | Tres archivos sin formato (7.2). | Corregido | UI-06.1 |
| `npm audit` | Dependencias | Tres avisos moderados de origen (7.1, 7.3). | Clasificado. `fflate` aceptado (OD-33); parche de `@fastify/static` pendiente de autorización | UI-06.3 |
| Evidencia sobrescrita | Pruebas | `dashboard` y `creation-visual` escribían sobre la evidencia aceptada de UI-02 y UI-03 (3.2). | Corregido | UI-06.1 |
| Carrera de `manual-import` | Pruebas | Contaba el historial antes de que cargara (5.2). | Corregido | UI-06.1 |

## 5. Correcciones aplicadas

### 5.1 Arnés y soporte

- `e2e/support/harness.mjs` (+ `harness.d.mts`, `run.mjs`): la configuración generada añade la fuente
  `local-competitions` copiada tal cual de `config/app.config.json` cuando la base no la declara
  (`localSource`, `runBaseDocument`). No se modifica ningún archivo de configuración versionado.
- `e2e/support/local-data.ts` (nuevo): crea por la API, como lo hacen las páginas de Competiciones, una competición
  sintética con temporada, cuatro equipos, una jornada jugada (2-1 y 0-0) y una por jugar, con escudos PNG sintéticos
  opcionales. Cada llamada usa un sufijo único, porque los equipos locales son globales y Playwright repite la
  preparación en un worker nuevo tras un fallo.
- `e2e/support/zip.ts` (nuevo): lector del ZIP descargado (entradas almacenadas, firma y CRC comprobados).
- `e2e/support/evidence.ts` (nuevo): las capturas van a `.cache/e2e/evidence/<incremento>/`, ignorado por git.
- `e2e/support/app.ts`: helpers del flujo actual (asistente, revisión, aprobación individual y masiva, copy editorial,
  aprobación final, descarga) y, para los proyectos de catálogo que el producto conserva, `createCatalogueProject` (la
  operación de API que PD-ARCH-01F mantiene), apertura de los desplegables del proyecto y `runToEnd` robusto ante la
  página que los vuelve a cerrar. Se retiraron los helpers del formulario y de la revisión anteriores.

### 5.2 Correspondencia de pruebas

| Antes | Ahora | Comportamiento verificado |
| --- | --- | --- |
| `delivery` (catálogo) | `content-journey` (nuevo, 2) | Prioridades 1 a 9: asistente, proyecto, revisión, aprobación individual con advertencias y masiva, copy `stub`, aprobación final independiente con el diálogo «1 de 5 textos listos para exportar», ZIP con PNG 1080 × 1350 en orden, `copy-editorial.txt` solo con el texto aprobado, manifiesto con hashes y sección `editorial`, aprobación que sigue válida tras aprobar otro texto, Exportaciones. Más la regresión de E2E-F01 (4.1.7). |
| `delivery` | `delivery` (reescrita) | Proyecto de catálogo DEMO creado por la API conservada: ejecución y etapas, datos verificados por dos fuentes, exportación rechazada sin aprobación final, orden de diapositivas, aprobación masiva y final, ZIP sin copy, Exportaciones, reapertura y trazabilidad. |
| `catalogue` (3) | `creation-entry` (nuevo, 3) | `/projects/new` abre el asistente solo con competiciones locales; un plan sin partidos compatibles nombra cada pieza omitida y no se puede confirmar; un calendario de jornada por jugar no presenta partidos como jugados y aparece en Mis proyectos con su contexto. |
| `failure-restart` | `failure-restart` | Igual intención (R-203, R-206) con proyecto de catálogo por la API y la revisión actual. |
| `manual-import` | `manual-import` | Importación por la interfaz sin cambios; proyecto MANUAL_DATA por la API; datos sin verificar, bloqueo, aprobación manual y bloqueo por política (R-272). Se corrigió una carrera: contaba el historial antes de que cargara. |
| `brand` | `brand` (3) | Mi marca sin categoría de escudo; escudo de equipo en Competiciones solo con fuente y autorización (PD-28); huecos de escudo de las plantillas del motor. |
| `smoke`, `shell-responsive`, `dashboard`, `creation-visual` | Mismos archivos | Menú actual, grupos Mi marca y Plantillas con foco y página actual, biblioteca en tabla y tarjetas, asistente con evidencia y reflow, estados sin competiciones y con error. |
| `harness` | `harness` (+1) | La fuente local está en la configuración generada y ningún escritor de IA es de pago (`stub`, imágenes desactivadas). |
| `a11y` (18) | `a11y` (13) | Escaneo de Inicio, Mis proyectos, los cinco pasos del asistente, resultado de la generación, proyecto con su ejecución, datos y verificación, revisión (advertencia, aprobación masiva, copy antes y después de generar, diálogo de aprobación final, aprobación válida), Exportaciones, una exportación, trazabilidad, Competiciones (lista, competición, equipos con el formulario de escudo, temporada, jornada), Datos (archivo rechazado y aplicado, formulario con errores, importación, versión), Mi marca (recursos, diálogo de subida, identidad visual), Plantillas, página no encontrada, control positivo y ejecución fallida. |

Ninguna prueba se eliminó por fallar: las del flujo retirado se sustituyeron por su equivalente actual.

### 5.3 Cambios en la aplicación (aprobados por el Product Owner el 2026-11-13)

| Archivo | Cambio |
| --- | --- |
| `apps/web/src/features/history/CarouselDownload.tsx` | E2E-F01: cada descarga pide al servidor la exportación desde el estado actual (4.1.4); mensaje propio para `VERSION_CONFLICT`; sin la propiedad `projectId`. |
| `apps/web/src/features/review/ReviewDownloads.tsx`, `ReviewPage.tsx`, `apps/web/src/features/projects/ProjectGeneratedContent.tsx` | Dejan de pasar `projectId` a la descarga. |
| `apps/web/src/features/review/editorial/copy.ts` | Frase del panel del copy (4.2). |
| `apps/web/src/features/review/ReviewDownload.test.tsx`, `apps/web/src/features/projects/ProjectDetailPage.test.tsx` | Pruebas de la descarga actualizadas a la decisión del Product Owner y prueba nueva de `VERSION_CONFLICT`. |
| `e2e/support/app.ts`, `e2e/tests/content-journey.spec.ts` | Ayudantes para editar y retirar el copy; regresión de E2E-F01. |

Sin cambios en el servidor, el contrato, la base de datos ni las migraciones.

## 6. Contrato (DEP-4)

- **Hash registrado:** `f4538151d084f4e328804f9a9eb4bc2ab104664f7527ef2aaaef146fd28225b1`, el del contrato promovido
  por T20 (`64677b3`) y declarado por T25 (WI-1).
- **Hash vigente:** `9bf188ca5d2c2c905405e701ac3283f483cf0ba5e206a5289796ebc0d4ed22bc`.
- **Origen:** el archivo cambió de forma aditiva en 19 commits desde `d9c3191` (PD-ARCH-01 a 01H, UX-REVIEW-01,
  PD-ARCH-01G-E y REVIEW-APPROVAL-01), cada uno con su evaluación de seguridad de contrato y la aceptación del PO,
  pero el hash se dejó «para el cierre del bloque» y nunca se registró. `main` (`14dfb1f`) tampoco coincide.
- **Componentes afectados:** solo el gate `PRJ-CONTRACT-ID` y `orch contracts check`; ningún código lee el hash.
- **Evidencia del contrato aprobado:** `9f5963f` es el cierre aceptado de REVIEW-APPROVAL-01 y el archivo no cambió
  desde entonces (`git diff 9f5963f -- contracts/http-api.openapi.yaml` vacío). Las pruebas de contrato (paridad Zod,
  conformidad y diferencias registradas) pasan.
- **Corrección:** `.orchestrate/config.json` registra el hash vigente; `source-of-truth.md` sección 6 actualiza la
  línea del contrato declarado conservando el valor anterior y añade la nota del registro. No se cambió ningún
  esquema, operación ni campo.
- **E2E-F01 no cambia el contrato:** el archivo y el hash registrado siguen coincidiendo en la verificación final.

## 7. Seguridad y formato

### 7.1 `npm audit`: 13 advertencias moderadas, 3 avisos de origen

| Aviso | Paquete instalado | Por dónde llega (paquetes señalados) | Alcance real | Tipo | Corrección disponible | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| GHSA-px8p-9vwx-vf98 (bucle infinito de `unzipSync` con ZIP64 malformado) | `fflate` 0.7.3 | `satori` 0.51.0 (y `@shuding/opentype.js`) — 2 | Aceptado por OD-33 (SOT-4); T47 confirmó que la ruta no es alcanzable. | Ejecución (servidor) | Solo bajando `satori` a 0.32.0, una versión mayor anterior. | No aplicar; mantener OD-33 hasta que `satori` use `fflate` ≥ 0.7.5. |
| GHSA-3g3m-2fjr-6pw4 (cancelación con `AbortSignal` de `glob`) | `glob` 13.0.6 | `@fastify/static` 10.1.6 — 2 | `@fastify/static` solo llama a `glob` con `wildcard: false`; el servidor usa `wildcard: true` (`platform/http/server.ts`), así que no se ejecuta. | Ejecución (no alcanzable) | `@fastify/static` 10.1.11, mismo mayor, con `glob` 14. | Bajo; requiere repetir las pruebas del servidor estático, CSP y cabeceras. |
| GHSA-g3hv-75wg-m249 (denegación de servicio en `minimatch`) | `minimatch` 10.2.6 | `glob` (ejecución, no alcanzable) y `eslint` 10.12.0, `@eslint/config-array`, `typescript-eslint` 8.71.2 y sus 5 paquetes internos (desarrollo) — 9 | En desarrollo los patrones salen de la configuración del repositorio, no de entradas externas. | Desarrollo (y la ruta no alcanzable de `glob`) | Ruta de ejecución: la misma actualización de `@fastify/static`. Desarrollo: ninguna sin bajar de versión mayor; `eslint` 10.14.0 sigue pidiendo `minimatch` ^10. | Esperar a `eslint`/`typescript-eslint`; un `overrides` a `minimatch` 11 no se recomienda sin evaluar compatibilidad. |

No se actualizó ninguna dependencia. La propuesta de actualizar `@fastify/static` a 10.1.11 queda para la decisión
del PO (secciones 7.3 y 10).

### 7.2 Prettier

Se formatearon los tres archivos señalados (`competitions/import-preview.int.test.ts`, `projects/respond.ts`,
`platform/http/errors.ts`). El cambio es solo de saltos de línea (`git diff -w`), sin cambios funcionales.
`prettier --check .` pasa.

### 7.3 Evaluación del parche de `@fastify/static` (sin aplicar)

Datos del registro de npm, consultados el 2026-11-13 sin instalar nada:

| Aspecto | 10.1.6 (instalada) | 10.1.11 |
| --- | --- | --- |
| Versión mayor | 10 | 10 (mismo mayor) |
| `glob` | ^13.0.0 (13.0.6, afectado por GHSA-3g3m-2fjr-6pw4) | ^14.0.0 (la última 14.0.6 está fuera del rango afectado, ≤ 14.0.1) |
| `minimatch` (vía `glob`) | 10.2.6 (afectado por GHSA-g3hv-75wg-m249) | ^11.0.5 (fuera del rango afectado, < 11.0.1) |
| `@fastify/send` | ^4.0.0 (4.2.0 instalada) | ^4.2.0 (la instalada ya cumple) |
| Node | `glob` 13: Node 18, 20 o ≥ 22 | `glob` 14: Node 18, 20 o ≥ 22; el proyecto usa 22.22.2 |
| Publicación | 2026-10-09 | 2026-11-13, el mismo día de esta evaluación; entre medias, cuatro versiones de parche (10.1.7 a 10.1.10) |

- **Efecto esperado:** elimina los avisos de `glob` y `minimatch` en la ruta de ejecución. Quedan `fflate` (OD-33) y
  `minimatch` en las herramientas de desarrollo.
- **Riesgo de compatibilidad:** bajo pero no nulo. Sube `glob` de versión mayor como dependencia transitiva y acumula
  cinco parches. El servidor solo usa el plugin con `wildcard: true` para servir la web compilada.
- **Recomendación:** no aplicarlo en UI-06.1. Autorizarlo aparte en UI-06.3, con lock nuevo, las pruebas del
  servidor estático (rutas, cabeceras, CSP, `index.html` de respaldo y caché), la suite completa y `npm audit`.
  Conviene esperar unos días desde la publicación del 2026-11-13.

## 8. Resultados

Ejecución final del 2026-11-13, con la corrección de E2E-F01, sobre el árbol de este incremento
([`ui-06-1-verification-final.txt`](evidence/UI-06/ui-06-1-verification-final.txt),
[`ui-06-1-e2e-final.txt`](evidence/UI-06/ui-06-1-e2e-final.txt),
[`ui-06-1-a11y-final.txt`](evidence/UI-06/ui-06-1-a11y-final.txt)). Los archivos `ui-06-1-*-after.txt` y
`ui-06-1-verification.txt` son la ejecución anterior a la corrección, con E2E-F01 como fallo esperado; se conservan.

| Verificación | Resultado |
| --- | --- |
| `npm run test:e2e` | 22/22 correctas; E2E-F01 es una prueba normal |
| `npm run test:a11y` | 28/28 correctas (A11Y-01 y R-03 declarados como conocidos) |
| Typecheck | Sin errores |
| ESLint | Sin errores ni advertencias |
| Prettier | Pasa en todo el repositorio |
| Unitarias | 2563/2563 (145 archivos; una más que antes de la corrección: `VERSION_CONFLICT`) |
| Integración | 697/697 (58 archivos) |
| Contrato | 2419/2419 (7 archivos) |
| Identidad del contrato (`PRJ-CONTRACT-ID`) | Coincide: archivo y configuración `9bf188ca…22bc` |
| Build | Sin errores |
| `npm audit --audit-level=high` | Pasa: 0 altas o críticas; 13 moderadas (sección 7.1) |
| Escaneo de secretos | 0 hallazgos (`scripts/security-checks.mjs secret-scan`) |
| `git diff --check` | Limpio |
| Árbol tras ejecutar las suites | Sin cambios fuera de los de este incremento |
| Mutación de E2E-F01 | La regresión falla con la reutilización reintroducida (4.1.7) |

Las suites usan el adaptador `stub` para el texto de las diapositivas y el copy editorial, imágenes desactivadas,
datos sintéticos y directorios temporales; no tocan `data/edr.sqlite` ni llaman a proveedores deportivos ni a OpenAI.

## 9. Pruebas pendientes y limitaciones

- E2E-F01 está corregido y cubierto. Sus limitaciones (exportación por descarga, significado de «Vigente») están en
  4.1.8.
- Desde la corrección, el navegador cubre editar y guardar un copy y retirar su aprobación.
- Sin cubrir en el navegador: el texto del carrusel (`caption.txt`) aprobado y descargado; regenerar el copy; cambiar el idioma del proyecto y volver a redactar (la intención de R-284); crear competición, temporada,
  equipos y partidos desde la interfaz (las pruebas los crean por la API); propuestas visuales con IA y plantillas
  visuales que dependen de ellas (necesitan el proveedor de imágenes de pago); vistas previas de importación de
  proveedor (01D, LIVE_DATA); 20 diapositivas y textos largos (UI-06.3).
- La suite de accesibilidad escanea a 1280 × 720; los anchos 1440, 1280, 1024, 768 y 390 px de todas las pantallas
  priorizadas, el teclado, el foco, el zoom al 200 %, el reflow a 320 px, los colores forzados y el movimiento
  reducido se validan en UI-06.2. Hoy solo el shell, Inicio y el asistente se prueban en varios anchos.
- axe no detecta A11Y-02 ni la mayoría de los problemas de teclado; requieren revisión manual en UI-06.2.

## 10. Decisiones del Product Owner y cierre

### 10.1 Decisiones del 2026-11-13

1. Acepta la dirección técnica de la recuperación de las suites E2E y de accesibilidad.
2. No autoriza el cierre hasta corregir E2E-F01, con la regla PD-33 vigente (aprobaciones gráfica y editorial
   independientes; cada exportación nueva solo con las versiones editoriales aprobadas y publicables). Hecho: 4.1.
3. Cambiar la frase contradictoria del panel del copy, sin rediseñar el panel. Hecho: 4.2.
4. A11Y-01, A11Y-02, R-02 y R-03 se corrigen en UI-06.2. No se ocultan y no se declara WCAG 2.2 AA mientras sigan
   abiertos (sección 11).
5. Conservar la corrección del hash del contrato y las de Prettier. Hecho: secciones 6 y 7.2.
6. Registrar la evaluación de `npm audit` sin actualizar dependencias y evaluar el parche de `@fastify/static` sin
   ampliar el alcance. Hecho: 7.1 y 7.3; cualquier actualización se autoriza aparte.
7. Si la corrección funciona, no hay regresiones y todas las verificaciones pasan: registrar la aceptación, cerrar
   UI-06.1 con un commit solo de sus cambios, sin merge, push ni deploy, y sin iniciar UI-06.2.

### 10.2 Cierre

Las condiciones de la decisión 7 se cumplen (sección 8). **UI-06.1 queda aceptado por el Product Owner y cerrado**
(recuperación de las suites y corrección de E2E-F01), en un commit de la rama `work/WI-2-UI-06` sobre `9f5963f` con
solo los cambios de este incremento. El hash del commit se registra en la fuente de verdad (sección 9, fila UI-06) y en
el registro de decisiones del Product Owner (sección 7). UI-06 no está terminado: UI-06.2 y UI-06.3 no han empezado y
necesitan la validación del Product Owner.

### 10.3 Decisiones abiertas

1. Inicio de UI-06.2 (A11Y-01, A11Y-02, R-02, R-03 y la validación responsive y WCAG 2.2 AA).
2. `@fastify/static` 10.1.11: autorizar la actualización en UI-06.3 (7.3) o mantener la clasificación.
3. O-1 y O-2: decidir si se ajustan.
4. Opcional: si se quiere evitar una exportación por cada descarga repetida, reutilización confirmada por el servidor
   mediante un cambio aditivo del contrato (4.1.3 y 4.1.8).

## 11. Estado de accesibilidad

- **Automático:** axe (WCAG 2.0, 2.1 y 2.2, niveles A y AA, impactos serio y crítico) pasa en las 28 pruebas a
  1280 × 720, con dos excepciones declaradas y abiertas: A11Y-01 y R-03. La suite falla con cualquier violación nueva
  y cuando se corrija una declarada.
- **Abiertos sin detección automática:** A11Y-02 (nombre accesible frente a estado visible) y R-02 (tooltip a
  768 px).
- **Sin validar todavía:** teclado y orden del foco, zoom al 200 %, reflow a 320 px, espaciado de texto, colores
  forzados, movimiento reducido y los cinco anchos de todas las pantallas priorizadas. Es el alcance de UI-06.2.
- **Conclusión:** no se declara el cumplimiento de WCAG 2.2 AA. Se podrá evaluar al cerrar UI-06.2.
