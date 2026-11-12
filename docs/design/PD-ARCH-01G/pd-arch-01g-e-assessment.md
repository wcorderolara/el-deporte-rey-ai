# PD-ARCH-01G-E — Assessment: escudos pendientes de PD-28 (plantillas del motor y calendarios de jornada)

Hecho el 2026-11-11 sobre `work/PD-ARCH-01G-E`, creada desde el cierre de 01G-D
(`3538af1deb3140e6c601c85793ec787528f6ac50`), antes de implementar. No se implementó nada de 01G-E.

**Decisiones del 2026-11-12:** el Product Owner aprobó DE-E1 a DE-E7 tal como se recomiendan en la sección 4, con dos
precisiones: DE-E5 fija seis partidos por diapositiva como criterio inicial de E.2, y DE-E6 define el contenido de cada
fila. Registro: PD-32 en la fuente de verdad. Los cambios de la sección 9 se aplicaron. E.1 está implementado y
aceptado (ver el [informe de E.1](./pd-arch-01g-e1-implementation-report.md)), y E.2 está implementado y pendiente de
aceptación (ver el [informe de E.2](./pd-arch-01g-e2-implementation-report.md)). Este assessment no se reescribe.

## 1. Discrepancia previa

El encargo pide crear y evaluar 01G-E. Las fuentes vigentes dicen que esa fase ya no existe:

| Fuente | Qué dice de 01G-E |
| --- | --- |
| Roadmap (`docs/design/PD-ARCH-01/implementation-roadmap.md`) | No trata el bloque 01G. |
| Plan de 01G (informe de 01G-A, puntos de integración) | Cuatro fases: A (marca), B (propuestas con IA), C (plantillas estructuradas) y D (wizard y motor). No hay 01G-E. |
| PD-28, punto 5 (fuente de verdad, 2026-11-06) | Crea 01G-E, después de 01G-C y antes de 01G-D: escudos en las plantillas visuales (previa, partido programado, resultado y calendario de jornada) y en los espacios de escudo de las plantillas del motor. |
| Enmienda de PD-28 y decisión 01G-D-1 (2026-11-09) | El punto 5 se implementa dentro de 01G-D. «No hay fase 01G-E». |
| Implementación cerrada de 01G-D (`a6b90cf`) | Escudos en las plantillas visuales de previa, partido programado y resultado. No hay escudos por partido en los calendarios ni en los espacios de las plantillas del motor. |
| Encargo del Product Owner (2026-11-11) | Crear `work/PD-ARCH-01G-E` y entregar su assessment. |

De ahí salen tres discrepancias:

1. **La fase no existe en la fuente de verdad.** Reabrir 01G-E es una decisión del Product Owner (DE-E1). Enmienda otra
   vez el punto 5 de PD-28 y deja sin efecto el «no hay fase 01G-E» de 01G-D-1.
2. **La fuente de verdad dice más de lo que se implementó.** La enmienda de PD-28 dice que el punto 5 se implementó en
   01G-D, y BR-06 cita 01G-D. En el código faltan dos partes del punto 5:
   - los espacios `team-badge-home` y `team-badge-away` de las plantillas del motor siguen reservados y vacíos
     (`rendering/render-model.ts`, `empty: z.literal(true)`; `rendering/renderer.ts` no dibuja nada en ellos);
   - los calendarios de jornada no tienen escudos por partido (`round.fixtures` es un bloque de texto). Esta parte sí
     estaba documentada como limitación de 01G-D. La de las plantillas del motor no lo estaba y se registró al cierre.
3. **R-231 sigue vigente sin nota.** El requisito de WI-1 «empty badge slots» sigue sin marca de superado para las
   plantillas del motor, aunque PD-28 enmienda BR-06.

No se corrigió la fuente de verdad. La sección 9 propone los cambios, que dependen de las decisiones de la sección 4.

## 2. Objetivo original de 01G-E

Es el punto 5 de PD-28: escudos de equipo subidos a mano en las plantillas visuales de previa, partido programado,
resultado y calendario de jornada, y en los espacios de escudo reservados de las plantillas del motor.

Los puntos 1 a 4 de PD-28 siguen vigentes y fijan los límites:

- solo escudos subidos a mano, PNG o JPEG, con fuente y declaración de autorización;
- nunca desde un proveedor ni una URL, y sin SVG;
- se dibujan desde el archivo original, solo escalados de forma proporcional;
- un equipo sin escudo deja su espacio vacío, con un aviso visible, sin sustituirlo.

## 3. Lo que ya se implementó en 01G-D

| Parte | Estado | Evidencia |
| --- | --- | --- |
| Subida manual, validación, almacén confinado, historial y contrato `ManagedTeam.badge` | Hecho | Migración 0030, `competitions/badges/*`, informe de 01G-D, secciones 3 y 4 |
| Escudos en Competiciones (equipos, participantes, partidos y resultados) | Hecho | Informe de 01G-D, sección 1 |
| Capa `team_badge` en plantillas visuales de previa, partido programado y resultado | Hecho | `visual-templates/project.ts`, contrato `team_badge` |
| Snapshot de escudos por proyecto, reproducible | Hecho, **solo en proyectos con plantilla visual** | `content-batches/service.ts`, `#badgeSnapshot`, llamado solo cuando hay plantillas |
| Aviso de escudo ausente | Hecho en plantillas visuales (`VALUE_MISSING`) | Informe de 01G-D, sección 6 |
| Escudos por partido en el calendario de jornada (plantilla visual) | **No** | Informe de 01G-D, sección 11 |
| Espacios de escudo de las plantillas del motor (previa, partido programado y resultado) | **No** | `render-model.ts`, `renderer.ts` |
| Escudos en la plantilla del motor del calendario de jornada | **No** (la plantilla no tiene espacios: `badgeSlots: []`) | `rendering/templates/round-overview.ts` |

Lo que queda es el residuo del objetivo original. Ninguna parte de él está a medias en el código.

## 4. Dependencias y decisiones pendientes

### Dependencias

| ID | Dependencia | Efecto en 01G-E |
| --- | --- | --- |
| DEP-1 | PD-ARCH-01H y UX-REVIEW-01. **Resuelta el 2026-11-11:** el Product Owner las aceptó y tienen commit en `work/PD-ARCH-01G-E`, `3359476d3bddc39dfed413dab1632cc66daf79dd`. | El diff de 01G-E empieza limpio sobre ese commit. |
| DEP-2 | El menú lateral colapsable. **Resuelta el 2026-11-11:** aceptado y en el mismo commit `3359476`, como refinamiento sin fase propia. | Ninguno. |
| DEP-3 | Validación manual: hacen falta escudos subidos en Competiciones para algunos equipos, y otros equipos sin escudo. | Necesario para la validación manual. |
| DEP-4 | El hash del contrato en `.orchestrate/config.json` (`PRJ-CONTRACT-ID`) ya no coincide desde las fases PD-ARCH anteriores. Se actualiza al cierre del bloque. | Ninguno nuevo. E-1 solo cambia una descripción del contrato. E-2 agrega un tipo de capa. |

### Decisiones del Product Owner

| ID | Decisión | Recomendación |
| --- | --- | --- |
| DE-E1 | ¿Se reabre 01G-E? Enmienda otra vez el punto 5 de PD-28 y la nota «no hay fase 01G-E» de 01G-D-1. | Sí, con el residuo del objetivo original (sección 5). |
| DE-E2 | Alcance: **E-1** (escudos en las plantillas del motor de partido), **E-2** (calendario de jornada por filas, con escudos) o los dos. | Los dos, en ese orden y con un punto de control entre ellos. E-1 es pequeño y de riesgo bajo. E-2 es del tamaño de 01G-D. |
| DE-E3 | Proyectos con plantillas del motor creados antes de 01G-E: no tienen snapshot de escudos. ¿Se quedan sin escudos? | Sí. Regenerar una pieza debe seguir dando el mismo PNG. Un snapshot posterior usaría escudos que no existían al generar. |
| DE-E4 | Aviso de escudo ausente en las plantillas del motor (lo exige el punto 4 de PD-28). | Usar el aviso de QA que ya existe, como `VALUE_MISSING`: una advertencia que no bloquea, en la revisión. No agregar banners ni insignias. |
| DE-E5 | Solo E-2: número máximo de partidos por diapositiva de calendario. Una jornada de liga tiene 10 partidos y una de fase de liga puede tener 18. | Fijar un máximo legible con escudo y, por encima, usar el comportamiento actual del texto sin escudos o partir en dos diapositivas. Hay que decidirlo con una prueba visual antes de implementar. |
| DE-E6 | Solo E-2: ¿la plantilla del motor del calendario también pasa a filas con escudos, o solo las plantillas visuales? | Las dos, con una nueva versión de la plantilla del motor. |
| DE-E7 | Crear plantillas visuales desde un fondo de Mi marca, sin propuesta de IA. 01G-D-3 la dejó para después; hoy la creación exige `sourceProposalId`. No es parte del objetivo original de 01G-E. | Fuera de 01G-E, como fase o refinamiento propio. Si el Product Owner la quiere ahora, se evalúa aparte. |

## 5. Alcance funcional propuesto

Recomendación: 01G-E completa el punto 5 de PD-28, en dos incrementos.

**E-1. Escudos en las plantillas del motor de partido**

- En un proyecto nuevo generado con «Plantillas del motor», las diapositivas Previa de partido, Partido programado y
  Resultado de partido dibujan el escudo del local y del visitante en sus espacios reservados. El escudo es el del
  snapshot del proyecto, dibujado desde el archivo original y escalado de forma proporcional.
- Un equipo sin escudo deja su espacio vacío y la revisión muestra la advertencia de QA (DE-E4).
- El paso Revisión del wizard ya muestra los escudos de los partidos. La vista previa del motor los dibuja también.
- Los proyectos anteriores no cambian (DE-E3).
- La portada, el cierre y la exportación no cambian.

**E-2. Calendario de jornada por filas, con escudos**

- Una diapositiva de calendario dibuja una fila por partido: escudo local, nombre local, fecha u hora, nombre
  visitante y escudo visitante.
- Plantillas visuales: una capa nueva, «Lista de partidos». El operador diseña la fila una vez (posiciones, tamaños,
  estilos y espacio entre filas) y el motor la repite por cada partido.
- Plantilla del motor del calendario: nueva versión con filas y escudos (DE-E6).
- Más partidos que el máximo (DE-E5): según la decisión.
- El QA compara cada fila con sus hechos.

**Fuera de alcance**

- Escudos de proveedores, URLs o SVG (PD-28).
- Formatos distintos de 4:5 en proyectos (BR-08, 01G-D-1).
- Clasificación (01G-D-3).
- Crear plantillas desde un fondo de Mi marca (DE-E7).
- Cualquier llamada a OpenAI o a la red.

## 6. Alcance técnico y componentes afectados

### E-1

| Componente | Cambio |
| --- | --- |
| `rendering/render-model.ts` | `BadgeSlotElement` acepta un escudo resuelto (ID y hash del archivo) además de `empty: true`. Los modelos guardados en `element_versions.render_model` siguen leyéndose. |
| `rendering/renderer.ts` | Dibuja el espacio con el archivo del escudo (`contain`), como la capa `team_badge` de las plantillas visuales. Sin escudo, nada. |
| `rendering/templates/match-preview.ts`, `match-result.ts`, `fixture.ts` | Versión nueva de cada plantilla (OD-13). El diseño no cambia, salvo el espacio que ahora se llena. |
| `rendering/stage.ts` | Resuelve los equipos también en las diapositivas del motor (`slideTeams`, por identidad y nunca por nombre). Lee los archivos del snapshot con el hash verificado. |
| `projects/content-batches/service.ts` | Guarda el snapshot de escudos en todo proyecto con diapositivas de partido, no solo con plantilla visual (`assignBadges` ya existe). |
| `visual-qa/core.ts` | Advertencia de escudo ausente en las plantillas del motor. El escudo dibujado debe ser el del snapshot para esa identidad. |
| `rendering/routes.ts` y OpenAPI (`listTemplates`) | Solo la descripción: los espacios dejan de estar «siempre vacíos». La forma no cambia. |
| Web | Vista previa del motor en el wizard; texto de la advertencia en la revisión; descripción de los espacios en «Plantillas del motor». |
| Pruebas | Las de R-231 que exigen espacios vacíos; render y QA; flujo completo con escudo y sin escudo; regeneración de un proyecto anterior idéntica byte a byte. |
| Migración | Ninguna: `projects.badge_snapshot_json` existe desde 0030. |

### E-2

| Componente | Cambio |
| --- | --- |
| `packages/contracts/src/http/visual-templates.ts` y OpenAPI | Tipo de capa nuevo (aditivo) con la fila: subcapas de nombre, escudo y fecha u hora, y el espacio entre filas. Las versiones publicadas siguen siendo válidas. |
| `visual-templates/catalog.ts`, `validation.ts`, `compose.ts`, `project.ts` | Bindings por fila, validación (solo en calendarios, una lista por plantilla, la fila cabe en el lienzo), composición repetida y resolución de equipos por fila. |
| Etapa de contenido | Ninguno previsto: la plantilla del motor ya divide `fixtures` en una línea por partido con sus segmentos de hecho (`round-overview.ts`, `fixtureLinesOf`). Se confirma al implementar. |
| `rendering/templates/round-overview.ts` | Versión nueva con filas y escudos (DE-E6). |
| `content-batches/service.ts` | El snapshot ya incluye todos los partidos de la pieza. |
| `visual-qa/core.ts` | `data_match`, `team_names` y `text_fit` por fila. |
| Web: editor de plantillas (`editor/LayerList`, `LayerProperties`, `EditorCanvas`, `PreviewPanel`) | Crear y editar la fila, con vista previa de la jornada real. |
| Migración | Ninguna prevista: las capas son un documento JSON validado por el servidor (0029), sin CHECK por tipo de capa. |

## 7. Criterios de aceptación

**E-1**

1. Un proyecto nuevo con plantillas del motor y equipos con escudo dibuja los dos escudos en Previa de partido,
   Partido programado y Resultado de partido, desde el archivo original y escalados de forma proporcional.
2. Un equipo sin escudo deja su espacio vacío, sin sustituto, y la revisión muestra una advertencia de QA que no
   bloquea la aprobación.
3. Sustituir o retirar un escudo después de generar no cambia el proyecto. Regenerar una pieza da el mismo PNG.
4. Un proyecto generado antes de 01G-E, al regenerarse, da el mismo PNG que antes (sin escudos).
5. El escudo se resuelve por la identidad local del equipo. Dos equipos con nombres parecidos nunca intercambian
   escudo (prueba con nombres casi iguales).
6. Las plantillas visuales, la portada, el cierre, la exportación y el flujo de aprobación no cambian.
7. Ninguna petición de red ni a OpenAI. Las verificaciones finales quedan en verde, salvo los fallos preexistentes
   documentados.

**E-2**

1. Una plantilla visual de calendario con «Lista de partidos» dibuja una fila por partido de la jornada, con los dos
   escudos, los dos nombres oficiales y la fecha u hora.
2. Los valores de cada fila salen de los hechos de la pieza y el QA los compara fila por fila. Un nombre que no cabe
   se informa y nunca se corta.
3. Con más partidos que el máximo, el resultado es el que decida DE-E5, y se prueba.
4. La plantilla del motor del calendario dibuja filas con escudos (DE-E6). Los proyectos anteriores se regeneran
   iguales.
5. Las versiones de plantilla publicadas antes de E-2 siguen abriendo, validando y dibujando igual.
6. Los criterios 2, 3, 5 y 7 de E-1 también valen para el calendario.

## 8. Riesgos

### Compatibilidad

| Riesgo | Mitigación |
| --- | --- |
| Regenerar un proyecto anterior cambia su PNG | Sin snapshot no hay escudo (DE-E3). Prueba byte a byte. |
| Versión nueva de las plantillas del motor | Mismo diseño, solo el espacio lleno. Los proyectos guardan la versión por diapositiva (OD-66). |
| Modelos de render guardados con `empty: true` | El esquema nuevo los sigue aceptando. Prueba de lectura de un modelo antiguo. |
| Pruebas y requisito R-231 que exigen espacios vacíos | Se cambian junto con la nota de la sección 9, no antes. |
| Reglas de QA de las plantillas del motor (01G-D, D9, no las cambió) | Solo se agrega una advertencia que no bloquea. Los borradores existentes no ganan errores. |
| E-2: tipo de capa nuevo en el contrato | Cambio aditivo (PD-11). El único cliente es la interfaz incluida. |
| E-2: legibilidad con muchas filas | DE-E5 se decide con una prueba visual antes de implementar. |
| Solape con 01H y UX-REVIEW-01 | Resuelto: ya tienen commit (DEP-1). |

### Seguridad

| Riesgo | Mitigación |
| --- | --- |
| Un escudo en el equipo equivocado (integridad) | Resolución por la cadena hecho → evidencia → equipo local, nunca por nombre. QA y prueba con nombres casi iguales. |
| Archivos de escudo como entrada | Sin entrada nueva: los escudos ya pasaron firma, cabecera, decodificación con resvg, tamaño (5 MiB, 4096 px) y hash. Se leen con el hash verificado. |
| Memoria y tiempo de render con muchos escudos (E-2) | Tope de filas (DE-E5). Los archivos ya tienen tope de tamaño. Medir el tiempo de una jornada de 18 partidos. |
| Red o proveedores | Ninguno. SC-05 y PD-28 punto 2 no cambian. No se lee el campo `crest` de football-data.org (SC-07, R-288). |
| Autorización de los escudos | Sigue declarada y no verificada (PD-28 punto 1). La validación es humana. |

## 9. Cambios propuestos a la fuente de verdad (después de DE-E1 y DE-E2)

- **PD-28, punto 5:** una segunda enmienda que diga qué se implementó en 01G-D (plantillas visuales de partido) y qué
  pasa a 01G-E (plantillas del motor y calendarios), según DE-E2.
- **BR-06:** citar 01G-D y 01G-E.
- **R-231:** nota de que PD-28 lo supera para los espacios que llena un escudo autorizado.

Los aplica el arquitecto con la decisión del Product Owner, como en PD-28 a PD-31.

**Aplicados el 2026-11-12** con PD-32: segunda enmienda de PD-28, BR-06 actualizado y la nota sobre R-231 dentro de
PD-32 (R-231 es un requisito de WI-1 y su documento no se edita).
