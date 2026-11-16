# REVIEW-APPROVAL-01 — Preparación de la implementación (PD-33)

## Estado

- Preparado el 2026-11-12 en `work/REVIEW-APPROVAL-01`, creada desde el cierre de 01G-E (`a6113d8`).
- **No hay ningún cambio funcional:** la implementación espera las decisiones pendientes de la sección 2.
- **Actualización del mismo día:** el Product Owner confirmó la lectura de su respuesta y la opción b, y se implementó.
  Ver el [informe de implementación](./review-approval-01-implementation-report.md).
- **Al cerrar**, el Product Owner aprobó formalmente esta misma solución con el nombre **«Opción A — aprobaciones
  independientes»** (PD-33). Corresponde a la opción (b) de este documento. La opción (a) de este documento, el copy
  dentro de la aprobación final, no se eligió.
- Este documento no reescribe el [README del refinamiento](./README.md) ni las decisiones registradas. Las completa con
  la inspección del código y el plan.

## Respuesta del Product Owner (2026-11-12)

> «No es necesario tener aprobado el copy para poder exportar el contenido generado para el carrusel, si se aprueba
> alguno, si es bueno que se exporte dentro del mismo archivo .zip donde se exporta el contenido.»

Lectura, confirmada después por el Product Owner («si confirmo tu respuesta y la opcion b»):

- **El copy no es requisito.** La aprobación final y la exportación del carrusel no exigen copy editorial aprobado.
  Esto reemplaza el punto 2 de PD-33, la única parte de PD-33 que no se cumplía, y mantiene PD-ARCH-01E-PD-02 también
  para el copy editorial. Al confirmarse se registra como enmienda de PD-33, sin borrar su historia.
- **Lo aprobado se exporta.** Los entregables del copy editorial que estén aprobados, cualquiera de los cinco, van en
  el mismo `.zip` de la exportación del carrusel.

Efecto en las preguntas de la sección 2:

| Pregunta | Efecto |
| --- | --- |
| RA-1 | Ya no hay un entregable obligatorio: se exporta cualquiera aprobado. |
| RA-2 | Ya no hace falta distinguir proyectos: la regla de aprobación no cambia. |
| RA-3 | Sigue resuelta. |
| RA-4 | Respondida: sí, en el mismo `.zip`. |
| RA-5 | Sigue resuelta: el copy aprobado del borrador va en la exportación de cada uno de sus carruseles. |
| RA-6 | Desaparece: el copy no condiciona la aprobación. |

Pregunta del Product Owner sobre el costo, comprobada en `config/dev-full.config.json`:

- `providers.ai`, que escribe los textos de las diapositivas y del carrusel, es `stub`: no llama a ninguna IA.
- `providers.images`, la API de imágenes de OpenAI, solo se usa al pedir «Propuestas visuales con IA» (01G-B). Los
  proyectos dibujan sus diapositivas en local, con las plantillas y los fondos ya aprobados.
- `providers.editorial`, el modelo de texto de OpenAI, es la única llamada de IA con costo por proyecto. Solo ocurre
  cuando el operador genera o regenera el copy en «Copy editorial» y confirma el costo (PD-30).

## 1. Estado real de PD-33

PD-33 es una regla decidida por el Product Owner el 2026-11-12 y registrada en `.orchestrate/source-of-truth.md`. **No
está implementada.** Inspección del código en `a6113d8`:

| Punto de PD-33 | Hoy | Dónde |
| --- | --- | --- |
| 1. Diapositivas requeridas aprobadas | Se cumple | `review/service.ts`, `approveCarousel`: `FINAL_APPROVAL_REFUSED` con cada diapositiva sin aprobar. |
| 2. Contenido editorial publicable aprobado | **No se cumple** | `coveredElements` solo mira los elementos del carrusel (diapositivas, y el texto del carrusel si está aprobado). La aprobación final no lee `editorial_versions`. |
| 3. Sin errores bloqueantes | Se cumple | Se rechazan diapositivas bloqueadas, con observaciones o con QA fallido, y un texto del carrusel aprobado pero bloqueado. |
| 4. Validaciones actuales | Se cumple | Advertencias sin confirmar, conjunto de versiones con SHA-256 (AD-13), publicabilidad (AD-28, AD-38). |

Datos del código que condicionan el diseño:

- **El copy editorial pertenece al borrador**, no al carrusel (`editorial_versions.draft_id`). Un borrador nuevo (por
  ejemplo, una nueva redacción) empieza sin copy.
- **Un entregable solo existe después de una generación.** Con la configuración real (`config/dev-full.config.json`) la
  hace el escritor facturado de OpenAI (PD-30: USD 5 al mes, 30 al día, confirmación de costo). La edición manual
  (`editEditorialDeliverable`) parte de una versión existente: no crea la primera.
- **La aprobación de un entregable** (`editorial/service.ts`, `approve`) ya exige la versión actual, ningún aviso y
  todos sus hechos publicables. Es su propia transacción. Hoy editar, regenerar o retirar la aprobación no toca
  ninguna aprobación final.
- **Dos lugares calculan qué cubre la aprobación final:** `review/service.ts` (`coveredElements` y `#holds`) y
  `export/service.ts` (`#validFinalApproval`).
- **El conjunto de versiones** (`final_approvals.version_set`) solo admite versiones de elementos del carrusel: la
  exportación carga cada ID como diapositiva o texto. Por eso no puede llevar un ID de copy editorial.
- **Al arrancar, `invalidateStaleFinalApprovals`** invalida toda aprobación final que ya no cumple la regla vigente. Si
  la regla nueva se aplicara a todos los proyectos, el siguiente arranque invalidaría las aprobaciones anteriores.
  Eso contradice PD-33.
- **La interfaz** ya recibe el paquete editorial en la acción de aprobación final (`FinalApproval.tsx`), y ya permite
  descargar todos los copys como `.txt` desde el navegador (`editorial/download.ts`), fuera de la exportación.
- **La aprobación masiva de diapositivas** (UI-04B) no hace la aprobación final, así que no le afecta.

## 2. Preguntas RA-1 a RA-6

### RA-1 — Qué contenido editorial corresponde a un carrusel

- **Pregunta original:** «¿Cuál es "el contenido editorial publicable correspondiente" de un carrusel? (a) El
  entregable `facebook_instagram` de 01H; (b) todos los entregables generados; (c) el texto del carrusel.»
- **Alternativas documentadas:** (a), (b) y (c).
- **Recomendación:**
  - (a) `facebook_instagram`, que la interfaz de 01H llama «Copy principal»: es el texto de la publicación del carrusel
    en Instagram y Facebook.
  - (b) exigiría aprobar textos de otros canales (TikTok, YouTube) para publicar un carrusel.
  - (c) no es contenido editorial de 01H.
- **Decisiones aplicables:**
  - PD-33 dice «correspondiente», sin nombrar el entregable.
  - DE-5 de 01H: cada entregable se aprueba por separado.
  - Ninguna decisión elige entre (a), (b) y (c).
- **Estado: pendiente. Necesita autorización.**
- **Consecuencias:**
  - Con (a), el resto de entregables siguen como hoy.
  - Con (b), «todos los generados» cambia según lo que el operador haya generado. Sería un criterio poco estable.

### RA-2 — Qué proyectos conservan la regla anterior

- **Pregunta original:** «¿Qué proyecto usa el "modelo legacy de copy"?»
- **Alternativas documentadas:**
  - una marca en el proyecto al crearlo (recomendada);
  - «no tiene copy editorial» (descartada porque permite saltarse la regla).
- **Recomendación:**
  - Los proyectos creados antes de activar la regla conservan la regla anterior para siempre, sean cuales sean sus
    borradores.
  - Los proyectos nuevos llevan una marca explícita, una columna nullable de `projects` cuyas filas existentes quedan
    en NULL.
  - Las aprobaciones finales ya válidas no se tocan.
- **Decisiones aplicables:** PD-33 («Projects that use the legacy copy model keep their rules and approvals» y «final
  approvals given before are not invalidated») y tu encargo («No invalidar retroactivamente proyectos antiguos que ya
  fueron aprobados»).
- **Estado: principio resuelto por PD-33.** Queda por confirmar la frontera. La pregunta concreta: un proyecto antiguo
  que todavía no tiene aprobación final, ¿sigue con la regla anterior (recomendado, es lo que dice PD-33) o pasa a
  exigir el copy?
- **Consecuencias:**
  - Hace falta una migración (sección 3.2).
  - La invalidación al arrancar respeta la regla del proyecto.

### RA-3 — Texto del carrusel y copy editorial

- **Pregunta original:** «Si existen el texto del carrusel y el entregable editorial, ¿cuál se exige?»
- **Alternativas documentadas:** exigir el entregable editorial, el texto del carrusel o los dos.
- **Recomendación:**
  - En los proyectos nuevos se exige el entregable editorial.
  - El texto del carrusel sigue siendo opcional, como hoy: entra en la aprobación final y en `caption.txt` solo si está
    aprobado (PD-ARCH-01E-PD-02, solo para el texto del carrusel).
- **Decisiones aplicables:** PD-33 («The same editorial content is not approved twice») y tu encargo («No exigir dos
  aprobaciones diferentes del mismo entregable editorial»).
- **Estado: resuelta por PD-33.** Exigir los dos textos de la misma publicación sería una aprobación duplicada.
- **Consecuencias:** el texto del carrusel no cambia de comportamiento.

### RA-4 — Exportación del copy editorial

- **Pregunta original:** «¿La exportación incluye el copy editorial aprobado?»
- **Alternativas documentadas:**
  - Sí, como archivo de texto junto a las diapositivas (recomendada).
  - No: la descarga `.txt` que ya existe en la revisión basta.
- **Recomendación: sí.**
  - Un `editorial.txt` con la versión aprobada del Copy principal, registrada en `manifest.json` con su ID y su hash.
    Así la exportación contiene exactamente lo que cubrió la aprobación final.
  - `caption.txt` no cambia.
  - La descarga del navegador sigue existiendo.
- **Decisiones aplicables:** ninguna.
- **Estado: pendiente. Necesita autorización.**
- **Consecuencias:**
  - Valor nuevo `editorial_text` en `ExportFileKind` (cambio aditivo del contrato), el manifiesto, el ZIP y el
    historial de exportaciones.
  - Es separable: sin él, la regla de aprobación se implementa igual.

### RA-5 — Un copy para varios carruseles

- **Pregunta original:** «Con varios carruseles, ¿una aprobación del copy editorial vale para todos los carruseles del
  borrador?»
- **Alternativas documentadas:** una aprobación para todos (recomendada) o una por carrusel.
- **Recomendación:** una aprobación para todos los carruseles del borrador.
- **Decisiones aplicables:** PD-33 («The same editorial content is not approved twice») y DE-5 de 01H (cada entregable
  se aprueba una vez). Además, el modelo de datos guarda un copy por borrador, no por carrusel.
- **Estado: resuelta por PD-33 y el modelo vigente.**
- **Consecuencias:** cambiar o retirar el copy invalida la aprobación final de todos los carruseles del borrador.

### RA-6 — Si el copy no se puede generar (ambigüedad nueva, descubierta en la inspección)

- **Pregunta:**
  - En un proyecto nuevo, ¿qué pasa si el Copy principal no existe y no se puede generar? Por ejemplo: límite de 30
    generaciones al día o de USD 5 al mes alcanzado, OpenAI caído o sin clave.
  - Lo mismo después de una nueva redacción, porque el copy es del borrador y el nuevo empieza sin él.
- **Alternativas:**
  - (a) **Regla estricta:** la aprobación final espera hasta que exista y se apruebe el Copy principal.
  - (b) Permitir que el operador escriba a mano la primera versión del Copy principal, sin IA. Es una operación nueva
    del contrato y una ampliación de 01H.
  - (c) Copiar el copy aprobado al nuevo borrador cuando sus hechos no cambian. Es complejo y toca la trazabilidad.
- **Recomendación:** (a) en este refinamiento, que es lo que dice PD-33. Dejar (b) como mejora posterior si los límites
  bloquean el trabajo diario.
- **Decisiones aplicables:**
  - PD-33 exige el copy aprobado.
  - PD-30 fija los límites y la confirmación de costo de cada generación.
  - Ninguna decisión resuelve el caso de un copy imposible de generar.
- **Estado: pendiente. Ambigüedad real de negocio que necesita tu decisión.**
- **Consecuencias de (a):**
  - Cada proyecto nuevo y cada nueva redacción cuestan al menos una generación facturada antes de exportar.
  - El tope de 30 generaciones al día pasa a ser también un tope de proyectos aprobables por día.
  - Una caída del proveedor bloquea la aprobación final de los proyectos nuevos, no la de los anteriores.

## 3. Alcance revisado tras la respuesta

La sección se reescribió con la respuesta del Product Owner. La propuesta anterior (copy obligatorio para la
aprobación final, con marca de proyecto y migración) queda descartada; su análisis sigue en la sección 2.

Queda una elección de diseño: cómo entra en la exportación el copy aprobado.

- **(b) Recomendada: copy aprobado al exportar.**
  - La exportación incluye las versiones aprobadas en ese momento de los entregables del borrador.
  - Las vuelve a comprobar en su transacción: versión actual, aprobada y con hechos publicables. Un entregable
    bloqueado no se exporta.
  - El manifiesto registra cada versión.
  - La aprobación final no cambia, no hace falta migración y aprobar el copy después no obliga a aprobar otra vez el
    carrusel: basta con exportar de nuevo.
  - Coherente con DE-5: el copy se aprueba por separado, sin efecto en la aprobación final.
- **(a) Copy cubierto por la aprobación final**, como el texto del carrusel hoy (PD-ARCH-01E-PD-02).
  - La aprobación final registra las versiones aprobadas del copy, lo que exige una migración.
  - Aprobar, editar o retirar un copy después invalida la aprobación final de todos los carruseles del borrador: hay
    que aprobarlos otra vez para exportar el copy.
  - Más trazable, pero con más fricción.

Con (b):

- **Exportación** (`export/service.ts`, `manifest.ts`, `zip.ts`):
  - un archivo `copy-editorial.txt` en el `.zip`, solo cuando hay al menos un entregable aprobado;
  - el archivo tiene solo los aprobados, ordenados por red, con el mismo formato de la descarga que ya existe en la
    revisión;
  - el manifiesto añade, por entregable, la versión, su número, la fecha de aprobación y el hash del texto;
  - sin entregables aprobados, la exportación es igual que hoy.
- **Formato del texto:** pasa a una función compartida del servidor, para que el archivo exportado y la descarga de la
  revisión digan lo mismo.
- **Contrato (aditivo):** `ExportFileKind` añade `editorial_text`; el archivo aparece en `files` con
  `elementVersionId: null`.
- **Web:**
  - el historial y la descarga de exportaciones muestran el archivo nuevo con su nombre;
  - el diálogo de aprobación final ya dice si la descarga incluye el texto de publicación; se amplía esa misma frase
    al copy editorial;
  - sin rediseño ni elementos nuevos.
- **Sin cambios:** la aprobación final, la aprobación por entregable, la generación del copy, las diapositivas y todo
  lo validado en UX-REVIEW-01, 01G y 01H.
- **Fuente de verdad:** enmienda de PD-33 con la respuesta del Product Owner.

## 4. Plan de pruebas (con b)

**Integración:**

- exportación sin copy aprobado igual que hoy, en archivos y manifiesto;
- con uno, dos o los cinco entregables aprobados, `copy-editorial.txt` contiene solo esos, y el manifiesto lista sus
  versiones;
- un copy editado o regenerado después de aprobarlo no se exporta hasta que se apruebe la nueva versión;
- un copy aprobado cuyos hechos dejan de ser publicables no se exporta;
- varios carruseles: cada exportación lleva el mismo copy del borrador;
- descarga del `.zip` e historial.

**Unitarias:** formato del texto (los cinco entregables, solo los aprobados y el orden) y el manifiesto.

**Contrato:** paridad Zod/OpenAPI de `ExportFileKind`, muestras y deltas.

**Web:** lista de archivos de la exportación y la frase del diálogo.

**Regresión:**

- todas las suites, en especial la revisión de UX-REVIEW-01, el copy editorial de 01H, la aprobación y la
  exportación;
- E2E no se puede ejecutar: la suite falla desde antes de 01E.

## 5. Riesgos (con b)

| Riesgo | Mitigación |
| --- | --- |
| Exportar un copy que dejó de ser publicable | Se comprueba en la transacción de la exportación y se excluye. |
| Diferencias entre el archivo exportado y la descarga de la revisión | Una sola función de formato. |
| La aprobación final no registra el copy | El manifiesto registra la versión exacta exportada, y la aprobación del copy ya está ligada a su versión (DE-5). |
| Romper lo ya validado | Cambio limitado a la exportación; regresión completa. |

## 6. Criterios de aceptación (con b)

1. La aprobación final y la exportación no exigen copy editorial aprobado.
2. Si hay entregables aprobados, el `.zip` incluye `copy-editorial.txt` solo con ellos, y el manifiesto registra cada
   versión.
3. Sin entregables aprobados, la exportación es igual que hoy.
4. Nunca se exporta un copy sin aprobar, reemplazado o con hechos no publicables.
5. La interfaz muestra el archivo en la exportación sin otros cambios.
6. Contrato aditivo, todas las verificaciones en verde y ninguna llamada real a OpenAI.

## 7. Estado de Git

- Rama `work/REVIEW-APPROVAL-01` desde `a6113d8`.
- El único cambio es este documento, sin commit. No se hizo merge, push ni deploy.
