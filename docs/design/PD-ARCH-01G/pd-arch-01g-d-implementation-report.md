# PD-ARCH-01G-D — Informe de implementación: plantillas en la generación de contenido y escudos de equipo

## Estado

Implementada en `work/PD-ARCH-01G-D`, creada desde el cierre de 01G-C (`cc3559093d80d39fb842c9d755d72c3932d9c89c`).
**Aceptada funcionalmente por el Product Owner el 2026-11-11** y cerrada. La implementación está en el commit
`a6b90cf560a373eb40151bc4749330a4b1c1238c`. Las verificaciones de cierre están en la sección 13.4 y el estado Git en la
sección 14. No se hizo merge, push ni deploy.

Nada de 01G-D llama a OpenAI ni a la red: subir escudos, generar, dibujar, revisar y exportar son operaciones locales.
Las pruebas no hicieron ninguna llamada real. La única propuesta de diseño de las pruebas viene del cliente de salida
simulado, y después de ella no hay ninguna solicitud de imagen.

El assessment previo está en [pd-arch-01g-d-assessment.md](./pd-arch-01g-d-assessment.md), con las respuestas A a G
del encargo y las decisiones D1 a D12.

## Decisiones del Product Owner aplicadas (2026-11-09)

- **PD-28 (enmendada):** escudos solo subidos a mano, en PNG o JPEG, con fuente y autorización. Se descarta cualquier
  URL, importación o referencia de escudos de proveedores, también como dato. Se implementan en 01G-D.
- **01G-D-1:** en los proyectos solo se ofrecen plantillas 4:5 (BR-08 sin cambios). El binding de escudo es `badge`.
- **PD-29:** mayúsculas solo de visualización. El QA mide el texto como se dibuja.
- **01G-D-3:** las plantillas visuales usan los tipos de diapositiva del motor y cada proyecto puede usar una
  plantilla por tipo de diapositiva. Detalle en la sección 13.2.

## 1. Resumen funcional

1. **Escudos en Competiciones**
   - En la edición de un equipo se puede subir, ver, sustituir y retirar su escudo. Se indica la fuente y se
     confirma la autorización.
   - Los escudos se ven en las tablas y tarjetas de equipos y participantes, y junto a los nombres en partidos y
     resultados. Sin escudo se muestra un marcador neutro y el nombre.
2. **Escudos en las plantillas**
   - Hay una capa nueva, «Escudo local» o «Escudo visitante». Se resuelve por la identidad interna del equipo y se
     dibuja desde el archivo original, solo escalado de forma proporcional.
   - Sin escudo, la capa no se dibuja y queda una advertencia.
3. **Wizard `/projects/generate`**
   - Hay un paso nuevo, **Plantilla**, entre Partidos y Revisión. Ofrece las plantillas publicadas, activas, 4:5 y
     compatibles con los tipos elegidos, o las plantillas del motor (lo de antes).
   - La Revisión muestra la plantilla, los escudos de los partidos y la vista previa del motor.
4. **Generación**
   - Cada proyecto guarda la versión exacta de la plantilla y el escudo de cada equipo en ese momento.
   - Las diapositivas del tipo de la plantilla se dibujan con ella; portada y cierre siguen con las plantillas del
     motor.
   - El QA visual compara cada valor dibujado con su hecho.
   - Revisión, aprobación, regeneración y descarga no cambian (01F).
5. **Marcador por valores independientes:** goles del local, separador y goles del visitante, cada uno en su capa.
   Los valores salen de la etapa de contenido, como segmentos de hecho.

## 2. Arquitectura

```
Competiciones ─ PUT/GET/DELETE /teams/{id}/badge ─ competitions/badges (team_badges, team-badges/)
Wizard ─ POST /content-batches(/previews) { visualTemplateVersionId } ─ content-batches: validación, versión y snapshot de escudos por proyecto
Workflow: research → verification → content (+ score_home, score_away, kickoff_time, match_status si hay plantilla)
          → rendering: diapositivas del tipo de la plantilla con visual-templates/project.ts + compose.ts → buildStructuredModel → renderSlide
          → visual QA (reglas de plantillas estructuradas, D9) → revisión → exportación (PNG guardados)
```

- **Un solo motor.** La vista previa local (01G-C) y la de los proyectos usan la misma composición (`compose.ts`) y
  el mismo renderizador.
- **Escudo por identidad.** Al dibujar, se recorre la cadena: hecho del nombre del equipo, su evidencia (que apoya o
  consultada), la observación de la fuente local (`teamKey`, que es el ID del equipo local) y el escudo del snapshot
  del proyecto. Nunca se busca por nombre.
- **Sin ciclo de imports.** El render llama a `visual-templates/project.ts`, que importa los módulos del renderizador
  directamente. Los mensajes de validación están en `issues.ts`, sin dependencias.

## 3. Modelo de escudos

Tabla `team_badges` (migración 0030). Columnas:

- `team_id`, que referencia a `managed_teams`;
- `file_path` (`team-badges/<id>.png|jpg`), `sha256`, `mime`, `width`, `height` y `byte_size`;
- `origin` (solo se crea `manual`), `source_note` (la fuente declarada) y `authorization_confirmed = 1`;
- `status` (`active` o `retired`), `created_at` y `retired_at`.

Reglas:

- Un solo escudo activo por equipo (índice único parcial).
- Sustituir crea una fila nueva y retira la anterior; retirar conserva la fila y el archivo.
- No hay base64 en SQLite.

Contrato: `ManagedTeam.badge` (`TeamBadge` o nulo) con `id`, `origin`, `source`, `mime`, `width`, `height`, `sha256` y
`uploadedAt`. Ninguna ruta de archivo se expone.

¿Por qué una tabla y no columnas en `managed_teams`? Un proyecto anterior debe seguir dibujando el escudo que usó
aunque luego se sustituya. ¿Por qué no `sports_field_provenance`? Esa tabla es por competición y guarda la base del
proveedor; el escudo es global y solo manual. Como ninguna importación escribe escudos, uno manual nunca se
sobrescribe (encargo, sección 8).

## 4. Validación de la subida

Es la misma secuencia que la subida de Mi marca:

1. cuerpo no vacío, de 5 MiB como máximo;
2. firma PNG o JPEG (WebP y SVG se rechazan con 415);
3. `Content-Type` igual a la firma;
4. cabecera, con 4096 x 4096 como máximo;
5. decodificación completa con resvg (una imagen invisible se rechaza);
6. hash.

Los archivos van al almacén confinado (`BrandFileStore` con el directorio `team-badges`), se crean con apertura
exclusiva y se leen siempre con el hash verificado. La fuente (`source`) es un Label obligatorio y `authorized` debe ser
`true`. No existe ningún endpoint que acepte URLs.

## 5. Versionado y reproducibilidad

- **Por proyecto:** `visual_template_id`, `visual_template_version_id` (siempre publicada, inmutable) y
  `badge_snapshot_json` (`{ teamId: badgeId | null }`).
- **Una versión nueva de la plantilla** no cambia los proyectos anteriores.
- **Un escudo sustituido:** el proyecto usa el escudo de su snapshot, cuyo archivo se conserva.
- **Ketsi o el logo cambiados:** serían otro recurso. La versión de la plantilla fija los recursos por su hash, y un
  recurso usado por una plantilla no se puede eliminar (01G-C).
- **Competición modificada:** el lote congeló los datos en una importación (01E).
- **Regenerar un elemento** vuelve a dibujarlo con la misma versión y los mismos escudos. La prueba lo comprueba: PNG
  idéntico byte a byte tras publicar otra versión y sustituir un escudo.
- **Los PNG generados** siguen guardados como antes y la exportación los empaqueta sin volver a dibujar.

## 6. Bindings

| Binding | En la vista previa (datos locales) | En un proyecto |
| --- | --- | --- |
| `competition.name`, `season.label`, `stage.name`, `round.name` | Competiciones | contexto del lote (texto de plantilla) |
| `match.homeTeam.name`, `match.awayTeam.name` | Competiciones | `team_home`, `team_away` (hechos) |
| `match.kickoffDate`, `match.kickoffTime` | Competiciones | `kickoff`, `kickoff_time` (hechos) |
| `match.status` | Competiciones | `match_status` (hecho; en resultados, «Finalizado» verificado) |
| `match.score`, `match.homeScore`, `match.awayScore` | Competiciones (solo partido finalizado) | `score`, `score_home`, `score_away` (hechos) |
| `round.fixtures` | Competiciones | `fixtures` (hechos) |
| `match.homeTeam.badge`, `match.awayTeam.badge` | escudo activo del equipo del partido | escudo del snapshot del proyecto |

Un valor obligatorio ausente en un proyecto hace fallar el render de la pieza (`invalid`), así que una pieza nunca
sale sin un dato que la plantilla exige. Un escudo ausente solo deja la capa vacía.

## 7. QA visual de plantillas estructuradas (D9)

Para los modelos `vt-…`:

- `data_match` compara cada valor dibujado con su hecho: marcador, goles de cada equipo, fecha, hora y estado;
- `team_names` compara cada nombre con el nombre oficial;
- `text_fit` vuelve a medir con mayúsculas si la capa las usa (PD-29);
- `dimensions` y `style_consistency` siguen igual.

No se exige dibujar todos los segmentos de hecho, el título de resultado ni el texto de la IA, porque son decisiones
del diseño. Las plantillas del motor conservan todas sus reglas. Los campos auxiliares no se exigen en ellas porque
solo existen en proyectos con plantilla.

## 8. Contratos y migración

- **Operaciones nuevas** (etiqueta `teams`):
  - `uploadTeamBadge`: `PUT /teams/{teamId}/badge`, cuerpo binario PNG o JPEG, query `source` y `authorized`;
  - `getTeamBadgeFile`: `GET /teams/{teamId}/badge`;
  - `deleteTeamBadge`: `DELETE /teams/{teamId}/badge`.
- **Componentes nuevos:** `TeamBadge`, `VisualTemplateBadgeBinding`, `VisualTemplateTeamBadgeLayer` y
  `VisualTemplateUsage`.
- **Campos aditivos:**
  - `ManagedTeam.badge`;
  - `ContentBatchSelection.visualTemplateVersionId` (opcional);
  - `ContentBatchPreview.visualTemplate`;
  - `Project.visualTemplate`;
  - `VisualTemplatePreview.badges`;
  - `TextFieldName`: `score_home`, `score_away` y `kickoff_time`.
- **Capas:** `VisualTemplateLayer` admite `team_badge`.
- **Conteos:** 133 operaciones, 98 rutas, 64 mutadoras y 197 esquemas. Todo es aditivo dentro de v1 (PD-11).
- **El hash de una selección sin plantilla no cambia**, así que los reintentos con claves anteriores siguen siendo
  válidos.
- **Migración `0030_team_badges_and_project_templates.sql`:** solo aditiva. Se probó antes sobre una copia de la base
  de desarrollo (6 proyectos intactos, claves foráneas correctas).

## 9. Interfaz

- **Competiciones:**
  - `TeamBadge`: el escudo en una caja fija, escalado sin deformar y con la transparencia visible. Sin escudo, o si
    la imagen falla, muestra un escudo neutro punteado y nunca uno inventado.
  - El escudo aparece en la tabla y las tarjetas de equipos, en los participantes de la temporada y en las tarjetas
    de partidos y resultados.
  - `TeamBadgeManager`, en la edición del equipo, muestra el escudo actual con su fuente, «Subido a mano», tamaño,
    tipo y fecha.
  - Para subir o sustituir: PNG o JPEG de hasta 5 MiB, con el campo obligatorio «Fuente del escudo», la casilla
    obligatoria de autorización y una vista previa.
  - «Retirar escudo» pide confirmación (botón rojo).
- **Wizard:**
  - Paso 4, **Plantilla**: tarjetas con miniatura, nombre, tipo, formato y versión. Solo plantillas publicadas, 4:5 y
    compatibles. «Plantillas del motor (sin plantilla visual)» es la opción por defecto.
  - `visualTemplateVersionId` se envía solo si se elige una plantilla, y la elección se borra si los tipos elegidos
    dejan de ser compatibles.
  - Paso 5, **Revisión**: la plantilla, la vista previa del motor con sus avisos («Así se verá con el motor final; no
    usa OpenAI»), los escudos de los partidos y «(sin escudo)» como advertencia.
- **Editor de plantillas:**
  - Botones «Escudo local» y «Escudo visitante» en los tipos con partido, con un marcador punteado en el lienzo y la
    propiedad «Escudo».
  - La vista previa indica qué equipos tienen escudo.
- **Proyecto:** «Plantilla visual: <nombre> · versión N».
- **Cliente HTTP:** admite un cuerpo binario con su propio tipo, para la subida del escudo. Los textos de los campos
  `score_home`, `score_away` y `kickoff_time` están en la revisión y el historial.

## 10. Pruebas

| Suite | Archivo | Cobertura |
| --- | --- | --- |
| Integración | `test/integration/delivery/visual-template-projects.test.ts` (3) | Escenarios A, B y C con una sola versión: escudos por identidad (uno semitransparente, uno ausente), nombres largos completos, marcadores 1-2, 0-0 y 12-11 por valores independientes, QA sin fallos bloqueantes, versión registrada en cada proyecto, ninguna solicitud de imagen. Reproducibilidad tras una versión nueva y un escudo sustituido (PNG idéntico). Rechazos (borrador, tipo incompatible, 1:1, inexistente). Proyecto sin plantilla igual que antes. |
| Integración | `modules/competitions/badges/badges.int.test.ts` (3) | Subida PNG y JPEG con fuente; archivo con hash y CSP aislada; sustitución con historial; retiro; rechazos (SVG, WebP, tipo distinto, cabecera rota, dimensiones, sin fuente o autorización, equipo inexistente); escudo en equipos, equipos de competición, participantes y partidos; persistencia tras reinicio. |
| Unitarias | `modules/visual-qa/structured.test.ts` (3) | QA de un modelo de plantilla sin título ni texto de IA; gol distinto del hecho; mayúsculas medidas como se dibujan. |
| Unitarias | `modules/visual-templates/visual-templates.test.ts` (+3) | Escudos solo en tipos con partido; composición proporcional y advertencia sin escudo; valor obligatorio ausente como error. |
| Contrato | `test/contract/*` | Paridad Zod/OpenAPI, conteos, cambios registrados, protección local de la subida binaria (límite de 5 MiB, tipos), escenario servido de las 3 operaciones de escudos y de la capa de escudo en la vista previa. |
| Existentes ajustadas | migraciones, esquema, QA visual | Versión 30, tabla `team_badges`, columnas y claves de `projects`. |

Resultados: ver la sección 13.

## 11. Limitaciones

- **Calendarios:** `round.fixtures` es un bloque de texto, así que no hay escudos por partido dentro de una plantilla de
  calendario. Requiere un diseño de filas repetidas en una fase posterior. Los escudos sí se ven en Competiciones.
- **Plantillas del motor** (registrado al cierre, 2026-11-11): sus espacios `team-badge-home` y `team-badge-away`
  (Previa de partido, Partido programado y Resultado de partido) siguen reservados y vacíos (R-231). El renderizador no
  dibuja nada en ellos (`rendering/render-model.ts`, `empty: true`). Los escudos solo se dibujan con una plantilla
  visual, y el snapshot de escudos solo se guarda en los proyectos con plantilla visual. Esta parte del punto 5 de
  PD-28 no se implementó y pasa, con los calendarios, al assessment de 01G-E.
- **Autorización de los escudos:** la plataforma no la verifica; queda declarada y registrada (PD-28).
- **Escudos de proveedores:** no se usan (PD-28).
- **Formato:** solo plantillas 4:5 en proyectos (01G-D-1).
- **Valores obligatorios:** si falta uno al generar, la pieza falla con `invalid` y su proyecto se puede volver a
  generar desde su página.

## 12. Validación manual

1. **Arranque.** Inicia con `EDR_CONFIG=config/dev-full.config.json npm run dev`, que activa football-data.org y las
   propuestas con OpenAI en el mismo servidor. Con `npm run dev` también funciona todo lo de esta fase, pero sin esos
   dos proveedores. La base ya está en la versión 30: el servidor de desarrollo aplicó 0030 el 2026-11-09 y su
   estructura coincide con el archivo.
2. **Escudos:**
   - En **Competiciones → equipos de una competición → Editar equipo**, sube un PNG transparente: escribe la fuente,
     marca la autorización y pulsa Subir.
   - El escudo aparece en la tabla y en las tarjetas. Prueba sustituirlo por otro y retirarlo (pide confirmación).
   - Un SVG o un archivo de más de 5 MiB se rechazan.
3. **Escudos en partidos.** En la temporada, los participantes y las tarjetas de partidos y resultados muestran el
   escudo; un equipo sin escudo muestra el escudo neutro y su nombre.
4. **Plantilla con escudos:**
   - En **Plantillas → Crear plantilla**, edita tu plantilla de Resultados y agrega «Escudo local» y «Escudo
     visitante».
   - Para el marcador independiente, agrega dos datos deportivos («Goles local» y «Goles visitante») y un texto «-».
   - Previsualiza con un partido finalizado, guarda y publica.
5. **Generación:**
   - En **Crear contenido**, elige competición, temporada y jornada, el tipo «Resultado de partido» (o «Resultados
     de la jornada») y los partidos.
   - En **Plantilla**, elige tu plantilla publicada.
   - En **Revisión**, comprueba la vista previa, la plantilla y los escudos. Confirma.
6. **Proyecto:**
   - El proyecto muestra «Plantilla visual: … · versión 1».
   - La diapositiva del partido usa tu diseño, con los escudos, los nombres completos y el marcador.
   - La portada y el cierre siguen con las plantillas del motor.
   - Revisa, aprueba y descarga como siempre.
7. **Reproducibilidad:**
   - Crea y publica una versión 2 de la plantilla, o sustituye un escudo.
   - El proyecto anterior no cambia; regenerar su diapositiva produce la misma imagen.
8. **Sin plantilla.** Genera otro lote con «Plantillas del motor»: se ve como antes.
9. **Costo:** en «Propuestas visuales con IA», el uso del día no cambió.

**Configuración de desarrollo completa.** Para la prueba completa pedida por el Product Owner se agregó
`config/dev-full.config.json`: es `config/dev-live.config.json` (football-data.org) más el mismo bloque
`providers.images` de `config/dev-images.config.json`, sin secretos y sin cambiar las otras configuraciones. Una
prueba de `platform/config/load.test.ts` comprueba que sigue siendo exactamente esa unión, y está documentada en
`docs/local-setup.md`.

## 13. Resultados de verificación

Ejecución final sobre el estado de la rama (2026-11-09):

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto. |
| ESLint (`--max-warnings 0`, todo el repositorio) | Correcto. |
| Prettier | Correcto en los archivos de la fase. `prettier --check .` solo señala los 3 archivos que ya venían así antes de 01G-B (`errors.ts`, `respond.ts`, `import-preview.int.test.ts`); no se tocaron. |
| `vitest --project unit` | 1767 pruebas, todas correctas (antes 1760). |
| `vitest --project unit-web` | 665 pruebas: 663 correctas y las 2 fallas de breadcrumbs (`App.test.tsx`, `ReviewPage.test.tsx`), las mismas que ya fallaban antes de 01G-B. |
| `vitest --project integration` | 672 pruebas, todas correctas (antes 664). |
| `vitest --project contract` | 2312 pruebas, todas correctas (antes 2261). |
| `npm run build` | Correcto. |
| `git diff --check` | Sin observaciones. |
| `scripts/security-checks.mjs secret-scan` y `hygiene` | PASS. Los archivos nuevos sin versionar se revisaron aparte con los mismos patrones de claves: sin hallazgos. |
| E2E y accesibilidad | No se ejecutaron. La suite ya fallaba antes de esta fase porque espera la interfaz anterior a 01E y 01G-A (ver el informe de 01G-C, sección 13). |

Base de datos de desarrollo: el servidor en modo watch aplicó 0030. Antes se probó la migración sobre una copia, y
después se comprobó en solo lectura que la estructura real coincide; los 6 proyectos existentes siguen intactos.

No se probó la interfaz en un navegador: la extensión no estaba conectada. Las pruebas web y las de integración de
punta a punta cubren el flujo.

## 13.1 Corrección durante la validación: la importación de football-data.org fallaba

Durante la validación manual, el Product Owner no pudo confirmar una importación de La Liga 2026/27: fallaba al
guardar en la base de datos («No se pudo completar la importación. No se guardó ningún cambio.»). El fallo es
anterior a 01G-D.

- **Causa:** la base real se migró con un borrador de `0016_sports_field_provenance.sql` que declaraba
  `last_application_id` y `application_id` como claves foráneas hacia `competition_import_applications`.
  - El archivo se cambió después a referencias blandas, porque la transacción inserta la fila de la aplicación al
    final.
  - En la base real, la primera escritura de procedencia hacía fallar la clave foránea.
  - Desde que se aplicó 0016 (2026-11-04) no se había confirmado ninguna importación en esa base.
  - Las pruebas usan bases nuevas, con el archivo final, y no lo detectaban.
- **Diagnóstico:** se reprodujo con un servidor aparte (puerto 4399) sobre una copia de la base, que registraba la
  sentencia SQL que fallaba. Se comparó el esquema real con el de una base nueva.
- **Corrección:** `0031_reconcile_field_provenance_references.sql`, sin editar 0016.
  - Reconstruye las dos tablas de procedencia con la definición declarada, conservando todas las filas y los índices.
  - En una base ya correcta, el resultado es idéntico.
  - Se probó antes sobre una copia de la base real: 3163 filas de procedencia y 7 eventos idénticos,
    `foreign_key_check` e `integrity_check` correctos, y las tablas iguales a las de una base nueva.
  - El servidor de desarrollo la aplica al reiniciarse.
- **Pruebas:** dos pruebas nuevas en `platform/db/migrations.int.test.ts`. La primera crea una base con el borrador
  de 0016, comprueba que falla y que tras 0031 se conservan las filas y la escritura funciona. La segunda comprueba
  que el resultado coincide con una base nueva.
- **Diferencias pendientes, sin efecto práctico:** en la base real, `competition_seasons.normalized_label` y
  `managed_teams.normalized_name/normalized_region` conservan un límite de 160 caracteres que los archivos de 0004 y
  0005 ya no tienen.
  - Solo es más estricta.
  - Reconstruir esas tablas exige desactivar las claves foráneas, por las muchas tablas que dependen de ellas, así
    que no se tocaron.
- **Vista previa:** el resumen superior de la vista previa de importación («Nuevos», «Conflictos») compara solo por
  nombre y no consulta los vínculos existentes. El plan real es correcto: en el caso observado, 0 creados, 32
  actualizados y 505 sin cambios. Queda propuesto como mejora aparte; no se cambió en 01G-D.
- **Página de importación en blanco:** el error es anterior a 01G-D.
  - La página guarda la última consulta en la pestaña.
  - Cuando el servidor borra la vista previa expirada, esa consulta queda «completada» y sin vista previa.
  - Al volver, la página la restauraba sin temporadas ni vista previa, y se quedaba vacía.
  - `ImportPreviewPage` ahora olvida esa consulta y vuelve a la selección. Hace lo mismo si la vista previa guardada
    ya no existe o expiró.
  - Dos pruebas nuevas en `ImportPreviewPage.test.tsx`.
- **Escudo sustituido que seguía mostrando el anterior (01G-D):** la imagen se pedía siempre en
  `/teams/{teamId}/badge`.
  - El navegador reutiliza una imagen ya decodificada en la página para la misma dirección, aunque el servidor
    responda `no-store`.
  - Al sustituir un JPEG con fondo blanco por un PNG transparente, se seguía viendo el JPEG. El archivo guardado era
    correcto.
  - `teamBadgeUrl` ahora añade el ID del escudo (`?v=<badgeId>`, que el servidor ignora), así que cada escudo tiene
    su propia dirección.
  - Las pruebas de `TeamBadge` comprueban que la dirección cambia al sustituir el escudo.
- **«Resultado de la generación» con fondo blanco:** la página `/projects/batches/{batchId}` no estaba en la lista de
  rutas con el estilo oscuro del estudio, y caía en el panel antiguo, blanco.
  - El patrón solo cubría un segmento después de `/projects/`.
  - La lista pasa a `contentVariantOf` en `AppShell.tsx`, con la ruta del lote incluida, y tiene su propia prueba en
    `App.test.tsx`.
  - Se comprobó con una captura sobre el servidor local.
  - Siguen con el panel antiguo las rutas de hechos (`/projects/{id}/runs/{runId}/facts`) e `/imports`.

## 13.2 Plantillas por tipo de diapositiva (decisión 01G-D-3)

El Product Owner pidió que «Crear plantilla» ofrezca las mismas opciones que las plantillas del motor, antes de
habilitar la creación desde un fondo de Mi marca. Decidió:

- usar los 6 tipos del motor que generan los proyectos, sin Clasificación;
- elegir una plantilla por tipo de diapositiva en el asistente;
- hacerlo dentro de 01G-D.

**Tipos.** `VisualTemplateContentType` reúne `cover`, `match_result`, `round_overview`, `fixture`, `match_preview` y
`closing`.

- Los nombres de la interfaz son los de las plantillas del motor.
- Las propuestas de IA conservan sus 4 tipos (`DesignContentType`), que son un subconjunto: una propuesta sigue
  pudiendo ser el fondo de una plantilla de otro tipo (01G-C-1), ahora también de portada o cierre.
- Clasificación queda fuera: ningún tipo de contenido la genera con los datos locales.

**Datos de cada tipo.** La portada y el cierre usan los datos de contexto que ya existían (competición, temporada, fase
y jornada); no hace falta ningún dato nuevo.

- **Portada y cierre sin campos obligatorios** (precisión del Product Owner, 2026-11-09): una variante puede ser solo un
  fondo, un texto fijo o la marca. Una plantilla sin capas recibe solo el aviso `NO_LAYERS`.
  - La portada empieza con la competición y la jornada como valores opcionales. Si falta uno, se deja fuera y se avisa,
    nunca se inventa.
  - El cierre empieza con un texto fijo, «Texto de cierre», que el operador reemplaza.
- **Variantes:** no hay límite de plantillas por tipo, así que puede haber varias portadas y varios cierres, incluso
  sobre el mismo fondo. En cada generación se elige la variante.
- **Escudos y valores de partido:** siguen limitados a los tipos de partido (`BINDING_NOT_ALLOWED` en una portada).
- **Vista previa:** la de una portada o un cierre solo necesita la competición y la temporada; la jornada es opcional.

**Proyectos.**

- El lote recibe `visualTemplateVersionIds`, como máximo una versión por tipo de diapositiva. El servidor rechaza dos
  plantillas del mismo tipo con 409 `TEMPLATE_SOURCE_REFUSED`, igual que las demás incompatibilidades.
- La vista previa del lote y el proyecto devuelven `visualTemplates` (lista), en el orden portada, partidos, cierre.
- Cada proyecto fija la versión exacta de cada tipo en la tabla `project_visual_templates`.
- La etapa de renderizado dibuja cada diapositiva con el plan de su tipo y el resto con el motor. Los campos de plantilla
  (`score_home`, `score_away`, `kickoff_time`) solo se añaden cuando una plantilla dibuja las diapositivas de partido.
- Como `visualTemplateVersionId` y `visualTemplate` no llegaron a publicarse (01G-D sigue sin commit), se sustituyen
  sin compatibilidad hacia atrás. Una selección sin plantillas conserva su huella.

**Migración `0032_engine_slide_type_templates.sql`.**

- **`visual_templates`:** se amplía el CHECK de `content_type`. SQLite no permite cambiar un CHECK, así que se
  reconstruye la tabla con las claves foráneas diferidas.
  - Las filas se guardan aparte, la tabla se borra y se vuelve a crear con su nombre, y las filas se reinsertan.
  - No basta con renombrar una tabla nueva, como hace 0008: las violaciones diferidas del borrado no se compensan, y la
    migración falla. Así se comprobó sobre la copia.
- **`project_visual_templates`:** tabla nueva (proyecto, tipo de diapositiva, plantilla y versión).
  - Recibe la plantilla de los proyectos existentes, según su tipo de contenido.
  - Deja vacías `projects.visual_template_id` y `projects.visual_template_version_id`, que SQLite no permite borrar
    por ser claves foráneas.
  - `projects.badge_snapshot_json` se queda en `projects`: los escudos son un registro para todo el proyecto.
- **Prueba sobre una copia de la base real:**
  - Las 4 plantillas, las 5 versiones y los proyectos quedaron idénticos.
  - El proyecto que usaba plantilla quedó fijado como `match_result`.
  - Sin violaciones de claves foráneas e `integrity_check` correcto.
  - La estructura es igual a la de una base nueva, salvo el límite de 160 caracteres ya documentado.
  - El servidor de desarrollo la aplica al reiniciarse.

**Pruebas nuevas.**

- **Migraciones:** 0032 conserva las filas, traslada la plantilla del proyecto, acepta portada y cierre, rechaza
  `standings` y mantiene la inmutabilidad y las claves foráneas.
- **Servicio de plantillas:**
  - creación de portada y cierre con sus capas iniciales opcionales;
  - publicación de una portada solo con texto o sin capas;
  - dos variantes de portada;
  - `standings` rechazado;
  - vista previa sin jornada.
- **Flujo completo:** un carrusel de resultados con plantilla de portada, de partido y de cierre. Cada diapositiva queda
  con su plantilla, el QA no muestra fallos y no hay ninguna petición de imágenes.
- **Lote:** se rechazan dos plantillas del mismo tipo.

## 13.3 Fondo cambiado que no se veía y eliminación de plantillas archivadas (decisión 01G-D-4)

**El fondo no cambiaba en el editor.** El error es de 01G-C.

- El fondo guardado se pedía en `/visual-templates/{id}/versions/{versión}/background`. Al cambiarlo, la versión es la
  misma y la dirección no cambia.
- El navegador reutiliza la imagen ya decodificada para la misma dirección, así que se seguía viendo el fondo
  anterior. Es el mismo caso que los escudos, en la sección 13.1.
- El servidor sí guardaba el fondo nuevo.
- `backgroundUrl` lleva ahora una clave `?v=`, que el servidor ignora:
  - en el editor, el SHA-256 del fondo guardado;
  - en la lista, `updatedAt` de la plantilla, que se actualiza con cada guardado.

**Eliminar plantillas archivadas** (decisión del Product Owner, 2026-11-09). Cambia la regla de 01G-C, que solo
permitía eliminar las plantillas que nunca se publicaron.

- Ahora se pueden eliminar las plantillas archivadas y las que nunca se publicaron.
- Una plantilla publicada y activa se rechaza con 409 `TEMPLATE_IN_USE`, «archívala antes de eliminarla».
- La eliminación sigue siendo lógica (`deleted_at`, OD-08): las filas y las versiones publicadas se conservan, y los
  proyectos que usaron una versión la siguen dibujando. La prueba de reproducibilidad lo comprueba: elimina la
  plantilla archivada antes de regenerar y la imagen es la misma.
- En «Plantillas», eliminar aparece en las plantillas archivadas.

**Acciones de la lista** (pedido del Product Owner). Cada plantilla muestra:

- un icono para abrirla: lápiz «Editar» si tiene un borrador, ojo «Ver» si no;
- un menú «⋮» con las demás acciones de su estado: Previsualizar, Publicar, Crear nueva versión, Archivar o Restaurar,
  y Eliminar (en rojo) cuando se puede.

El menú es una primitiva nueva, `ActionMenu`, con el patrón WAI-ARIA de botón de menú:

- al abrirse, el foco va a la primera acción;
- las flechas, Inicio y Fin mueven el foco;
- Escape cierra y devuelve el foco al botón;
- Tab, un clic fuera, un desplazamiento o un cambio de tamaño lo cierran;
- se dibuja en un portal con posición fija, así que la tabla no lo recorta, y se abre hacia arriba si no cabe abajo.

**Estilo de las opciones** (corrección pedida por el Product Owner tras verlo).

- Sin Preflight, los botones conservaban el borde y el fondo nativos del navegador. Ahora se limpian.
- Las opciones siguen el estilo de la navegación lateral:
  - en reposo, transparentes;
  - al pasar el ratón, `surface-card`;
  - con el foco, el borde dorado a la izquierda sobre `surface-overlay`, como la página actual;
  - Eliminar, en rojo sobre `danger-surface`.
- El anillo azul global se quita solo en las opciones, porque el borde dorado ya marca el foco.
- **Error corregido:** el foco inicial se daba antes de colocar el menú, cuando aún estaba oculto, y no se aplicaba;
  las flechas desplazaban la página y el menú se cerraba. Ahora el foco se da cuando el menú ya está colocado.
- Se comprobó con capturas de la aplicación compilada sobre una copia de los datos, en el puerto 4399.

**Pruebas.** Servicio, que permite eliminar una plantilla archivada y conserva sus versiones; flujo de proyecto;
direcciones del fondo en la web; botón de eliminar en una plantilla archivada.

## 13.4 Verificación de cierre (2026-11-11)

Se repitió sobre una copia limpia del commit de implementación (`a6b90cf`), en un worktree aparte con `npm ci`. Así no
entran los cambios sin commit de otras fases que tiene el árbol de trabajo.

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Correcto. |
| `npm run typecheck` | Correcto. |
| ESLint (`--max-warnings 0`) | Correcto. |
| Prettier (`--check .`) | Solo los 3 archivos que ya venían así antes de 01G-B (`errors.ts`, `respond.ts`, `import-preview.int.test.ts`). |
| `vitest --project unit` | 1767 pruebas, todas correctas. |
| `vitest --project unit-web` | 680 pruebas: 678 correctas y las mismas 2 fallas de breadcrumbs anteriores a 01G-B (`App.test.tsx`, `ReviewPage.test.tsx`). |
| `vitest --project integration` | 676 pruebas, todas correctas. |
| `vitest --project contract` | 2314 pruebas, todas correctas. |
| `npm run build` | Correcto. |
| `npm audit --audit-level=high` | Correcto. |
| `scripts/security-checks.mjs secret-scan` y `hygiene` | PASS. |
| `git diff --check cc35590 a6b90cf` | Sin observaciones. |
| E2E y accesibilidad | No se ejecutaron, por la misma razón de la sección 13. |

Las cifras son mayores que las de la sección 13 por las pruebas de 13.1 a 13.3, del refinamiento del editor y de los
submenús de Mi marca. No apareció ninguna falla nueva.

## 14. Estado Git

- Rama `work/PD-ARCH-01G-D`, creada desde `cc3559093d80d39fb842c9d755d72c3932d9c89c` (cierre de 01G-C).
- **Implementación:** commit `a6b90cf560a373eb40151bc4749330a4b1c1238c` («adding changes», 2026-11-10). Su árbol es
  igual al de `b5bfb99`: la instantánea del trabajo de 01G-D (`4e1831b`) más los submenús de Mi marca. Contiene 01G-D
  con sus correcciones y decisiones 01G-D-2 a 01G-D-4 (secciones 13.1 a 13.3) y los dos refinamientos que siguen.
- **Cierre:** un commit solo de documentación sobre `a6b90cf`, con este informe y el índice de la fase. Su hash se
  registra en el índice al crear `work/PD-ARCH-01G-E`, porque un commit no puede contener su propio hash.
- **Fuera del cierre:** los cambios sin commit de PD-ARCH-01H, de UX-REVIEW-01 y del menú lateral colapsable no
  pertenecen a 01G-D. Siguen sin commit en el árbol de trabajo, pendientes de su propia aceptación.
- Sin merge, push ni deploy.

### Refinamiento UX/UI del editor (2026-11-09)

Incluido en `a6b90cf`: el refinamiento visual del editor de plantillas de 01G-C y las pestañas de «Crear plantilla». Es
un cambio solo de frontend y no altera el alcance de 01G-D. Está documentado en la
[sección 15 del informe de 01G-C](./pd-arch-01g-c-implementation-report.md#15-refinamiento-uxui-del-editor-de-plantillas-2026-11-09).

### Submenús de Mi marca (2026-11-10)

Incluido en `a6b90cf` (`b5bfb99`, pedido del Product Owner). Mi marca pasa a ser un menú padre con dos vistas, como
Plantillas:

- `/brand/resources` (Recursos): la biblioteca, con sus reglas y la acción de subir en la cabecera de la vista;
- `/brand/identity` (Identidad visual): paleta, tipografía y notas.

`/brand` abre Recursos y el ancla antigua de plantillas sigue llevando a `/templates/engine`. Es un cambio solo de
frontend.
