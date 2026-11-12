# PD-ARCH-01G — Identidad visual, biblioteca de marca y diseño asistido por IA

## Estado

- **PD-ARCH-01G-A** — identidad visual y biblioteca de recursos de marca. **Aceptada por el Product Owner el
  2026-11-05** y cerrada en `work/PD-ARCH-01G-A` con el commit `395a2735948d6755a4e02e2a411491dbde03293f`.
- **PD-ARCH-01G-B** — propuestas visuales generadas con la API de imágenes de OpenAI. **Aceptada por el Product Owner
  el 2026-11-06** y cerrada en `work/PD-ARCH-01G-B` con el commit `9da113b11f572fcf062d950546a9cf4182a481fe`.
- **PD-ARCH-01G-C** — plantillas visuales estructuradas y reutilizables a partir de propuestas aprobadas. **Aceptada por
  el Product Owner el 2026-11-09** y cerrada en `work/PD-ARCH-01G-C` con el commit
  `cc3559093d80d39fb842c9d755d72c3932d9c89c`.
- **PD-ARCH-01G-D** — integración de plantillas en la generación de contenido y escudos de equipo subidos a mano
  (PD-28; la fase 01G-E prevista se integró aquí por decisión del 2026-11-09). **Aceptada funcionalmente por el Product
  Owner el 2026-11-11** y cerrada en `work/PD-ARCH-01G-D`. La implementación está en el commit
  `a6b90cf560a373eb40151bc4749330a4b1c1238c` (2026-11-10), que incluye también los refinamientos del editor de
  plantillas y los submenús de Mi marca. Commit de cierre (documental): `3538af1deb3140e6c601c85793ec787528f6ac50`.
- **PD-ARCH-01G-E** — escudos pendientes del punto 5 de PD-28 (plantillas del motor y calendarios de jornada). La
  enmienda de PD-28 y 01G-D-1 la habían integrado en 01G-D. El Product Owner pidió su rama y su assessment el
  2026-11-11. `work/PD-ARCH-01G-E` se creó desde `3538af1`. En la misma rama tienen commit 01H, UX-REVIEW-01 y el menú
  lateral colapsable (`3359476`, aceptados el 2026-11-11), y el assessment (`7a4c9f1`). El 2026-11-12 el Product Owner
  aprobó DE-E1 a DE-E7 (PD-32) y dividió la fase en dos incrementos:
  - **E.1** — escudos en las plantillas del motor de partido. **Implementado el 2026-11-12, sin commit, pendiente de
    la aceptación del Product Owner.**
  - **E.2** — calendarios por filas con escudos. Empieza solo después de aceptar E.1.

## Documentos

- [Informe de implementación de 01G-A](./pd-arch-01g-a-implementation-report.md): modelo de recursos, políticas de uso
  para IA, almacenamiento, contratos, migración 0024, interfaz (Mi marca y Plantillas separadas), `BrandContext`,
  pruebas y limitaciones.
- [Informe de implementación de 01G-B](./pd-arch-01g-b-implementation-report.md): investigación de la API de OpenAI,
  modelo, integración, contratos, persistencia, políticas, seguridad, costos, pruebas, limitaciones, configuración de
  la clave y validación manual.
- [Assessment de 01G-C](./pd-arch-01g-c-assessment.md): lo que existe, catálogo de datos deportivos reales, decisiones
  técnicas, riesgos, dependencias de 01G-D y migración.
- [Informe de implementación de 01G-C](./pd-arch-01g-c-implementation-report.md): plantillas, versiones y capas,
  motor de render compartido, contratos, migración 0029, reglas de validación, interfaz, pruebas, limitaciones y
  validación manual.
- [Assessment de 01G-D](./pd-arch-01g-d-assessment.md): respuestas A a G del encargo (modelo de equipos, escudos de
  proveedores, identidad, protección manual, almacenamiento, bindings de imagen, consistencia), decisiones D1 a D12,
  riesgos y migración.
- [Informe de implementación de 01G-D](./pd-arch-01g-d-implementation-report.md): escudos de equipo, integración con
  el wizard y la generación, versionado y reproducibilidad, QA de plantillas, contratos, migración 0030, pruebas,
  limitaciones, validación manual y verificación de cierre.
- [Assessment de 01G-E](./pd-arch-01g-e-assessment.md): discrepancia entre la fuente de verdad, el plan y la
  implementación; objetivo original; lo ya hecho en 01G-D; dependencias y decisiones DE-E1 a DE-E7; alcance funcional y
  técnico (E-1 y E-2); criterios de aceptación; riesgos de compatibilidad y seguridad.
- [Informe de implementación de 01G-E.1](./pd-arch-01g-e1-implementation-report.md): escudos en las plantillas del
  motor, cambios del renderer, reglas de resolución, compatibilidad con proyectos anteriores, advertencia de QA
  `team_badges` y migración 0035, contrato, pruebas, riesgos, validación manual y estado de Git.

## Decisiones del Product Owner

| ID | Decisión | Fecha |
| --- | --- | --- |
| PD-32 (DE-E1 a DE-E7) | Aprobación formal de las decisiones del assessment de 01G-E. DE-E1: 01G-E vuelve a ser una fase independiente (segunda enmienda del punto 5 de PD-28; deja sin efecto el «no hay fase 01G-E» de 01G-D-1, sin borrarlo). DE-E2: E.1 (escudos en las plantillas del motor) y después E.2 (calendarios por filas), que necesita la aceptación de E.1. DE-E3: los proyectos anteriores conservan imágenes, snapshots, hashes y versiones. DE-E4: un escudo ausente deja el espacio vacío y una advertencia de QA que no bloquea, sin banners nuevos. DE-E5 (E.2): seis partidos por diapositiva como criterio inicial, a confirmar con pruebas visuales; si hay más, varias diapositivas. DE-E6 (E.2): filas con escudo y nombre de cada equipo, fecha, hora y estado. DE-E7: las plantillas desde un fondo de Mi marca quedan fuera de 01G-E, como iniciativa independiente. Registrada en `.orchestrate/source-of-truth.md`. | 2026-11-12 |
| 01G-D (cierre) | Aceptación funcional de 01G-D y autorización de su cierre técnico, sujeta a que el commit contenga solo 01G-D y sus refinamientos aprobados, a preservar los cambios ajenos, a que las verificaciones finales sigan siendo válidas y a la consistencia con la fuente de verdad. Comprobado el 2026-11-11 (informe de 01G-D, secciones 13.4 y 14). | 2026-11-11 |
| 01G-D-1 | Para 01G-D: los escudos se suben solo a mano (PD-28 sin cambios): se descarta cualquier referencia, URL o importación de escudos de proveedores, también como dato. Los escudos se implementan dentro de 01G-D (enmienda del punto 5 de PD-28; no hay fase 01G-E). En los proyectos solo se ofrecen plantillas 4:5 (BR-08 sin cambios). El binding de escudo es `badge`. | 2026-11-09 |
| 01G-D-2 | Corrección: la base real conservaba claves foráneas de un borrador de la migración 0016 que impedían confirmar cualquier importación. Se agrega la migración de reconciliación 0031 (sin editar 0016), probada antes sobre una copia de la base. Ver el informe de 01G-D, sección 13.1. | 2026-11-09 |
| 01G-D-3 | Las plantillas visuales usan los tipos de diapositiva del motor: Portada, Resultado de partido, Calendario de jornada, Partido programado, Previa de partido y Cierre. Clasificación queda fuera. En el asistente se elige una plantilla por tipo de diapositiva (portada, partidos, cierre), y el proyecto fija la versión de cada una. La portada y el cierre no tienen campos obligatorios y pueden tener varias variantes. Migración 0032. Se implementa dentro de 01G-D, antes de crear plantillas desde un fondo de Mi marca. Ver el informe de 01G-D, sección 13.2. | 2026-11-09 |
| 01G-D-4 | Se pueden eliminar las plantillas visuales archivadas, además de las que nunca se publicaron; una plantilla publicada se archiva antes de eliminarla. La eliminación es lógica y los proyectos conservan sus versiones. Cambia la regla de 01G-C. Ver el informe de 01G-D, sección 13.3. | 2026-11-09 |
| 01G-C (cierre) | Aceptación formal de 01G-C y autorización de su cierre. | 2026-11-09 |
| 01G-C-3 | Plantillas pasa a ser un menú padre (`/templates`) con dos sub-opciones y vistas separadas: **Crear plantilla** (`/templates/create`: Plantillas visuales y Propuestas visuales con IA; el editor `/templates/visual/:id` pertenece a esta vista) y **Plantillas del motor** (`/templates/engine`). `/templates` abre «Crear plantilla». El enlace antiguo `/brand#brand-templates-title` lleva a «Plantillas del motor». | 2026-11-09 |
| PD-29 | Enmienda de BR-05, solo de visualización: una capa de texto de una plantilla visual puede dibujarse en mayúsculas («Mostrar en mayúsculas»). Cambian solo las líneas dibujadas; el valor guardado y el nombre oficial del equipo no cambian. El texto se mide como se dibuja. El QA de 01G-D debe comparar con la forma en mayúsculas. Registrada en `.orchestrate/source-of-truth.md`. | 2026-11-09 |
| 01G-C-2 | Paleta cerrada de efectos de texto en las plantillas visuales: Ninguno, Sombra suave, Sombra intensa, Brillo dorado, Brillo morado, Contorno oscuro y Marcador dorado. Los dibuja el motor final con los colores de la paleta, escalados con el tamaño de la letra. No se admite CSS libre. El contorno se hace con sombras, porque el contorno nativo deja marcas con las fuentes de la marca. | 2026-11-09 |
| PD-28 | Opción B de escudos de equipo (enmienda PD-03 y BR-06): el operador sube a mano el escudo de cada equipo (PNG o JPEG), con su fuente y la declaración de que está autorizado. La autorización y el resultado se validan a mano. Nunca se descargan del proveedor ni de una URL, ni se aceptan SVG. Se dibujan desde el archivo original, solo escalados de forma proporcional. Un equipo sin escudo deja su espacio vacío y se avisa. Se implementa en 01G-D (enmienda del 2026-11-09). Registrada en `.orchestrate/source-of-truth.md`. | 2026-11-06 |
| 01G-C-1 | El tipo de contenido de una plantilla visual se elige al crearla (Previa individual, Próximos partidos, Resultados o Calendario); por defecto es el de la propuesta, porque la propuesta solo aporta el fondo. Así una propuesta generada como previa puede ser la base de una plantilla de resultados con marcador, sin una nueva generación con IA. El tipo no se cambia después de crear la plantilla. | 2026-11-06 |
| 01G-B (cierre) | Aceptación funcional de 01G-B y autorización de su cierre, condicionada a que PD-27 esté registrada con los límites aprobados y a que las verificaciones finales sigan siendo válidas (ambas comprobadas). | 2026-11-06 |
| PD-27 | Excepción a PD-22 y SC-03 para la API de imágenes de OpenAI, solo en 01G-B y sus validaciones manuales, con sus límites, y decisión de aislamiento de SC-05 tras la revisión de seguridad del 2026-11-06. Registrada en `.orchestrate/source-of-truth.md`. | 2026-11-06 |
| 01G-B | El encargo de 01G-B autoriza la API de imágenes de OpenAI (proveedor de IA alojado, con costo) bajo sus controles: clave solo en el servidor, confirmación explícita, límites diarios, mensuales y de concurrencia, sin reintentos, sin llamadas en pruebas. La revisión de seguridad de SC-05 se hizo el 2026-11-06 (PD-27). | 2026-11-05 |
| 01G-A | Paleta y fuentes de solo lectura con notas; un recurso principal por tipo; eliminación lógica con dependencias; PNG/JPEG y WebP solo para referencias; Mi marca (`/brand`) y Plantillas (`/templates`) en páginas separadas, Mi marca primero en el menú. | 2026-11-05 |

## Fuente de verdad

`.orchestrate/source-of-truth.md` registra el estado de WI-1 y no se ha actualizado en las fases PD-ARCH, salvo PD-27
(01G-B), PD-28 (escudos, enmienda de PD-03), PD-29 (mayúsculas de visualización, enmienda de BR-05) y PD-32 (01G-E,
segunda enmienda de PD-28 y BR-06); cada fase registra sus decisiones en su índice y en su informe (como PD-ARCH-01 y
PD-ARCH-01E). Las de 01G quedan aquí.

Discrepancia registrada al cierre de 01G-D (2026-11-11): según la enmienda del punto 5 de PD-28, ese punto se
implementó en 01G-D. Dos partes no se implementaron: los espacios de escudo de las plantillas del motor y los escudos
por partido de los calendarios de jornada (informe de 01G-D, sección 11). La fuente de verdad no se cambió en el cierre:
el texto de PD-28 se corrige con la decisión del Product Owner sobre 01G-E.

**Resuelta el 2026-11-12 con PD-32:** PD-28 tiene una segunda enmienda que deja en 01G-D las plantillas visuales de
partido y pasa a 01G-E las plantillas del motor (E.1) y los calendarios (E.2). BR-06 cita 01G-D, 01G-E.1 y 01G-E.2, y
PD-32 deja constancia de que supera R-231 en los espacios que llena un escudo autorizado. Las enmiendas anteriores se
conservan.
