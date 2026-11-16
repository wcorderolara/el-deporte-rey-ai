# PD-ARCH-01E — Generación múltiple de contenido deportivo por competición

## Estado

PD-ARCH-01E se divide, por decisión del Product Owner del 2026-11-05, en dos etapas:

- **PD-ARCH-01E-A** — integración con el motor de contenido existente y generación real por lotes de los tipos que el
  motor ya soporta. **Aceptada por el Product Owner el 2026-11-05** y cerrada en `work/PD-ARCH-01E`.
- **PD-ARCH-01E-B** — ampliación versionada del motor para calendario de jornada, próximos partidos y previa individual.
  **Aceptada por el Product Owner el 2026-11-05** y cerrada en `work/PD-ARCH-01E-B`.

## Documentos

- [Evaluación arquitectónica previa](./pd-arch-01e-architecture-assessment.md): capacidades, brechas, discrepancias con
  el roadmap y decisiones del PO (etapas, modo de datos y snapshots congelados).
- [Informe de implementación de 01E-A](./pd-arch-01e-implementation-report.md): arquitectura, contratos, persistencia,
  idempotencia, interfaz, pruebas, limitaciones y revisión manual.
- [Evaluación arquitectónica de 01E-B](./pd-arch-01e-b-architecture-assessment.md): requisitos, contratos, plantillas,
  QA visual y criterios de aceptación de la ampliación.
- [Informe de implementación de 01E-B](./pd-arch-01e-b-implementation-report.md): SlideTypes, contratos, estructuras,
  plantillas, reglas de IA, validaciones, QA visual, compatibilidad, pruebas y limitaciones.
- [Política de publicación del contenido local](./publication-policy-proposal.md): diagnóstico del bloqueo en revisión y
  decisión PD-ARCH-01E-PD-01 (datos locales validados por el operador), implementada y aceptada con 01E-A.
