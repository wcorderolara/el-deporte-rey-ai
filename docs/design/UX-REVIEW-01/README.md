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

## Pendiente del Product Owner

- Pregunta P-1 del informe: si la aprobación final debe exigir el texto del carrusel o el copy editorial. Hoy no los
  exige (PD-ARCH-01E-PD-02, DE-5) y la interfaz conserva esa regla; cambiarla modifica la arquitectura de aprobación y
  necesita autorización.
