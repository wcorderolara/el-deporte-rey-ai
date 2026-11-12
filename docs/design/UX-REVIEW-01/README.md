# UX-REVIEW-01 — Rediseño de la experiencia de revisión de contenido

## Estado

- **Aceptado por el Product Owner el 2026-11-11** y con commit en `work/PD-ARCH-01G-E`, junto con PD-ARCH-01H y el
  menú lateral colapsable. Se implementó el 2026-11-10 sobre `work/PD-ARCH-01G-D`, cuyo cierre (`3538af1`) no lo
  incluye. El hash del commit está en el [assessment de 01G-E](../PD-ARCH-01G/pd-arch-01g-e-assessment.md), DEP-1.
- Es un refinamiento de frontend de `/projects/:projectId/review`. Fuera del frontend solo retira la operación
  `setExcludedMatches` del contrato y del servidor (ajuste A-6, decisión PD-31 de la fuente de verdad). No cambia las
  migraciones, los datos guardados ni el modelo de aprobación.

## Documentos

- [Informe de implementación](./ux-review-01-implementation-report.md): problemas de UX, decisiones, flujo anterior
  y nuevo, componentes, arquitectura, funcionalidades preservadas, pruebas, limitaciones, validación manual y estado
  de Git.

## Referencias visuales

Las cuatro imágenes de Google Stitch del Product Owner (fuera del repositorio, en
`~/Downloads/stitch_el_deporte_rey_studio 2/`):

| Imagen | Uso |
| --- | --- |
| `1-revision-design.png` | Referencia principal del modo «Diseño visual». |
| `2-revision-copy.png` | Punto de partida, simplificado, del modo «Copy editorial». |
| `3-listo-aprobacion.png`, `4-aprobado.png` | Solo patrones funcionales: el diálogo de aprobación final y las descargas en la misma vista. No son páginas. |

No se copió ningún dato, persona, API, telemetría ni certificación de las imágenes.

## Pregunta P-1 (resuelta el 2026-11-12)

- P-1 preguntaba si la aprobación final debe exigir el texto del carrusel o el copy editorial. El Product Owner fijó la
  regla el 2026-11-12 (PD-33): la aprobación final exige las diapositivas requeridas aprobadas, el contenido editorial
  publicable correspondiente aprobado, ningún error bloqueante y las validaciones actuales, sin aprobaciones
  duplicadas, con compatibilidad para el modelo legacy de copy y sin invalidar aprobaciones anteriores.
- La inspección de los contratos y del código muestra que el punto del contenido editorial no se cumple hoy. Cumplirlo
  cambia la arquitectura de aprobación, así que se documentó como refinamiento independiente,
  [REVIEW-APPROVAL-01](../REVIEW-APPROVAL-01/README.md), con sus preguntas RA-1 a RA-5. No está implementado; hasta
  entonces la interfaz y el servidor mantienen PD-ARCH-01E-PD-02.
- **Enmienda del mismo día:** el Product Owner decidió que el copy no es obligatorio. Los entregables aprobados se
  exportan en el `.zip` del carrusel. El diálogo de aprobación final solo cambia sus frases sobre el copy editorial.
- **Decisión formal (PD-33, Opción A, aprobaciones independientes):** el diálogo cuenta los textos listos para exportar
  con el estado del servidor y avisa de los aprobados que requieren revisión por cambios en los datos deportivos. La
  pantalla, sus acciones y su diseño no cambian. REVIEW-APPROVAL-01: CLOSED — PRODUCT OWNER ACCEPTED.
