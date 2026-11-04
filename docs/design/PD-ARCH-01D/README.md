# PD-ARCH-01D — Hybrid Data Integration

## Estado

PD-ARCH-01D-A fue aprobada funcionalmente y cerrada técnicamente. El Product Owner aprobó PD-ARCH-01D-B tras la revisión funcional y visual del flujo asíncrono, SSE y la jerarquía de acciones; su cierre es el commit `e3c67e4`. PD-ARCH-01D-B implementa lectura, normalización y vista previa inmutable. PD-ARCH-01D-C implementa la aplicación confirmada y transaccional del snapshot sobre el modelo deportivo local y fue **aceptada por el Product Owner el 2026-11-04** como checkpoint para PD-ARCH-01D-D.

## Propósito

Conectar el dominio de competiciones locales con las fuentes deportivas ya configuradas, permitiendo vinculación e importación selectivas, revisión previa y protección de correcciones manuales.

## Documento

- [Propuesta de arquitectura](./hybrid-data-integration-proposal.md): diagnóstico, contratos, modelo de persistencia, estrategia de sincronización futura, tradeoffs y plan incremental.
- [Registro de decisiones](./architecture-decision-register.md): cardinalidad Provider–Competition, configuración/rate limits compartidos y extensibilidad futura.
- [Informe de PD-ARCH-01D-A](./pd-arch-01d-a-implementation-report.md): alcance implementado, endpoints, persistencia y verificación técnica.
- [Informe de PD-ARCH-01D-B](./pd-arch-01d-b-implementation-report.md): alcance, capacidades del adapter actual, snapshots temporales y limitaciones.
- [Evaluación previa de PD-ARCH-01D-C](./pd-arch-01d-c-architecture-assessment.md): incompatibilidades detectadas antes de escribir y su resolución.
- [Informe de PD-ARCH-01D-C](./pd-arch-01d-c-implementation-report.md): arquitectura ETL, mappings, conflictos, transacción, idempotencia, contratos, migraciones, pruebas y limitaciones.

## Límite

PD-ARCH-01D-B consulta recursos bajo demanda y los guarda únicamente como snapshots temporales de preview. PD-ARCH-01D-C aplica un snapshot solo tras una confirmación explícita, sin volver a consultar el proveedor, en una transacción por temporada, y protege los valores locales modificados manualmente. No hay sincronización automática ni recurrente; la experiencia de operador, el historial de sincronización y la resiliencia compartida corresponden a PD-ARCH-01D-D.
