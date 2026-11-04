# PD-ARCH-01D — Hybrid Data Integration

## Estado

PD-ARCH-01D-A fue aprobada funcionalmente y cerrada técnicamente. El Product Owner aprobó PD-ARCH-01D-B tras la revisión funcional y visual del flujo asíncrono, SSE y la jerarquía de acciones. PD-ARCH-01D-B implementa lectura, normalización y vista previa inmutable. La aplicación definitiva de cambios corresponde a PD-ARCH-01D-C y no formó parte de 01D-B.

## Propósito

Conectar el dominio de competiciones locales con las fuentes deportivas ya configuradas, permitiendo vinculación e importación selectivas, revisión previa y protección de correcciones manuales.

## Documento

- [Propuesta de arquitectura](./hybrid-data-integration-proposal.md): diagnóstico, contratos, modelo de persistencia, estrategia de sincronización futura, tradeoffs y plan incremental.
- [Registro de decisiones](./architecture-decision-register.md): cardinalidad Provider–Competition, configuración/rate limits compartidos y extensibilidad futura.
- [Informe de PD-ARCH-01D-A](./pd-arch-01d-a-implementation-report.md): alcance implementado, endpoints, persistencia y verificación técnica.
- [Informe de PD-ARCH-01D-B](./pd-arch-01d-b-implementation-report.md): alcance, capacidades del adapter actual, snapshots temporales y limitaciones.

## Límite

PD-ARCH-01D-B consulta recursos bajo demanda y los guarda únicamente como snapshots temporales de preview. No crea ni modifica temporadas, equipos, participantes, fases, jornadas, partidos, resultados o su historial. No hay botón ni endpoint para aplicar el preview.
