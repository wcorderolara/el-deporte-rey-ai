# TEAM-DISPLAY-01 — Nombres de presentación de equipos: informe de implementación

## 1. Estado y alcance

- **Autorización:** el Product Owner la dio el 2026-11-13 («Implementemos TEAM-DISPLAY-01 completo en una sola
  entrega»). Sustituye a la instrucción anterior, que solo cubría TD-01A.
- **Rama:** `work/TEAM-DISPLAY-01`, creada desde `b6579fd`, el cierre de UI-06.3.
- **Estado: CLOSED — PRODUCT OWNER ACCEPTED (2026-11-16).** El Product Owner validó la iniciativa funcionalmente y la
  aprobó. Está cerrada en el commit de cierre de la sección 10, en `work/TEAM-DISPLAY-01` sobre `b6579fd`. No hay
  merge, push ni deploy. CLOUD-ARCH-01 no ha empezado.
- **Incluye** los ajustes de la sección 11 y los ajustes de revisión pedidos durante la validación (sección 12).
- **Decisión registrada:** PD-37 en `.orchestrate/source-of-truth.md`. Es la excepción a BR-05 y PD-06, solo para las
  imágenes; las dos reglas originales se mantienen (sección 4).
- **Objetivo:** cada equipo puede tener un nombre de presentación opcional que se dibuja en los carruseles deportivos.
  El nombre oficial sigue siendo la identidad deportiva, el nombre del copy editorial y el de las integraciones.

Requisitos de la instrucción y dónde se cumplen:

| # | Requisito | Dónde |
| --- | --- | --- |
| 1 | `displayName` opcional, con una migración nueva | Sección 3.1, migración 0038 |
| 2 | Contratos y endpoints compatibles | Sección 3.2 |
| 3 | Campo «Nombre para mostrar (opcional)» en la edición de equipos | Sección 3.8 |
| 4 | Usarlo en las plantillas visuales y del motor, o el oficial si no hay | Sección 3.5 |
| 5 | Guardarlo en el snapshot de cada proyecto nuevo | Sección 3.4, snapshot versión 4 |
| 6 | `team_names` y contenido aceptan solo el oficial o el de ese `teamId` | Secciones 3.6 y 3.7 |
| 7 | El oficial para copy, identificación e integraciones | Secciones 3.3 y 3.7 |
| 8 | Las sincronizaciones no lo sobrescriben | Sección 3.3 |
| 9 | Nada anterior se modifica | Sección 5 |
| 10 | Se mantienen las reglas de escudos y recursos de marca | Sección 5 |

## 2. Decisiones de diseño

- **D1. Dónde se guarda.** En `managed_teams.display_name`, que puede ser NULL. NULL significa que no hay nombre de
  presentación y se usa el oficial. No forma parte de la identidad: la regla de duplicados sigue siendo nombre más zona,
  y dos equipos pueden tener el mismo nombre de presentación.
- **D2. Reglas del valor.** Admite los caracteres de `TeamName`, de 1 a 32 (`TeamDisplayName`). Se normaliza igual que
  el nombre oficial: NFC, sin espacios al principio ni al final y con los espacios repetidos reducidos a uno. Un valor
  sin texto visible se rechaza con `VALIDATION_FAILED` en `/displayName`.
- **D3. Semántica de la edición.** Si se omite, se conserva; con null se quita; con un valor se cambia. Las
  importaciones y los clientes anteriores no lo envían, así que nunca lo borran ni lo cambian.
- **D4. La sustitución se hace al dibujar.**
  - El texto guardado de cada diapositiva, que usan la revisión, las comprobaciones del texto de IA, el copy y la
    traza, conserva siempre el nombre oficial y su hecho.
  - Al renderizar, `presentedText` cambia el texto de todos los segmentos `fact` de un hecho de nombre de equipo que
    tenga nombre registrado. Mantiene el mismo `factId` y la misma procedencia.
  - Eso cubre `team_home`, `team_away`, los nombres local y visitante de cada fila de `fixtures` y, desde el ajuste de
    la sección 11, los placeholders de equipo del texto de IA (`headline`, `description`).
  - El comentario, el texto de plantilla y los demás hechos se dibujan como están guardados.
- **D5. Cómo se asocia.** El nombre se asocia por el ID local del equipo, igual que los escudos (PD-32):
  1. Se parte del hecho del nombre.
  2. Se sigue su evidencia.
  3. Se llega a la observación de la fuente local, cuyo `teamKey` es el ID local.

  Nunca se compara por nombre. El `subject.teamId` de los hechos no sirve para esto: es un identificador canónico que
  verificación deriva del nombre oficial.
- **D6. Reproducibilidad.** Cada proyecto nuevo guarda en su snapshot (`projects.badge_snapshot_json`, versión 4) el
  nombre de presentación de cada uno de sus equipos que lo tenga. Se registra en la misma transacción que crea el
  proyecto. La columna ya acepta cualquier objeto JSON, así que no hace falta otra migración.
- **D7. Procedencia.** El nombre de presentación no es un dato del proveedor y no registra procedencia de campo. Si un
  operador edita un equipo importado y solo cambia el nombre de presentación, eso no cuenta como edición manual del
  nombre oficial ni de la zona. Así las importaciones siguientes pueden seguir actualizando el nombre oficial. Cambiar
  el nombre oficial sí se registra como edición manual protegida, igual que antes.
- **D8. Alta rápida desde una competición.** `addCompetitionTeam` no cambia de cuerpo. El nombre de presentación se
  configura en el diálogo «Editar equipo», que es lo que pidió la instrucción.

## 3. Cambios por subsistema

### 3.1 Persistencia

- `apps/server/migrations/0038_team_display_names.sql` añade
  `ALTER TABLE managed_teams ADD COLUMN display_name TEXT NULL CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 32)`.
- Cada equipo existente conserva su fila y queda con NULL. No se modificó ninguna migración anterior.
- Los repositorios leen la columna en todas las consultas de equipos (catálogo, competición, participantes, partidos
  del calendario). Escriben en ella solo al crear y al editar, y la conservan cuando el cambio es `keep`.

### 3.2 Contrato HTTP (cambio aditivo)

- **Componente nuevo:** `TeamDisplayName`.
- **`ManagedTeam.displayName`:** obligatorio y nullable. Lo heredan `CompetitionTeam`, `SeasonParticipant`,
  `CompetitionMatch.homeTeam` y `awayTeam`, y las operaciones de equipos.
- **Cuerpos de `createManagedTeam` y `updateManagedTeam`:** `displayName` opcional y nullable.
- **Espejo Zod:** se actualizó en `packages/contracts`.
- **Hash nuevo:** `0566f05075c2bfe71389cfe279e22b5889521c27afcf03cb6b0b3a91029939c2`, registrado en
  `.orchestrate/config.json` y en la sección 6 de la fuente de verdad. El anterior era `8cadafd1…a77a5a`.
- **Seguridad del contrato:** no se elimina ni cambia de tipo ninguna operación, ruta o campo. Un cliente que no envía
  el campo conserva el valor guardado.

### 3.3 Dominio, servicio, rutas e importaciones

- **`CompetitionAdministrationService`:**
  - `createTeam(name, region, displayName?)` y `updateTeam(name, region, displayName?)`.
  - La normalización y el rechazo de valores en blanco están en `displayNameChange`.
  - El tipo `TeamDisplayNameChange` (`keep`, `clear`, `set`) se define en `domain/ports.ts`.
- **Error nuevo:** `invalid_team_display_name`, que la ruta convierte en 400.
- **Importaciones (`import-persist.ts`):** no cambian. Siguen llamando a `createTeam(name, null)` y
  `updateTeam(id, name, region)` sin nombre de presentación, así que lo conservan.
- **Proveedores:** los nombres cortos y los códigos (`shortName`, `tla`) siguen siendo solo alias de emparejamiento. No
  se convierten en nombre de presentación.

### 3.4 Snapshot del proyecto (versión 4)

- **Formato** (`projects/badge-snapshot.ts`): `{ "version": 4, "teams": { <teamId>: <badgeId|null> }, "names": { <teamId>: <nombre> } }`.
  - `names` incluye solo los equipos que tenían nombre de presentación al crearse el proyecto.
  - Las versiones 1 a 3 y los proyectos sin snapshot se leen con `displayNames` vacío.
  - Las páginas y los escudos se dibujan igual que en la versión 3.
- **Escritura:** `content-batches/service.ts` lee los nombres actuales de los equipos de la pieza mediante
  `ContentBatchRepository.teamDisplayNames` y los guarda junto a los escudos.

### 3.5 Renderización (motor y plantillas visuales)

- **`visual-templates/project.ts`:**
  - `loadProjectDisplayNames` devuelve los nombres del snapshot.
  - `displayNamesOfSlides` asocia cada hecho a su nombre.
  - `displayNamesOfFacts` hace lo mismo para el QA.
  - `presentedText` es una función pura.
- **`rendering/stage.ts`:**
  - `load` calcula `teamDisplayNames` (hecho → nombre).
  - `run` y `renderElementVersion` dibujan con `presentedText`.
  - Así quedan cubiertos los resultados, partidos programados, previas, filas de calendario y capas de nombre de las
    plantillas visuales (`match.homeTeam.name`, `match.awayTeam.name` y las filas de `round.fixtures`).
  - También los placeholders de equipo del titular y la descripción de las plantillas del motor (sección 11). Las
    plantillas visuales no dibujan el texto de IA (decisión D9 de PD-ARCH-01G-D).

### 3.6 Control visual `team_names`

- El QA recibe `teamDisplayNames` (hecho → nombre), calculado desde el snapshot del proyecto
  (`visual-qa/stage.ts`, `buildInput`).
- En un elemento de nombre de equipo de la imagen, `team_names` acepta solo el nombre oficial del hecho o el nombre que
  el proyecto registró para el equipo de ese hecho. Cualquier otra forma falla: el nombre de otro equipo, el nombre en
  mayúsculas o sin tildes, o una parte del nombre oficial.
- En el texto de IA guardado sigue exigiéndose el nombre oficial.
- Desde el ajuste de la sección 11, `data_match` compara el texto de IA dibujado con el texto guardado dibujado con los
  nombres registrados. Solo pueden diferir esos segmentos.

### 3.7 Comprobaciones de contenido y copy editorial

No necesitan cambios, y se dejaron como estaban:

- La IA solo recibe nombres oficiales.
- Las comprobaciones de contenido (`checkTeamNames`, `NON_OFFICIAL_TEAM_NAME`) se aplican solo al texto que escribe la
  IA.
- El copy editorial se compone a partir de los hechos y nunca lee `managed_teams`.

Si un nombre de presentación aparece en el texto de IA o en el copy, sigue tratándose como forma no oficial.

### 3.8 Web

- El diálogo «Editar equipo» (Competiciones → Equipos) tiene un campo nuevo, «Nombre para mostrar (opcional)», de 32
  caracteres como máximo.
  - Si se deja vacío, se quita el nombre de presentación.
  - El botón «Guardar cambios» se activa también cuando solo cambia este campo.
- No se añadió ningún otro elemento a la interfaz.
- Los fixtures de las pruebas web incluyen `displayName`.

## 4. Revisión de BR-05 y PD-06

- **BR-05** («Team names are used as text and preserved as the verified official names…») y **PD-06** (nombres
  oficiales verificados) se mantienen tal como estaban.
- A cada una se le añadió una referencia a su enmienda: «Amended by PD-37…».
- **PD-37** documenta la excepción autorizada:
  - En las imágenes de un proyecto, un elemento de nombre de equipo puede dibujar el nombre de presentación que el
    proyecto registró para ese equipo.
  - En todo lo demás se conserva el nombre oficial: texto guardado, revisión, texto de IA, copy, archivos exportados,
    identidad e integraciones.
  - Siguen vigentes BR-19 (un nombre rechazado por `TeamName` no se altera) y PD-29 (mayúsculas en plantillas
    visuales).

## 5. Compatibilidad y protección de lo anterior

- **Proyectos, snapshots, exportaciones y plantillas publicadas anteriores:** no se reescriben.
  - Los proyectos con snapshot de versión 1 a 3, o sin snapshot, siguen dibujando los nombres oficiales, aunque el
    equipo tenga ahora un nombre de presentación. Hay una prueba para esto.
  - Cambiar o quitar después un nombre de presentación solo afecta a los proyectos nuevos.
  - Al regenerar una diapositiva de un proyecto se usa el nombre que ese proyecto registró.
- **Escudos y recursos de marca:** sus reglas no cambian (PD-28, PD-32). Los escudos siguen asociándose por el ID
  local del equipo.
- **Clientes de la API:** los que no envían `displayName` conservan el valor guardado. La alta rápida desde una
  competición no cambia.

## 6. Pruebas añadidas o actualizadas

Todas usan datos sintéticos, bases temporales y el escritor simulado. No llaman a ningún proveedor ni servicio de IA.

- **Migración 0038** (`migrations.int.test.ts`):
  - Parte de una base en la versión 37 con equipos; las filas quedan iguales y la nueva columna en NULL.
  - Acepta un valor de 32 caracteres y NULL; rechaza la cadena vacía y 33 caracteres.
  - La regla de identidad no cambia.
  - Las listas fijadas de migraciones, el orden de columnas (`schema.int.test.ts`) y el QA (`stage.int.test.ts`)
    incluyen la 0038.
- **API de equipos** (`competition-administration.int.test.ts`):
  - Crear con y sin nombre de presentación; omitirlo lo conserva, null lo quita y un valor lo cambia; se normaliza.
  - Se rechazan los valores en blanco, demasiado largos, con emoji o con caracteres no admitidos, y un error
    `/displayName`.
  - No interviene en la identidad.
  - La alta rápida desde una competición no lo acepta.
  - El listado lo muestra.
- **Importación** (`import-apply.int.test.ts`):
  - Una importación nunca escribe nombre de presentación.
  - Editar solo el nombre de presentación no marca el nombre oficial como edición manual.
  - Si el proveedor renombra el equipo, cambia el nombre oficial y se conserva el de presentación.
  - Un cambio manual del nombre oficial sigue protegido y conserva el de presentación.
- **Snapshot** (`badge-snapshot.test.ts`): lectura y escritura de la versión 4, versiones anteriores sin nombres y
  formas rechazadas.
- **Renderización** (`presented-text.test.ts`): solo cambian los segmentos de hechos de equipo (campos, filas y, desde
  la sección 11, los placeholders del texto de IA); los demás valores quedan iguales; el texto guardado no se modifica.
- **QA** (`visual-qa/core.test.ts`):
  - Acepta el nombre de presentación del equipo y también el oficial.
  - Rechaza el nombre de otro equipo, el nombre en mayúsculas, el nombre sin tildes, una parte del nombre oficial y un
    nombre que el snapshot no registró.
  - En el texto de IA nunca acepta el nombre de presentación.
- **Entrega completa** (`team-display-names.test.ts`, motor):
  - Resultado, calendario con filas, próximos partidos y previa dibujan el nombre de presentación o el oficial.
  - El snapshot es la versión 4 con los nombres de cada pieza.
  - El texto guardado y la leyenda conservan los nombres oficiales; el texto de IA dibujado sigue la sección 11.
  - `team_names` y `data_match` pasan.
  - El copy editorial (escritor simulado gratuito) usa el nombre oficial.
  - Tras la aprobación y la exportación, los archivos de texto no contienen nombres de presentación.
  - Reproducibilidad: un cambio posterior solo llega a los proyectos nuevos; quitarlo no afecta a los anteriores; un
    proyecto con snapshot de versión 3 sigue con los nombres oficiales.
- **Plantilla visual publicada** (`visual-template-projects.test.ts`): la capa de nombre dibuja el nombre de
  presentación, los valores guardados son los oficiales y el QA pasa.
- **Web** (`CompetitionListPage.test.tsx`):
  - El campo existe, tiene un máximo de 32 caracteres y está vacío por defecto.
  - Fijar un valor envía el nombre recortado; vaciarlo envía null.
  - La lista sigue mostrando el nombre oficial.
  - La prueba de edición existente ahora espera `displayName: null` en el cuerpo.
- **Contrato:** muestras sintéticas con `displayName`, 215 esquemas de componentes y la diferencia registrada
  `TeamDisplayName`.

## 7. Verificación

Ejecución final del 2026-11-16, con los ajustes de las secciones 11 y 12, sobre el árbol de trabajo del commit de cierre:

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores |
| `npm run lint` (ESLint y Prettier) | Sin errores |
| `npm run test:unit` | 150 archivos, 2614 pruebas superadas |
| `npm run test:integration` | 67 archivos, 737 pruebas superadas |
| `npm run test:contract` | 7 archivos, 2421 pruebas superadas |
| `npm run build` | Sin errores |
| `npm run test:e2e` | 22 superadas (servidor y datos temporales, puerto 4310) |
| `npm run test:a11y` | 44 superadas |
| `npm audit --audit-level=high` | 0 altas; 11 moderadas, las mismas que en UI-06.3 |
| `scripts/security-checks.mjs secret-scan` | 0 hallazgos, con los archivos nuevos incluidos |
| Hash del contrato | El archivo y la configuración coinciden: `0566f050…039c2` |
| `git diff --check` | Sin errores |

Base local del Product Owner (copia del WAL, solo lectura): versión 38, 53 equipos, ninguno con nombre de presentación,
`integrity_check` correcto.

## 8. Limitaciones

- **L1.** Resuelta en la sección 11: los placeholders de equipo del titular y la descripción se dibujan con el nombre de
  presentación.
- **L2.** Las diapositivas de clasificación no usan nombres de presentación, porque los proyectos de competiciones
  locales no tienen clasificación.
- **L3.** La vista previa con datos reales del editor y del asistente muestra el nombre de presentación (11.3).
- **L4.** El nombre de presentación no es único: dos equipos pueden tener el mismo, y elegir nombres que no se
  confundan es responsabilidad del operador. Tampoco garantiza que el texto quepa: `text_fit` sigue informando de los
  desbordamientos. L-01 queda mitigada para los equipos que tienen un nombre de presentación corto.
- **L5.** La lista de equipos de Competiciones sigue mostrando solo el nombre oficial, porque no se pidió mostrar el de
  presentación.

## 9. Migración 0038 aplicada en la base local del Product Owner

- **Qué pasó:**
  - El servidor de desarrollo del Product Owner (`dev-full`: `tsc -b apps/server --watch` y `node --watch` sobre
    `apps/server/dist`) se ejecuta desde el mismo checkout en el que se trabajó.
  - Al compilar los cambios, el servidor se reinició y aplicó la migración 0038 a `data/edr.sqlite` el
    2026-11-13 a las 20:33:51Z.
  - Se comprobó en una copia del WAL, en modo de solo lectura: la base está en la versión 38 y `managed_teams` tiene
    `display_name`.
- **Efecto:** solo se añadió una columna que puede ser nula. Los equipos y el resto de los datos no cambiaron, y todos
  los equipos tienen NULL.
- **Lo que no se hizo:** no se tocó la base ni se revirtió nada. La migración 0038 queda congelada y no debe editarse.
- **Consecuencia:** un servidor compilado desde una rama sin la migración 0038, como `main`, se niega a arrancar con
  esta base (`migration_unknown_applied`). El Product Owner decide cómo proceder.

El entorno de desarrollo en modo watch aplica las migraciones automáticamente. Queda registrado en
`docs/local-setup.md`, sección 3.

## 10. Estado de Git y resultados

El cierre está en un commit de `work/TEAM-DISPLAY-01` sobre `b6579fd`, con solo los cambios de esta iniciativa y de los
ajustes de la sección 12. El hash se registra en un commit de documentación posterior, en la fuente de verdad (fila
TEAM-DISPLAY-01) y en el registro de decisiones. No hay merge, push ni deploy. La migración 0038 y todos los snapshots
históricos se conservan. Los resultados están en la sección 7.

## 11. Ajustes finales antes del cierre (2026-11-13)

El Product Owner aceptó el modelo de dominio, la migración 0038, el contrato aditivo, el snapshot v4 y PD-37. Pidió
revisar dos comportamientos antes del cierre («TEAM-DISPLAY-01 — Ajustes finales antes del cierre»). PD-37 recoge el
ajuste en sus puntos 8 y 9, sin reescribir los anteriores.

### 11.1 Inspección previa

- **Bindings.**
  - Las plantillas visuales leen los nombres de equipo de los campos guardados `team_home`, `team_away` y `fixtures`
    (`SLIDE_FIELD` en `visual-templates/project.ts`), que ya se dibujaban con el nombre de presentación.
  - No dibujan el texto de IA (D9).
- **Origen de los nombres en titulares y descripciones.**
  - Los nombres de equipo nunca salen de texto generado: siempre vienen de los datos guardados.
  - En todas las configuraciones, el titular y la descripción de una diapositiva los genera el adaptador `stub` de
    `providers.ai`, con textos fijos sin nombres de equipo y placeholders `{{t:<teamId>}}`.
  - `substitute` (`content/compose.ts`) rellena cada placeholder con el nombre guardado del equipo, como un segmento
    `fact` con el ID del hecho de su nombre. La asociación con el equipo es inequívoca: hecho → evidencia → ID local.
- **`data_match`.** Exigía que el texto de IA dibujado fuera igual al texto guardado. Hubo que ajustarlo; las reglas del
  contenido no cambian (11.2).
- **Validaciones del texto de IA.** `checkText`, `checkLength`, `checkHashtags` y `capitalized_tokens` se aplican al
  texto guardado, con nombres oficiales, o solo a los segmentos de comentario. No cambian: no fue necesario alterar
  ninguna regla editorial.

### 11.2 Cambios

- **`presentedText`.** Dibuja con el nombre registrado todo segmento `fact` de un hecho de nombre de equipo que tenga
  nombre en el snapshot del proyecto. Eso incluye los placeholders del titular y la descripción, y las celdas de equipo
  de una clasificación si la hubiera. El mapa solo contiene hechos cuya evidencia es una observación de equipo
  (`displayNamesOfSlides`), así que ningún otro valor puede cambiar.
- **`data_match`.**
  - El texto de IA dibujado tiene que ser igual al texto guardado con esos segmentos dibujados con el nombre registrado.
  - Cualquier otra diferencia falla, igual que antes: un nombre que el proyecto no registró, o el oficial cuando hay uno
    registrado.
  - `team_names` sigue exigiendo el nombre oficial en los segmentos guardados del texto de IA.
- **Lo que sigue con el nombre oficial:** el copy editorial externo, la leyenda y los hashtags (`caption.txt`,
  `copy-editorial.txt`), los datos administrativos (equipos, lista de partidos del asistente, títulos de las piezas) y
  las integraciones.

### 11.3 Vistas previas

- **Imágenes de proyectos reales.** Las miniaturas, la diapositiva seleccionada del proyecto, la revisión y la
  exportación muestran el PNG renderizado, así que muestran el nombre del render final.
- **Vistas previas con datos de Competiciones** (editor de plantillas, «Vista previa con datos locales», y vista previa
  de la plantilla en el asistente de contenido):
  - Antes usaban el nombre oficial. Ahora usan el nombre de presentación actual de cada equipo por su ID local, como lo
    dibujaría un proyecto creado en ese momento; los escudos ya se mostraban así.
  - La caché del PNG incluye esos nombres en su clave, para que un cambio de nombre nunca muestre una imagen anterior
    (`catalog.ts`, `service.ts`).
- **Ejemplos sintéticos.** Los valores de prueba de longitud del editor (`STRESS_VALUES`) solo sirven para validar que
  el texto cabe y no se muestran como nombres. El lienzo muestra las etiquetas de los datos (`{Equipo local}`) y los
  fixtures de las pruebas web son sintéticos. No se cambiaron.
- No se rediseñó el editor ni se añadieron pantallas.

### 11.4 Pruebas del ajuste

- **`presented-text.test.ts`:** los placeholders del titular toman el nombre; el texto fijo no cambia, aunque contenga
  un nombre, porque la sustitución va por hecho y nunca compara texto; las filas solo cambian en sus hechos de equipo.
- **`visual-qa/core.test.ts`:**
  - El fixture dibuja como el render real.
  - Una prueba nueva: `data_match` acepta el titular dibujado con el nombre registrado y falla si está dibujado con el
    oficial o con otro nombre.
- **`team-display-names.test.ts`:**
  - El texto de IA dibujado es exactamente el guardado con los placeholders de equipo cambiados, y contiene los nombres
    de presentación.
  - Una exportación ya escrita es idéntica byte a byte después de cambiar y quitar nombres.
  - El snapshot de un proyecto existente no se reescribe.
  - Un proyecto con snapshot v3 dibuja también su texto de IA con nombres oficiales y pasa `data_match`.
  - Se mantienen las comprobaciones del copy editorial y de las exportaciones con nombres oficiales.
- **`visual-templates.test.ts` y `visual-templates.int.test.ts`:** la vista previa con datos reales muestra el nombre de
  presentación, genera una imagen nueva al cambiarlo, y el equipo conserva su nombre oficial.

## 12. Ajustes de la revisión pedidos durante la validación (2026-11-16)

Durante la validación funcional, el Product Owner pidió cuatro ajustes de «Revisar contenido». Se hicieron en esta rama,
sin cambiar el contrato ni las reglas de aprobación (PD-33, UX-REVIEW-01 D-6 y D-14).

- **12.1 «Aprobar todas (N)» en dorado.**
  - Cuando hay diapositivas listas, el botón de aprobación masiva usa la variante principal (dorada) del sistema de
    diseño; «Ver motivos» sigue en secundaria (`review/CarouselReview.tsx`).
  - «Aprobar carrusel completo» sigue habilitándose cuando todas las diapositivas están aprobadas (PD-33, punto 1).
- **12.2 Aprobación masiva del copy editorial.**
  - El panel «Copy editorial» tiene un bloque «Aprobación masiva», como el de las diapositivas, con el botón dorado
    «Aprobar todos los copys (N)».
  - Pide confirmación con la lista de textos y aprueba la versión actual de cada copy listo. Usa la operación existente
    `approveEditorialDeliverable`, una por entregable, y el servidor comprueba cada una.
  - Los copys con avisos o con cambios sin guardar quedan fuera y se indican. El bloque desaparece cuando todos están
    aprobados.
- **12.3 La marca `@ElDeporteReyGT` al final de una frase.**
  - La regla `FORBIDDEN_CONTENT` de menciones (`content/checks.ts`) incluía en la mención el punto que cierra la frase
    («@ElDeporteReyGT.»), que entonces no coincidía con la marca configurada y bloqueaba la aprobación del copy.
  - Ocurrió en el copy de YouTube de dos proyectos de la base local.
  - Ahora se ignoran los puntos finales de una mención. La marca se acepta en cualquier posición y con cualquier uso de
    mayúsculas; cualquier otra mención sigue marcándose.
  - Las versiones ya guardadas conservan su aviso; no se tocó la base local.
- **12.4 Descarga del copy aparte de las diapositivas.**
  - Cada entregable tiene un bloque «Descargas», visible, con «Descargar este copy (.txt)» (solo ese texto, en un
    archivo con su nombre) y «Descargar todos los copys (.txt)».
  - La descarga del carrusel (ZIP con las diapositivas y el copy aprobado) no cambia.
- **12.5 Pruebas.**
  - `ReviewPage.test.tsx`: estilo de «Aprobar todas» y de «Ver motivos».
  - `EditorialCopy.test.tsx`: la aprobación masiva con confirmación, que no aprueba nada antes de confirmar y deja fuera
    los copys con avisos; las dos descargas y el nombre del archivo de un copy.
  - `checks.test.ts`: la marca al final de una frase, con puntos suspensivos o seguida de coma, y otra mención con
    punto final.
