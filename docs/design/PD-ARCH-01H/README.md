# PD-ARCH-01H — Generación editorial inteligente con investigación verificable

## Estado

- **Assessment** hecho el 2026-11-10. El Product Owner respondió a DE-1 a DE-5 ese mismo día.
- **Aceptada por el Product Owner el 2026-11-11** y con commit en `work/PD-ARCH-01G-E`, junto con UX-REVIEW-01 y el
  menú lateral colapsable. Se implementó sobre `work/PD-ARCH-01G-D`, cuyo cierre (`3538af1`) no la incluye. El hash
  del commit está en el [assessment de 01G-E](../PD-ARCH-01G/pd-arch-01g-e-assessment.md), DEP-1.

## Documentos

- [Assessment de 01H](./pd-arch-01h-assessment.md): respuestas A a J del encargo, causa del copy genérico,
  restricciones vigentes, arquitectura propuesta, alternativas de investigación A a C y decisiones DE-1 a DE-5.
- [Informe de implementación de 01H](./pd-arch-01h-implementation-report.md): diagnóstico, proveedor, prompt
  maestro versionado, arquitectura, contratos, validación factual, costos, revisión de seguridad, migraciones 0033 y
  0034, interfaz, pruebas, limitaciones, validación manual y archivos.

## Decisiones del Product Owner

| ID | Decisión | Fecha |
| --- | --- | --- |
| 01H (aceptación) | Aceptación de 01H y autorización de su commit, junto con UX-REVIEW-01 y el menú lateral colapsable: «acepta y haz commit de todo lo que hicimos». | 2026-11-11 |
| DE-1 / DE-4 → PD-30 | Modelo de texto de OpenAI alojado, solo para el copy editorial, con límites: USD 5 al mes, 30 generaciones al día, confirmación en cada generación, una a la vez, sin reintentos y plazo de 60 s. Registrada como PD-30 en `.orchestrate/source-of-truth.md`. | 2026-11-10 |
| DE-2 | Alternativa C: solo datos deportivos locales. El puerto de investigación queda preparado, sin simulación. | 2026-11-10 |
| DE-3 | Se mantiene PD-04: el copy no nombra personas. | 2026-11-10 |
| DE-5 | Cada entregable se aprueba y se regenera por separado. | 2026-11-10 |
