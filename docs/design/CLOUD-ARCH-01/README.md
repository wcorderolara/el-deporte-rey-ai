# CLOUD-ARCH-01 — Assessment de migración a infraestructura cloud

## Estado

- **Estado: CLOSED — PO ACCEPTED / IMPLEMENTATION DEFERRED (2026-11-16).** El Product Owner aprobó el assessment como
  entregable, consideró la migración técnicamente viable y pospuso su implementación como decisión definitiva. La
  decisión está registrada como **PD-38** en `.orchestrate/source-of-truth.md`.
- **Commit de cierre:** en `work/CLOUD-ARCH-01`, sobre `471aeab`. Su hash se registra en el siguiente commit
  documental.
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
