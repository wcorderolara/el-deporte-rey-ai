# PD-ARCH-01D — Hybrid Data Integration

## Estado

PD-ARCH-01D-A fue aprobada funcionalmente y cerrada técnicamente. El Product Owner aprobó PD-ARCH-01D-B tras la revisión funcional y visual del flujo asíncrono, SSE y la jerarquía de acciones; su cierre es el commit `e3c67e4`. PD-ARCH-01D-B implementa lectura, normalización y vista previa inmutable. PD-ARCH-01D-C implementa la aplicación confirmada y transaccional del snapshot, fue **aceptada por el Product Owner el 2026-11-04** y se cerró en `cfc5ee2981d1b787f2e9aa915c1f03e75dc0531c`. PD-ARCH-01D-D implementa provenance por campo, overrides protegidos y trazabilidad deportiva, y fue **aceptada por el Product Owner el 2026-11-05**.

## Propósito

Conectar el dominio de competiciones locales con las fuentes deportivas ya configuradas, permitiendo vinculación e importación selectivas, revisión previa y protección de correcciones manuales.

## Documento

- [Propuesta de arquitectura](./hybrid-data-integration-proposal.md): diagnóstico, contratos, modelo de persistencia, estrategia de sincronización futura, tradeoffs y plan incremental.
- [Registro de decisiones](./architecture-decision-register.md): cardinalidad Provider–Competition, configuración/rate limits compartidos y extensibilidad futura.
- [Informe de PD-ARCH-01D-A](./pd-arch-01d-a-implementation-report.md): alcance implementado, endpoints, persistencia y verificación técnica.
- [Informe de PD-ARCH-01D-B](./pd-arch-01d-b-implementation-report.md): alcance, capacidades del adapter actual, snapshots temporales y limitaciones.
- [Evaluación previa de PD-ARCH-01D-C](./pd-arch-01d-c-architecture-assessment.md): incompatibilidades detectadas antes de escribir y su resolución.
- [Informe de PD-ARCH-01D-C](./pd-arch-01d-c-implementation-report.md): arquitectura ETL, mappings, conflictos, transacción, idempotencia, contratos, migraciones, pruebas y limitaciones.
- [Informe de PD-ARCH-01D-D](./pd-arch-01d-d-implementation-report.md): provenance por campo, precedencia, overrides, trazabilidad, compatibilidad y validación.

## Límite

PD-ARCH-01D-B consulta recursos bajo demanda y los guarda únicamente como snapshots temporales. PD-ARCH-01D-C aplica un snapshot tras confirmación explícita, sin volver a consultar el proveedor. PD-ARCH-01D-D registra procedencia por campo y protege modificaciones manuales en previews e importaciones posteriores. No hay sincronización automática ni recurrente.
