# PD-ARCH-01D-A — Provider Binding Foundation

**Estado:** aprobada funcionalmente por el Product Owner y cerrada técnicamente.

El Product Owner verificó que Premier League y La Liga pueden usar football-data.org de forma independiente, que Liga Nacional de Guatemala conserva el modo Manual, que están disponibles los modos Manual/Provider/Hybrid y que el listado inicia en Tabla con Cards y creación modal como alternativas.

## Alcance implementado

- Se reutiliza `SourceRegistry` y el adapter registrado de football-data.org. Su catálogo público se deriva del registro de adapters; no se creó otra infraestructura de proveedores.
- Los contratos públicos usan el `providerKey` estable (kind del adapter) y una competencia externa normalizada. El `source_id` de configuración solo queda en persistencia del servidor; no se devuelven credenciales, opciones, referencias opacas ni IDs de instancia a la web.
- Una misma configuración de proveedor puede servir a muchas competiciones locales. Cada competición tiene cero o un binding activo; el índice SQLite parcial aplica esa cardinalidad.
- Reemplazo requiere `replaceExisting: true`. Reemplazar y desvincular conservan el historial y los datos deportivos locales.
- El detalle de competición permite elegir Manual, Provider o Hybrid, consultar el catálogo disponible y confirmar la configuración. Manual se representa sin binding activo. Cambiar entre Provider y Hybrid conserva el mismo vínculo y actualiza solo el modo.
- El listado de competiciones inicia en Tabla, ofrece vista Cards, muestra el modo de administración y abre el alta en un modal.
- Las capacidades publicadas describen operaciones del adapter; no garantizan que cada competición externa ofrezca temporadas o fases. Esa disponibilidad se consulta al solicitarla en una iteración futura.

## Contratos HTTP

| Método y ruta | Uso |
| --- | --- |
| `GET /sports/providers` | Catálogo de adapters vinculables, capacidades y disponibilidad (`available`, `not_configured`, `disabled`, `ambiguous`), sin secretos ni configuración |
| `GET /sports/providers/{providerKey}/competitions` | Catálogo externo normalizado mediante el adapter existente |
| `GET /competitions/{competitionId}/provider-binding` | Binding activo o `null` para modo Manual |
| `POST /competitions/{competitionId}/provider-binding` | Crear binding `provider`/`hybrid`; `replaceExisting` debe ser explícito para reemplazar |
| `DELETE /competitions/{competitionId}/provider-binding` | Marcar como desvinculado; conserva datos e historial |

El cambio es aditivo dentro de `/api/v1`. El endpoint identifica cuándo falta configurar o habilitar el proveedor; los fallos del catálogo se sanitizan y credenciales y cuerpos del proveedor no se exponen. Con la configuración predeterminada, que usa datos de demostración y no declara una fuente LIVE, football-data.org aparece como no configurado con instrucciones para el administrador.

## Persistencia

La migración aditiva `0009_provider_competition_bindings.sql` incorpora el historial de bindings con clave de proveedor, referencia interna a configuración, ID/nombre externo, modo, estado y timestamps. Mantiene FK local a `competitions`; no altera IDs ni filas anteriores, no importa temporadas/equipos/partidos y no añade tablas de sincronización.

## Verificación

- La aceptación funcional fue confirmada por el Product Owner.
- `npm run test:unit` — pasó, 120 archivos y 2208 pruebas. Se actualizó una expectativa de calendario para verificar la navegación real al detalle de la jornada creada.
- `npm run test:integration` — pasó, 43 archivos y 538 pruebas. Se actualizó una expectativa de prueba para las migraciones aditivas 0009 y 0010.
- `npm run test:contract` — pasó, 7 archivos y 1363 pruebas.
- `npm run typecheck` — pasó.
- `npm run lint` — pasó.
- `npm run build` — pasó.
- `git diff --check` — se ejecutará tras esta actualización documental.

No se ejecutaron E2E ni automatización del navegador. Los casos de persistencia e integración usan adapters simulados o transporte de replay; no se hizo una llamada real al proveedor.

## Limitaciones pendientes

- Si hay varias instancias configuradas para el mismo adapter, el catálogo se presenta una sola vez y la selección se rechaza como ambigua. La primera iteración no ofrece selección de credenciales/perfil; no duplica configuraciones por competición.
- Para activar el proveedor en local, seleccionar `EDR_CONFIG=config/live.config.json` y configurar la credencial según `docs/local-setup.md`; el servidor no inicia con el proveedor live habilitado si falta su credencial.
- La lista de capacidades es del adapter, no una promesa por competición. No hay sincronización ni importación de entidades deportivas en 01D-A.
- No se ha realizado una solicitud real a football-data.org durante los tests; se ejercita el adapter mediante infraestructura simulada.
