# PD-ARCH-01D — Hybrid Data Integration

## Estado

Implementación incremental en curso. PD-ARCH-01D-A fue aprobada funcionalmente por el Product Owner y cerrada técnicamente. La importación/sincronización de datos aún no está implementada; corresponde a los siguientes incrementos de PD-ARCH-01D.

## Propósito

Conectar el dominio de competiciones locales con las fuentes deportivas ya configuradas, permitiendo vinculación e importación selectivas, revisión previa y protección de correcciones manuales.

## Documento

- [Propuesta de arquitectura](./hybrid-data-integration-proposal.md): diagnóstico, contratos, modelo de persistencia, estrategia de sincronización futura, tradeoffs y plan incremental.
- [Registro de decisiones](./architecture-decision-register.md): cardinalidad Provider–Competition, configuración/rate limits compartidos y extensibilidad futura.
- [Informe de PD-ARCH-01D-A](./pd-arch-01d-a-implementation-report.md): alcance implementado, endpoints, persistencia y verificación técnica.

## Límite

PD-ARCH-01D-A implementa solo el catálogo de proveedores y la vinculación explícita Competition–external Competition. No importa temporadas, equipos o partidos, no sincroniza ni sobrescribe datos y no modifica el calendario o resultados de PD-ARCH-01C.
