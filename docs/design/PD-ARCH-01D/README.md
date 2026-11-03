# PD-ARCH-01D — Hybrid Data Integration

## Estado

Propuesta de arquitectura para revisión del Product Owner. No hay proveedor seleccionado, migración creada ni integración implementada.

## Propósito

Conectar el dominio de competiciones locales con las fuentes deportivas ya configuradas, permitiendo vinculación e importación selectivas, revisión previa y protección de correcciones manuales.

## Documento

- [Propuesta de arquitectura](./hybrid-data-integration-proposal.md): diagnóstico, contratos, modelo de persistencia candidato, estrategia de sincronización, tradeoffs, preguntas y plan incremental.
- [Registro de decisiones](./architecture-decision-register.md): cardinalidad Provider–Competition, configuración/rate limits compartidos y extensibilidad futura.

## Límite

La propuesta no modifica PD-ARCH-01C ni inicia trabajo de implementación. Cualquier schema, endpoint o proveedor concreto requiere revisión y aprobación antes de programarse.
