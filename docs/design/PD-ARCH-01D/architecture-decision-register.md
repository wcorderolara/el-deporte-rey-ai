# PD-ARCH-01D — Architecture Decision Register

**Estado:** decisiones arquitectónicas base acordadas. PD-ARCH-01D-A está implementada y pendiente de aceptación del Product Owner.

| ID | Decisión | Estado / consecuencia |
| --- | --- | --- |
| ADR-01D-01 | `Provider` es una configuración/instancia compartida y puede servir a N competiciones locales. | Acordado. No duplicar adapter, credenciales, configuración técnica, límites de consumo ni rate limiter por competición. |
| ADR-01D-02 | Cada `Competition` se vincula de forma independiente con la competición externa elegida mediante `CompetitionProviderBinding`. | Acordado. La identidad externa y estado operativo no se guardan en la configuración global del Provider. |
| ADR-01D-03 | La primera implementación permite como máximo un binding Provider activo por competición. | Acordado. No limitar cuántas competiciones puede usar el mismo Provider. |
| ADR-01D-04 | Identidades externas, selección/ajustes de sync, previews, conflictos, resoluciones e historial pertenecen al contexto de cada competición. | Acordado. Las mappings incluyen contexto de competición/binding, incluso cuando apuntan a un `Team` global reutilizado. |
| ADR-01D-05 | El rate limiting y presupuesto de solicitudes se comparten por Provider entre todas las competiciones vinculadas. | Acordado. La concurrencia agregada debe respetar una política, contador y adapter compartidos. |
| ADR-01D-06 | El modelo admite ampliar la relación a múltiples Providers por competición, pero esa capacidad no se activa en 01D inicial. | Acordado como requisito de extensibilidad. No se establece una política de precedencia todavía. |
| ADR-01D-07 | Datos ausentes, conflictos y decisiones de sync no cruzan automáticamente de una competición a otra. | Acordado. Errores, previews y resultados de sincronización mantienen `competition_id`; fallos/limitación de Provider pueden afectar disponibilidad compartida, pero no combinar cambios locales. |
| ADR-01D-A-01 | El primer binding mantiene `provider_key` estable y una referencia interna `source_id` hacia la instancia configurada del adapter. | Implementado. El backend reutiliza el `SourceRegistry`; la UI y los contratos no reciben `source_id`, opciones ni credenciales. La misma instancia y sus presupuestos existentes sirven a todas las competiciones vinculadas. |
| ADR-01D-A-02 | El binding conserva historial con estados `active`, `replaced` y `unlinked`. | Implementado. Reemplazo requiere `replaceExisting: true`; desvincular marca el registro como `unlinked` y no borra datos deportivos locales. Un índice único parcial restringe cada competición a un solo binding activo. |
| ADR-01D-A-03 | La primera implementación expone la consulta normalizada del catálogo externo, sin guardar datos deportivos importados. | Implementado para football-data.org mediante su adapter registrado. La respuesta pública ofrece `externalCompetitionId`, nombre y área; la referencia opaca del adapter nunca sale del backend. |

## Cardinalidad

```mermaid
erDiagram
  PROVIDER ||--o{ COMPETITION_PROVIDER_BINDING : shared
  PROVIDER ||--o{ SOURCE_CONFIGURATION : configured_as
  SOURCE_CONFIGURATION ||--o{ COMPETITION_PROVIDER_BINDING : reused_by
  COMPETITION ||--o{ COMPETITION_PROVIDER_BINDING : external_identity
  COMPETITION_PROVIDER_BINDING ||--o{ EXTERNAL_IDENTITY_MAPPING : scoped_by
  COMPETITION ||--o{ SYNC_RUN : owns
  SOURCE_CONFIGURATION ||--|| SHARED_RATE_LIMIT : owns
```

Para la primera implementación, de todos los bindings de una `Competition`, cero o uno está activo. Un `Provider` puede tener simultáneamente muchos bindings activos, cada uno a una competición local distinta. Credenciales, opciones técnicas y rate limiter permanecen en la fuente configurada compartida y no se copian en cada binding.

## Extensión futura

Al permitir más de un binding activo por competición se necesitará una decisión explícita de precedencia/resolución. Este registro no propone ganador por proveedor, actualidad, confianza ni orden de configuración. Hasta que esa política se revise, las observaciones divergentes deben preservarse y mostrarse como conflicto, nunca combinarse silenciosamente.
