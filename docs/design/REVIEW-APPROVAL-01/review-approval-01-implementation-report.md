# REVIEW-APPROVAL-01 — Informe de implementación y cierre (PD-33, Opción A)

## Estado

**CLOSED — PRODUCT OWNER ACCEPTED (2026-11-12).**

- Rama `work/REVIEW-APPROVAL-01`, creada desde el cierre de 01G-E (`a6113d8`).
- Un único commit de cierre con el código y la documentación de este refinamiento (sección 10).
- No se hizo merge, push ni deploy.
- Nada llama a OpenAI: las pruebas usan el escritor de copy de prueba (`stub`, gratis).

## Decisiones del Product Owner

1. **Respuesta a la preparación (2026-11-12):**

   > «No es necesario tener aprobado el copy para poder exportar el contenido generado para el carrusel, si se aprueba
   > alguno, si es bueno que se exporte dentro del mismo archivo .zip donde se exporta el contenido.»

   Después confirmó la lectura y la opción b: «si confirmo tu respuesta y la opcion b».
2. **Decisión formal del cierre (2026-11-12): PD-33, Opción A aprobada (aprobaciones independientes).**
   - La aprobación del carrusel gráfico es independiente de la aprobación del copy editorial.
   - Esto sustituye expresamente cualquier lectura anterior de PD-33 que exigiera aprobar el copy para aprobar el
     carrusel.
   - La exportación incorpora solo las versiones editoriales aprobadas y publicables al generar el archivo.
   - La implementación quedó aceptada funcionalmente, sujeta a los ajustes 1 a 5 de la sección 2.
3. **Nombre de la opción:** la «Opción A» del Product Owner es lo que la [preparación](./review-approval-01-preparation.md)
   llamó opción (b). La opción (a) de la preparación, el copy dentro de la aprobación final, no se eligió.

Registro: PD-33 en `.orchestrate/source-of-truth.md`, con la regla original, la enmienda y la decisión formal; no se
borró nada.

Sobre el costo: por proyecto, la única IA con costo es la del copy editorial. Los textos de las diapositivas se
escriben sin IA (`providers.ai` es `stub`), las diapositivas se dibujan en local, y la API de imágenes de OpenAI solo
se usa en «Propuestas visuales con IA».

## 1. Qué hace el refinamiento

- **Aprobación final del carrusel:** no cambia. Exige las diapositivas aprobadas, sin errores bloqueantes y con las
  validaciones de siempre. El copy editorial no la condiciona, y sus cambios no la invalidan.
- **Copy editorial:** se aprueba por entregable, igual que en 01H (DE-5).
- **Exportación:** incorpora los entregables exportables en `copy-editorial.txt`, dentro del mismo `.zip`.
  Exportable significa versión actual, aprobada, sin avisos y con todos sus datos deportivos publicables al escribir
  el archivo. El manifiesto registra la versión exacta de cada uno.
- **Sin copy exportable:** la exportación es igual que antes.
- **Aprobar el copy después:** basta con volver a exportar.

## 2. Ajustes del cierre

### Ajuste 1 — Aprobado y exportable

- **Una sola regla en el servidor:** `apps/server/src/modules/editorial/eligibility.ts` (`editorialExportable`). La
  versión es exportable si es la actual, está aprobada, no tiene avisos y no tiene hechos bloqueantes
  (`blockingFactRefs`, la regla de su aprobación). La usan:
  - la exportación (`export/service.ts`), al planificar y otra vez en la transacción que la registra;
  - el paquete editorial (`editorial/service.ts`), que añade `exportable` a cada entregable
    (`EditorialDeliverableState.exportable`, cambio aditivo del contrato).
- **Por qué hace falta el cambio de contrato:** sin él, la web tendría que inventar su propia regla de publicabilidad,
  y el encargo lo prohíbe.
- **La web solo lee estados del servidor** (`review/model.ts`, `editorialExportSummary`):
  - **listos para exportar:** `exportable`;
  - **requieren revisión:** aprobados que el servidor ya no deja exportar.
- **Ejemplo del encargo:** con tres aprobados, uno de ellos con datos que dejaron de ser publicables, y dos pendientes,
  el diálogo dice «2 de 5 textos listos para exportar. 1 texto aprobado requiere revisión por cambios en los datos
  deportivos.» Nunca 3.
- **Si la elegibilidad cambia entre el diálogo y la exportación,** manda el servidor: la exportación vuelve a comprobar
  y, si cambió mientras escribía, responde `VERSION_CONFLICT` sin registrar nada.
- **Coste:** no hay consultas nuevas por diapositiva. El paquete calcula la regla para como mucho cinco versiones
  actuales.

### Ajuste 2 — Formato de `copy-editorial.txt`

- **Codificación y orden:** UTF-8, saltos de línea `\n`, línea final. Los entregables van en el orden del contrato,
  aunque la base los devuelva en otro. Antes salían en orden alfabético; se corrigió.
- **Encabezado:** «COPY EDITORIAL APROBADO» y la selección (competición · jornada o fase · temporada).
- **Secciones:** una por entregable exportable, con su título entre dos líneas de 40 `=`, una línea en blanco y el
  texto. Títulos:

  | Entregable | Título |
  | --- | --- |
  | `facebook_instagram` | Facebook / Instagram |
  | `tiktok_reels` | TikTok / Reels |
  | `viral_headlines` | Titulares virales |
  | `youtube` | YouTube |
  | `debate_question` | Pregunta para generar debate |

- **Texto de cada sección:** el mismo que la revisión ofrece para copiar o descargar (`editorialDeliverableText`, una
  sola función en `@edr/contracts` que usan la exportación y la descarga de la revisión). Se toma de la versión
  guardada; no se reconstruye nada.
- **Sin datos técnicos:** ni identificadores, ni versiones, ni JSON, ni fuentes, ni enlaces, ni secciones vacías.
  - Un copy con URL o marcado se marca con un aviso y no se puede aprobar (01H), así que nunca llega al archivo.
  - Los identificadores de acontecimientos y evidencias se guardan aparte del texto.
- **Versiones:** las registra el manifiesto, en `editorial.deliverables` (versión, número, fecha de aprobación, hash
  del texto y hechos).

### Ajuste 3 — Compatibilidad de las exportaciones

La migración `0036` reconstruye `export_files` para aceptar el tipo `editorial_text`, con el procedimiento de 0002 y
0035. No se editó tras aplicarse.

| Caso | Comprobación |
| --- | --- |
| Base existente | Prueba con datos sembrados en el esquema anterior: cada fila se conserva byte a byte, el DDL solo cambia la lista de tipos, integridad y claves foráneas correctas. |
| Base nueva | Las pruebas de migraciones y de esquema aplican las 36 sobre una base vacía. |
| Base real | Copia previa y copia posterior, tras aplicarla el servidor de desarrollo a las 19:47 UTC: 102 filas idénticas, integridad correcta y la API responde. |
| Exportaciones y ZIP anteriores | Siguen descargándose con sus archivos y hashes. |
| Sin copy, con copy parcial y con todos los entregables | Probados. |
| Determinismo | Dos exportaciones seguidas escriben el mismo `copy-editorial.txt`, byte a byte. |

### Ajuste 4 — Concurrencia y consistencia

| Escenario | Resultado | Prueba |
| --- | --- | --- |
| A. El copy se edita durante la exportación | `VERSION_CONFLICT`, nada registrado; la siguiente exportación va sin la versión no aprobada | `export.int.test.ts` |
| B. El copy pierde su aprobación durante la exportación | `VERSION_CONFLICT`, nada registrado | `export.int.test.ts` |
| C. Un dato del copy deja de ser publicable | Antes de exportar: queda fuera. Durante la exportación: `VERSION_CONFLICT`. En el paquete: aprobado pero no exportable | `export.int.test.ts`, `export-editorial-copy.test.ts` |
| D. Dos exportaciones seguidas | Dos registros, mismo copy y mismo hash | `export.int.test.ts` |
| E. Carrusel aprobado sin copy | Exportación igual que antes | `export-editorial-copy.test.ts` |
| F. Copy aprobado después de la aprobación final | La aprobación final sigue válida; la nueva exportación lo incluye | `export-editorial-copy.test.ts` |
| G. Retirar el copy después de exportar | La exportación anterior conserva sus archivos; la aprobación gráfica sigue válida; la siguiente va sin copy | `export-editorial-copy.test.ts` |

Las reglas de aprobación de diapositivas no cambian. Ningún cambio editorial invalida la aprobación gráfica.

### Ajuste 5 — Experiencia de usuario

Solo cambiaron las frases de la línea «Copy editorial» del diálogo de aprobación final (UX-REVIEW-01):

- **Con copy:** «N de M textos listos para exportar.» Si hace falta, añade «K texto(s) aprobado(s) requiere(n) revisión
  por cambios en los datos deportivos.» Sigue: «Opcional: los textos listos se incluyen en la descarga
  (copy-editorial.txt) y los demás quedan fuera. Puedes aprobarlos después y volver a descargar; los cambios en el copy
  no anulan la aprobación del carrusel.»
- **Sin copy:** «Sin generar. Opcional: puedes generarlo y aprobarlo después y volver a descargar; no anula la
  aprobación del carrusel.»
- **Estado ilegible:** «No se pudo leer su estado. Es opcional: no afecta a la aprobación del carrusel.»

Lo que no cambia:

- las pantallas, pasos y modales, y las acciones «Aprobar carrusel», «Revisar copy» y «Descargar carrusel»;
- el diseño de UX-REVIEW-01, 01G y 01H.

## 3. Contrato (aditivo)

- `ExportFileKind` añade `editorial_text`, y `ExportFile.fileName` admite `copy-editorial.txt`.
- `EditorialPackage.deliverables[].exportable` (obligatorio en la respuesta).
- La descripción de `exportCarousel` explica el copy y `VERSION_CONFLICT`.

Contract Safety:

| Condición | Resultado |
| --- | --- |
| CS-1: sin operaciones, rutas ni campos eliminados | Se cumple. |
| CS-2: sin cambios de tipo de lo existente | Se cumple. |
| CS-3: las respuestas anteriores siguen siendo válidas | Se cumple: una exportación sin copy no cambia. |
| CS-4: el único cliente se actualiza a la vez | Se cumple. |
| CS-5: pruebas de contrato | Pasan, con deltas y muestras registrados y la prueba del archivo nuevo. |

El hash registrado del contrato sigue desactualizado desde fases anteriores (DEP-4).

## 4. Archivos

**Servidor:**

- `modules/editorial/eligibility.ts` (nuevo) y `editorial/service.ts`;
- `modules/export/service.ts`, `manifest.ts`, `repository.ts`, `files.ts` y `zip.ts`;
- `migrations/0036_export_editorial_copy.sql` (nuevo).

**Contrato:**

- `contracts/http-api.openapi.yaml`;
- `packages/contracts/src/http/editorial.ts`, `exports.ts` y `primitives.ts`.

**Web:**

- `features/review/FinalApproval.tsx`, `model.ts`, `copy.ts` y `editorial/download.ts`;
- `features/history/copy.ts` y `ExportFiles.tsx`.

**Pruebas:**

- `export/manifest.test.ts` y `export/export.int.test.ts`;
- `test/integration/delivery/export-editorial-copy.test.ts` (nuevo);
- `platform/db/migrations.int.test.ts`, `schema.int.test.ts` y `visual-qa/stage.int.test.ts`;
- `test/contract/openapi-document.test.ts` y `support/samples.ts`;
- web: `FinalApproval.test.tsx`, `test/support.tsx` y `editorial/EditorialCopy.test.tsx`.

**Documentación:**

- `.orchestrate/source-of-truth.md`;
- `docs/design/REVIEW-APPROVAL-01/*` (índice, preparación y este informe);
- `docs/design/UX-REVIEW-01/README.md` y `docs/design/PD-ARCH-01H/README.md`.

## 5. Pruebas

Verificación final del estado que se confirma (datos sintéticos, bases temporales, escritor de copy de prueba):

| Verificación | Resultado |
| --- | --- |
| Typecheck | Sin errores |
| ESLint (`--max-warnings 0`) | Sin errores |
| Prettier | Solo los 3 archivos preexistentes (sección 6) |
| Unitarias (servidor y web) | 2562/2562 (+6 sobre el cierre de 01G-E) |
| Integración | 697/697 (+8) |
| Contrato | 2419/2419 (+1) |
| Build de producción | Sin errores |
| `npm audit --audit-level=high` | Pasa; 13 moderadas preexistentes |
| `git diff --check` y escaneo de secretos | Limpios |
| E2E y accesibilidad | No ejecutados (sección 6) |

Cobertura por área:

- **Dominio y aplicación:**
  - aprobación gráfica independiente;
  - elegibilidad del copy (paquete y exportación);
  - copy parcial, copy no publicable, versiones, retiro y datos que cambian;
  - concurrencia A a G.
- **ZIP y archivo:**
  - sin copy, con uno, con varios y con los cinco en el orden del contrato;
  - contenido exacto y UTF-8, sin identificadores ni enlaces;
  - manifiesto, y exclusión de lo no publicable.
- **Persistencia:** migración 0036 en base existente y en base nueva; exportaciones históricas.
- **Web:**
  - contador de listos para exportar con el ejemplo del encargo;
  - aviso de revisión;
  - mensajes sin copy y con estado ilegible;
  - la aprobación final sigue disponible;
  - fixtures con el campo nuevo.
- **Compatibilidad:** todas las suites existentes (UX-REVIEW-01, 01H, 01G-E, aprobación, exportación e historial) en
  verde sin cambiar su comportamiento.

## 6. Problemas preexistentes

- **Prettier:** sigue marcando los mismos 3 archivos (`competitions/import-preview.int.test.ts`, `projects/respond.ts`,
  `platform/http/errors.ts`). No se tocaron.
- **`npm audit`:** pasa el umbral `high`; quedan las 13 advertencias moderadas conocidas (`fflate`, `glob`,
  `minimatch`). Sin cambios de dependencias.
- **E2E y accesibilidad:** no se ejecutaron. La suite global falla desde antes de 01E y queda para su recuperación en
  UI-06. No se declaran como pasadas.
- **Hash del contrato:** sigue desactualizado (DEP-4).

## 7. Limitaciones conocidas

- Con varios carruseles en un borrador, cada exportación lleva el mismo copy exportable.
- La página de detalle de una exportación no muestra el copy: está en el `.zip` y en el manifiesto.
- El indicador de progreso de la revisión cuenta los textos aprobados (estado de aprobación), no los exportables. El
  diálogo de aprobación final es el que habla de la descarga.
- La aprobación final no registra el copy. La trazabilidad la da el manifiesto, con la versión exacta exportada.

## 8. Validación manual

No hace falta reiniciar: la migración ya está aplicada.

1. Exporta un carrusel aprobado sin copy aprobado: el `.zip` sale como antes.
2. Aprueba uno o varios textos en «Copy editorial».
   - En el diálogo de aprobación final verás «N de M textos listos para exportar».
   - Al exportar, el `.zip` trae `copy-editorial.txt` con esas secciones, en el orden Facebook / Instagram, TikTok /
     Reels, Titulares virales, YouTube y Pregunta para generar debate.
3. Edita o retira un texto aprobado y exporta: ya no aparece. La aprobación del carrusel sigue válida.

## 9. Estado de la migración 0036

Aplicada en la base real de desarrollo el 2026-11-12 a las 19:47 UTC. Se comprobó antes y después sobre copias: 102
filas idénticas e integridad correcta. Es compatible con las bases nuevas y con las existentes. No se editó tras
aplicarse.

## 10. Git

- Rama `work/REVIEW-APPROVAL-01`.
- Un commit de cierre con todo el refinamiento, sobre `a6113d8`. Su hash se informa en la entrega: un commit no puede
  contener su propio hash.
- El cierre de 01G-E no se tocó.
- Sin merge, push ni deploy.
