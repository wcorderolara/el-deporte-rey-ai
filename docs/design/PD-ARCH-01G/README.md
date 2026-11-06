# PD-ARCH-01G — Identidad visual, biblioteca de marca y diseño asistido por IA

## Estado

- **PD-ARCH-01G-A** — identidad visual y biblioteca de recursos de marca. **Aceptada por el Product Owner el
  2026-11-05** y cerrada en `work/PD-ARCH-01G-A` con el commit `395a2735948d6755a4e02e2a411491dbde03293f`.
- **PD-ARCH-01G-B** — propuestas visuales generadas con la API de imágenes de OpenAI. **Aceptada por el Product Owner
  el 2026-11-06** y cerrada con un commit en `work/PD-ARCH-01G-B`.
- **PD-ARCH-01G-C** (plantillas estructuradas a partir de propuestas) y **PD-ARCH-01G-D**: no iniciadas.

## Documentos

- [Informe de implementación de 01G-A](./pd-arch-01g-a-implementation-report.md): modelo de recursos, políticas de uso
  para IA, almacenamiento, contratos, migración 0024, interfaz (Mi marca y Plantillas separadas), `BrandContext`,
  pruebas y limitaciones.
- [Informe de implementación de 01G-B](./pd-arch-01g-b-implementation-report.md): investigación de la API de OpenAI,
  modelo, integración, contratos, persistencia, políticas, seguridad, costos, pruebas, limitaciones, configuración de
  la clave y validación manual.

## Decisiones del Product Owner

| ID | Decisión | Fecha |
| --- | --- | --- |
| 01G-B (cierre) | Aceptación funcional de 01G-B y autorización de su cierre, condicionada a que PD-27 esté registrada con los límites aprobados y a que las verificaciones finales sigan siendo válidas (ambas comprobadas). | 2026-11-06 |
| PD-27 | Excepción a PD-22 y SC-03 para la API de imágenes de OpenAI, solo en 01G-B y sus validaciones manuales, con sus límites, y decisión de aislamiento de SC-05 tras la revisión de seguridad del 2026-11-06. Registrada en `.orchestrate/source-of-truth.md`. | 2026-11-06 |
| 01G-B | El encargo de 01G-B autoriza la API de imágenes de OpenAI (proveedor de IA alojado, con costo) bajo sus controles: clave solo en el servidor, confirmación explícita, límites diarios, mensuales y de concurrencia, sin reintentos, sin llamadas en pruebas. La revisión de seguridad de SC-05 se hizo el 2026-11-06 (PD-27). | 2026-11-05 |
| 01G-A | Paleta y fuentes de solo lectura con notas; un recurso principal por tipo; eliminación lógica con dependencias; PNG/JPEG y WebP solo para referencias; Mi marca (`/brand`) y Plantillas (`/templates`) en páginas separadas, Mi marca primero en el menú. | 2026-11-05 |

## Fuente de verdad

`.orchestrate/source-of-truth.md` registra el estado de WI-1 y no se ha actualizado en las fases PD-ARCH, salvo PD-27
(01G-B); cada fase registra sus decisiones en su índice y en su informe (como PD-ARCH-01 y PD-ARCH-01E). Las de 01G
quedan aquí.
