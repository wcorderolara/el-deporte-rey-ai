# CLOUD-ARCH-01 — Assessment de migración a infraestructura cloud

## Estado

- **Estado: CLOSED — PO ACCEPTED / IMPLEMENTATION DEFERRED (2026-11-16).** El Product Owner aprobó el assessment como
  entregable, consideró la migración técnicamente viable y pospuso su implementación como decisión definitiva. La
  decisión está registrada como **PD-38** en `.orchestrate/source-of-truth.md`.
- **Commit de cierre:** `4430e98` (`4430e98295b6c8384e9e6e50d780af6cbafad4d9`), en `work/CLOUD-ARCH-01` sobre `471aeab`.
- **Integración (2026-11-16):** por instrucción del Product Owner, se integró en `main` con el merge `2bfdde2`.
- La versión 1.0 sigue siendo una aplicación personal y local, con SQLite y almacenamiento de archivos local.
- No hay adaptadores PostgreSQL, almacenamiento cloud, servicios contratados ni recursos cloud.
- El análisis se conserva para reconsiderarlo cuando el producto necesite despliegue remoto, múltiples usuarios o mayor
  capacidad operativa.
- La próxima mejora priorizada es un mecanismo local de respaldo y restauración, registrado como **FU-16**. No ha
  empezado y necesita su propia autorización.

## Documentos

- [Assessment de arquitectura cloud](./cloud-architecture-assessment.md): arquitectura actual, inventarios de SQLite y
  de archivos, comparación de proveedores, costos en tres escenarios, estrategia de migración, riesgos, seguridad,
  respaldo y rollback, plan, decisiones y la decisión del Product Owner (sección 15).
