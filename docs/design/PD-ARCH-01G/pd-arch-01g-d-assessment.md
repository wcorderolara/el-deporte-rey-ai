# PD-ARCH-01G-D — Assessment arquitectónico: plantillas en la generación y escudos de equipo

Hecho el 2026-11-09 sobre `work/PD-ARCH-01G-D`, creada desde el cierre de 01G-C
(`cc3559093d80d39fb842c9d755d72c3932d9c89c`), antes de implementar.

Marco de decisiones vigente:

- **PD-28 (enmendada el 2026-11-09):** escudos solo subidos a mano, PNG o JPEG, con fuente y declaración de
  autorización. Nunca URL, proveedor ni SVG. Se implementan en 01G-D.
- **01G-D-1:** solo plantillas 4:5 en proyectos (BR-08 sin cambios); el binding de escudo se llama `badge`.
- **PD-29:** mayúsculas solo de visualización.

## 1. Preguntas del encargo

**A. ¿El modelo Team tiene un campo de escudo o logo?**

No. `managed_teams` (migración 0004) solo tiene nombre, región y fechas, y es una identidad **global**: se asocia a
competiciones (`competition_teams`) y a temporadas (`season_participants`). El contrato `ManagedTeam` va dentro de
`CompetitionTeam`, `SeasonParticipant` y `CompetitionMatch.homeTeam/awayTeam`. Los espacios `team-badge-home/away`
de las plantillas del motor están reservados y vacíos (R-231).

**B. ¿Los proveedores devuelven URLs de escudos?**

football-data.org sí publica un campo de escudo (`crest`), pero el adaptador lo descarta: la lista permitida de campos
(SC-07) y la regla de neutralidad (R-288) no lo dejan pasar. Por PD-28 seguirá así: no se lee, no se guarda y no se
descarga.

**C. ¿Cómo se identifican los equipos entre importaciones?**

Por el ID local (`managed_teams.id`). Las importaciones confirmadas los asocian con `competition_provider_mappings`.
Al generar contenido, la pieza se congela como importación manual y cada equipo usa **el ID local como `key`**. En la
investigación, cada hecho de nombre de equipo conserva su evidencia (`fact_evidence` → `observations.value.teamKey`).
El `teamId` canónico del hecho es un hash del nombre y no se puede invertir; la evidencia sí lleva al equipo local.

**D. ¿Cómo se protegen las modificaciones manuales?**

Con `sports_field_provenance` (01D-D), por competición, entidad y campo: origen, último valor del proveedor y
`manual_override`. La importación omite los campos protegidos, y la vista previa ofrece conservar o aceptar.

**E. ¿Qué almacenamiento se puede reutilizar?**

El almacén confinado de marca (`BrandFileStore`). Ya se usa con un directorio y un tope por instancia para
`design-proposals/`. Ofrece nombres `<uuid>.<ext>`, permisos 0700 y 0600, apertura exclusiva, contención por
`realpath` y SHA-256. También se reutiliza el validador de imágenes de marca: firma, cabecera, dimensiones y
decodificación con resvg.

**F. ¿Cómo se resuelven los bindings de imágenes?**

Hoy no hay bindings de imagen. En 01G-C, las capas de imagen apuntan a un recurso fijo de Mi marca, con su hash
fijado, y los bindings son solo de texto (`sports_data`). Los valores salen de los datos locales en la vista previa.

**G. ¿Cómo se garantiza la consistencia entre preview y exportación?**

- La vista previa de 01G-C usa `buildStructuredModel` y `renderSlide`.
- En los proyectos, la etapa de render usa las plantillas del motor (`TemplateRegistry`) y guarda, por cada versión
  de elemento, el modelo de render (con IDs y hashes de imágenes) y el PNG.
- La exportación empaqueta esos PNG guardados, sin volver a dibujar.
- Falta que la etapa de render de los proyectos use la misma ruta estructurada.

## 2. Hallazgos que condicionan el diseño

1. **QA visual y plantillas estructuradas.** `data_match` exige hoy dos cosas que no aplican a una plantilla visual:
   - que se dibuje cada segmento de hecho de los campos de la diapositiva; pero una plantilla visual elige qué datos
     muestra;
   - que el título de resultado diga «Resultado final · …»; pero los títulos de una plantilla visual son texto fijo
     del diseño.

   Los valores que sí se dibujan se tienen que seguir comparando con los hechos.
2. **El texto guardado no tiene goles por separado, hora ni estado en los resultados.** El contenido de 01E guarda
   `score` como «2-1», `kickoff` solo con la fecha, y no guarda `match_status` en las diapositivas de resultado.
   El renderizador nunca deriva valores de los hechos (AD-07, OD-49), así que esos valores deben salir de la etapa
   de contenido.
3. **El contexto deportivo** (competición, temporada, fase y jornada) está en el lote de generación del proyecto y no
   en el texto de las diapositivas de partido.
4. **El wizard** es un solo componente con cuatro pasos numerados (`GenerateContentPage.tsx`). Su vista previa muestra
   las plantillas del motor compatibles. La selección (`ContentBatchSelection`) es un objeto estricto.

## 3. Decisiones

| # | Decisión | Motivo |
| --- | --- | --- |
| D1 | **Tabla nueva `team_badges`**, con historial por equipo: archivo, hash, tipo, tamaño, fuente declarada, autorización, estado `active` o `retired` y fechas. Un solo escudo activo por equipo (índice único parcial). Sustituir crea una fila nueva y retira la anterior; retirar no borra nada. `managed_teams` no cambia. | Un proyecto anterior debe seguir apuntando al escudo que usó (reproducibilidad); con columnas en `managed_teams` se perdería el historial. Sin base64 en SQLite. |
| D2 | **Archivos en `<dataDir>/team-badges/`** con `BrandFileStore` (directorio y tope propios) y las validaciones de la subida de marca: PNG o JPEG, firma, cabecera, como máximo 4096 px, 5 MiB, decodificación, hash, una declaración de autorización obligatoria y una fuente (texto). | Reutiliza el almacén y los controles existentes. Los escudos no son recursos de Mi marca (encargo, sección 4). |
| D3 | **Procedencia:** la fila del escudo registra su origen (`manual`), la fuente declarada y quién la confirmó. No se usa `sports_field_provenance`. | Esa tabla es por competición y guarda la base del proveedor; un escudo es global y solo manual (PD-28). Como ninguna importación escribe escudos, uno manual nunca se sobrescribe. Si en el futuro hay escudos de proveedor, se usará ese mecanismo. |
| D4 | **Contrato del equipo:** `ManagedTeam.badge` (`TeamBadge` o nulo, aditivo), visible en equipos, participantes y partidos. Operaciones nuevas: `uploadTeamBadge` (PUT con cuerpo binario, como la subida de marca), `getTeamBadgeFile` y `deleteTeamBadge` (retirar). | Mínimo número de endpoints; sin URLs. |
| D5 | **Capa nueva `team_badge`** en las plantillas visuales, con binding `match.homeTeam.badge` o `match.awayTeam.badge`. Se dibuja siempre proporcional (`contain`). Sin escudo, la capa no se dibuja y queda una advertencia (`VALUE_MISSING`). | El escudo se resuelve por la identidad interna del equipo, nunca por su nombre. La falta de escudo no bloquea (encargo, sección 15). |
| D6 | **Proyecto con plantilla:** columnas aditivas en `projects` (`visual_template_id`, `visual_template_version_id`, `badge_snapshot_json`). El lote recibe `visualTemplateVersionId` (opcional en `ContentBatchSelection`) y lo valida: publicada, no archivada, 4:5 y del tipo de una diapositiva de las piezas elegidas. Cada proyecto guarda la versión exacta y el escudo activo de cada equipo de sus partidos en ese momento. `Project.visualTemplate` (aditivo). | La versión publicada es inmutable, los escudos no se borran y los recursos de marca están fijados por hash en la versión. Un proyecto anterior se vuelve a dibujar igual aunque haya una versión nueva, se sustituya un escudo o cambie Ketsi (que sería otro recurso). Los PNG guardados se conservan como hasta ahora. |
| D7 | **Render de proyectos:** en un proyecto con plantilla, las diapositivas del tipo de la plantilla se dibujan con `buildStructuredModel`; portada y cierre siguen con las plantillas del motor. Los valores salen de: los campos guardados de la diapositiva (con sus segmentos de hecho, para el QA), el contexto del lote (competición, temporada, fase, jornada; texto de plantilla) y los escudos del snapshot (por evidencia → equipo local). La regeneración de un elemento usa la misma ruta. | Una sola ruta de render para la vista previa y la salida final. |
| D8 | **Campos auxiliares de contenido**, solo en proyectos con plantilla: `score_home`, `score_away`, `kickoff_time` y `match_status` (también en resultados), como segmentos de hecho calculados por la etapa de contenido. Son valores aditivos del enum `TextFieldName`. | Los valores independientes del marcador los pide el encargo (sección 17). La etapa de contenido es la que deriva valores de los hechos; el renderizador no. Los proyectos sin plantilla no cambian. |
| D9 | **QA de plantillas estructuradas** (modelos `vt-…`): los valores dibujados se siguen comparando con sus hechos, incluidos los nuevos `score_home`, `score_away` y `kickoff_time`; `text_fit` mide el texto como se dibuja (PD-29). No se exige dibujar todos los segmentos ni el título de resultado. Las plantillas del motor no cambian de reglas. | El QA sigue impidiendo un dato falso, pero no impone un diseño. |
| D10 | **Wizard:** paso nuevo «Plantilla» entre Partidos y Revisión, con las plantillas publicadas, activas, 4:5 y compatibles (Tarjetas: miniatura, nombre, tipo, formato, versión) y la opción «Plantillas del motor» (lo de hoy). La Revisión muestra la plantilla, los escudos de los partidos y la vista previa del motor con el primer partido. | Extiende el wizard sin cambiar el flujo existente. |
| D11 | **Competiciones:** escudo en la tabla y tarjetas de equipos, en la edición del equipo (subir, sustituir, retirar, ver la fuente) y junto a los nombres en partidos y resultados. Sin escudo se muestra un marcador neutro, sin inventar uno. | Encargo, sección 9. |
| D12 | **Sin OpenAI ni red:** subir escudos, generar, dibujar y exportar son operaciones locales. | PD-27 y PD-28. |

## 4. Riesgos

- **QA:** la regla relajada (D9) se aplica solo a los modelos de plantillas visuales y se prueba. Los valores dibujados
  siguen bloqueando si no coinciden con sus hechos.
- **Plantillas de calendario:** `round.fixtures` es un bloque de texto, así que los escudos por partido en un
  calendario requieren un diseño de filas repetidas. Queda fuera de 01G-D; los escudos sí se ven en Competiciones.
- **Autorización de escudos:** no se puede verificar automáticamente. La declaración queda registrada y la validación
  es humana (PD-28).
- **Proyectos existentes:** no tienen plantilla y siguen exactamente igual.

## 5. Migración

Solo una, aditiva: `0030_team_badges_and_project_templates.sql`.

- Tabla `team_badges` con su índice único parcial.
- Tres columnas nuevas en `projects`, nulas.

No modifica ninguna migración anterior.
