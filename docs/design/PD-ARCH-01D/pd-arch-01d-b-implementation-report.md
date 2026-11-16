# PD-ARCH-01D-B — Read, Normalize & Preview

**Estado:** aceptada por el Product Owner; checkpoint técnico cerrado.
**Base aceptada:** PD-ARCH-01D-A, commit `44e81ce525910e7bebfaa790cfe0c7daed4e3c20`.
**Límite:** consultar, normalizar, comparar y guardar una vista previa temporal; no aplicar datos deportivos.

## Implementación

- Se reutiliza `SourceRegistry` y la interfaz `IngestionSource`; no se creó un registro de proveedores paralelo.
- Las rutas permiten listar temporadas externas de la vinculación activa, consultar capacidades para una temporada, solicitar un preview y recuperar el mismo snapshot por `previewId`.
- El usuario elige explícitamente la temporada externa, el destino local opcional y los recursos. Las coincidencias de temporada por nombre son candidatas; nunca enlazan automáticamente.
- El preview presenta operaciones `new`, `changed`, `unchanged`, `conflict`, `invalid` y `skipped`, comparaciones de campos y advertencias. No hay operación para confirmar/aplicar.
- La migración aditiva `0011_competition_import_previews.sql` persiste JSON normalizado acotado, hash, timestamps, binding, scope y fingerprint. La retención inicial es de 30 minutos; previews expirados se purgan al crear otro preview y responden 410 si se consultan.
- Recuperar un preview usa el snapshot almacenado y no vuelve a consultar el proveedor. Cambios relevantes del dominio local o del binding producen `stale: true`.
- La fingerprint es una señal de obsolescencia para revisión; la comparación atómica y el rechazo final por fingerprint corresponden a PD-ARCH-01D-C.

## Capacidades actuales de football-data.org

El adapter existente puede enumerar temporadas y descubrir etapas/matchdays a partir de su lectura de partidos; puede normalizar equipos y partidos de las selecciones disponibles. Los marcadores llegan únicamente cuando el adapter los considera finalizados, conserva `0-0` y usa `null` cuando no hay resultado. Se normalizan estados conocidos; los estados restantes se muestran como inválidos con advertencia, sin traducirlos por aproximación.

La disponibilidad de participantes se deduce de etapas que esperan tabla, pero la suscripción puede impedir leer standings; el preview informa esa limitación sin fallar silenciosamente. Solo se usan tablas `TOTAL` que el adapter actual valida. Las fases provienen de los valores `stage` de football-data.org; las jornadas son sus valores numéricos `matchday`. El adapter no ofrece una colección separada de rondas con nombres arbitrarios ni jornadas directamente bajo temporada.

El snapshot neutral de ingestión actual no incluye región/ciudad de equipo, campos de provenance por valor ni todos los marcadores de estados no finalizados. Estos campos no se inventan: se excluyen o se registran como limitación. Los snapshots solo contienen lo que entrega el contrato neutral existente; no se guarda respuesta cruda del proveedor ni credenciales.

## Persistencia y seguridad

La migración agrega únicamente `competition_import_previews`; no modifica tablas deportivas. Las pruebas comparan conteos de temporadas, equipos, asociaciones, fases, jornadas, partidos, resultados e historial antes y después de generar previews. El registro del snapshot se limita a la competición y al binding que originaron la consulta. Los errores conocidos se sanitizan a respuestas de problema; no se incluyen respuestas crudas o secretos.

## Endpoints

- `GET /api/v1/competitions/{competitionId}/provider-binding/seasons`
- `GET /api/v1/competitions/{competitionId}/provider-binding/seasons/{externalSeasonId}/capabilities`
- `POST /api/v1/competitions/{competitionId}/import-previews`
- `GET /api/v1/competitions/{competitionId}/import-previews/{previewId}`

El contrato está en `contracts/http-api.openapi.yaml` y en los esquemas Zod de `packages/contracts`. No se implementó endpoint de aplicación.

## Verificación y revisión

Resultados dirigidos: typecheck correcto; lint correcto; build correcto; contrato completo, 1,446 pruebas correctas; integración de preview, migraciones, esquema y vinculación, 38 pruebas correctas; pruebas unitarias de football-data adapter, 31 correctas; pruebas de UI de competiciones, 28 correctas; `git diff --check` correcto. No se ejecutaron E2E ni automatización de navegador, conforme a PD-UI-21.

Para revisión manual, abrir Competiciones y elegir **Importar datos** desde las vinculaciones de Premier League o La Liga. Cada flujo usa su propio binding y temporada externa, aunque comparten la misma configuración/proveedor. En el entorno local con credencial configurada, iniciar con `EDR_CONFIG=config/dev-live.config.json npm run dev` y abrir `http://127.0.0.1:5173`. Seleccionar temporada, destino local opcional y recursos; pulsar **Consultar y preparar vista previa**. Se puede modificar la selección, inspeccionar la vista de tabla o tarjetas y reabrir la misma preview mientras no expire. No hay acción de aplicación en este incremento.

Limitaciones conocidas: el adapter no entrega región de equipo ni nombres de rondas arbitrarias; las jornadas disponibles son sus matchdays numéricos. La disponibilidad de standings depende de la suscripción y se confirma al leer selecciones. La procedencia y baseline importado por campo aún no existen en las entidades locales, por lo que candidatos sin mapping se tratan conservadoramente como conflictos. Los cambios de datos deportivos locales se detectan mediante fingerprint; el fingerprint no incluye una versión de credenciales/configuración técnica del Provider, dato que el registro compartido actual no expone. La validación autoritativa al aplicar corresponde a PD-ARCH-01D-C.

## Refinamiento de presentación y relaciones (revisión pendiente)

- **Verificar cambios locales** vuelve a llamar `GET /competitions/{competitionId}/import-previews/{previewId}`. El servicio carga el snapshot persistido, calcula de nuevo el fingerprint local y compara el binding activo. No consulta football-data.org ni muta Competition, Season, Team, participantes, fases, jornadas, partidos o resultados. `stale` indica cambios locales relevantes o cambio del binding desde la captura. El preview no se modifica; la respuesta de lectura muestra su vigencia actual. La UI ahora confirma si sigue vigente, advierte si está obsoleto y distingue expiración HTTP 410 de errores recuperables de conexión.
- El preview se presenta en resumen, recursos en tabs y detalles progresivos por registro. Las tablas/c tarjetas usan páginas de 25 elementos; los partidos tienen búsqueda y filtros por jornada, estado y operación. El modo inicial sigue siendo tabla. No hay acción de carga en 01D-B.
- Las advertencias raíz se agrupan por mensaje y severidad (`info`, `warning`, `error`, `conflict`), con ocurrencias y hasta 500 referencias externas afectadas. En el snapshot real inspeccionado de Premier League 2026/27, una advertencia repetida 29 veces se presenta como un solo grupo con 29 ocurrencias. Los detalles individuales continúan en cada registro cuando aplican.
- El contrato neutral incorpora `relationships` en cada item para referencias externas tipadas y acotadas. Partido conserva temporada, referencias de equipo local/visitante, fase y jornada externas cuando existen; jornada referencia temporada y fase; resultado referencia su partido; participante referencia temporada y equipo. Un destino local nulo es válido para preparar una temporada nueva. Los nombres no se utilizan como identidad ni se asignan IDs locales en el adapter.
- La verificación de datos reales fue de solo lectura contra el snapshot ya guardado en `data/edr.sqlite`: temporada 1, equipos 20, jornadas 38, partidos 380 y resultados 90 (529 nuevos); sin cambios, conflictos, inválidos ni omitidos. Los resultados sin marcador conservan `null`; un marcador `0-0` sigue siendo un valor explícito. La base deportiva local no se modificó.

### Brechas que debe cerrar PD-ARCH-01D-C

- Persistir mappings de identidad aprobados para proveedor + tipo de entidad + referencia externa y scope; los `relationships` del preview son propuestas y no son mappings definitivos.
- El adaptador actual identifica fases mediante los IDs de `SourceStage`, pero el snapshot de selección contiene el nombre de fase. La propuesta de partido conserva la referencia de fase descubierta en el catálogo y la jornada por clave neutral `stageId:number`; 01D-C debe aplicar estas referencias con validación de pertenencia y crear relaciones en el orden correcto.
- Las relaciones entrantes a equipos deben resolverse o aprobarse antes de crear partidos. Los posibles duplicados por nombre requieren una decisión humana; no hay fusión automática.
- No se dispone de baseline de origen por campo en las entidades deportivas locales. Ante una posible coincidencia, el preview conserva el valor local como protegido y 01D-C deberá exigir resolución explícita y registrar auditoría por campo.
- football-data.org entrega matchdays numéricos agrupados por su representación de etapa. El contrato actual no aporta regiones de equipos ni rondas arbitrarias; no se inventan. La importación futura debe permitir omitir esas relaciones cuando el proveedor no proporcione información suficiente.

## Corrección de la segunda consulta y procesamiento (revisión pendiente)

- Diagnóstico de solo lectura de tres previews persistidos: el más reciente tenía 530 items y fallaba `ImportPreviewResponseSchema` en `preview.items[1].title`. El valor externo de la fase era `REGULAR_SEASON`, mientras `DisplayNameSchema` excluye `_`. Los dos previews anteriores (529 items) sí cumplen el contrato. El servicio persistía antes de validar la respuesta; por eso el fallo aparecía después de una consulta rápida basada en caché.
- El título visible se normaliza sin cambiar `externalId`, `externalScope` ni el campo de nombre entrante. El preview completo se valida antes de persistirlo. El logger registra el nombre del contrato, rutas de campos inválidos y ruta HTTP en el contexto del request, sin registrar el valor externo, payloads ni secretos.
- Para un mismo binding, temporada, destino y conjunto de recursos, se reutiliza una operación activa o un preview vigente con fingerprint local igual. Los previews expirados u obsoletos se renuevan. La recuperación de operaciones interrumpidas por reinicio se describe en la sección siguiente.
- La primera consulta observada por el Product Owner tardó 422212 ms; la segunda falló en 28 ms. La configuración local usa `requestsPerMinute: 10`. No hay trazas históricas suficientes para asignar cada milisegundo a una etapa. Las métricas seguras actuales registran lecturas de selección, espera acumulada al adapter, procesamiento y escritura del snapshot; el adapter puede efectuar varias peticiones por selección y no expone aún un contador de reintentos ni tiempo exacto en el limitador.
- El Product Owner adjuntó `in_progress.png` y `completed.png`. Se adoptó la estructura de panel central, cabecera con contexto y estado, stepper vertical, resumen integrado y acciones en el pie. Los textos ficticios de versión, telemetría, sincronización e «ingesta verificada» quedaron fuera de la aplicación.

Verificación de este refinamiento: 5 pruebas de integración del preview, 7 pruebas de UI y 123 pruebas de contrato correctas; typecheck, ESLint dirigido, build y `git diff --check` correctos. No se ejecutaron pruebas E2E ni consultas reales adicionales al proveedor.

## Procesamiento asíncrono con SSE

La migración aditiva `0012_import_preview_operations.sql` persiste operaciones y un log secuencial de eventos. `POST /competitions/{competitionId}/import-operations` responde `202` con `operationId`, `statusUrl` y `eventsUrl` sin esperar la consulta al proveedor. El trabajo comienza en una microtarea del proceso local y no depende de la conexión HTTP inicial. `GET /import-operations/{operationId}` devuelve el estado persistido; `GET /events` transmite notificaciones SSE con `id` secuencial, permite `Last-Event-ID` y envía keep-alive sin simular progreso. `POST /cancel` registra una solicitud y propaga `AbortSignal`; solo se marca `cancelled` cuando la ejecución se detiene.

Los estados son `queued`, `running`, `completed`, `failed` y `cancelled`; las etapas son `fetching`, `normalizing`, `comparing` y `preparing_preview`. Cada evento se inserta en SQLite en la misma transacción que actualiza el estado, y `completed` se registra solo después de guardar y validar el snapshot. El trabajo usa el servicio de preview existente: no modifica tablas deportivas. La lectura del adapter ya entrega snapshots normalizados, por lo que la etapa de normalización puede completarse inmediatamente después de la consulta externa. En una reutilización de snapshot válido no se emiten eventos de etapas que no se ejecutaron de nuevo.

Al iniciar el backend, las operaciones `queued` o `running` que quedaron de un proceso anterior pasan a `failed` con código `INTERRUPTED`; se pueden iniciar de nuevo de forma explícita. Una operación activa equivalente se reutiliza, y una operación completada se reutiliza si su preview conserva vigencia, binding y fingerprint. Las operaciones se limitan al `competitionId` de la ruta, las conexiones SSE se cierran al terminar y se limitan a cinco por operación. El navegador conserva `operationId` en `sessionStorage`, recupera el estado mediante HTTP al recargar y actualiza las etapas con eventos SSE persistidos. Consulta el estado por HTTP para recuperarse de un corte de SSE o para obtener un error final. La desconexión no cancela el servidor ni inicia otra consulta.

La cancelación depende de que el adapter y su cliente HTTP respeten `AbortSignal`. Si un tramo no puede interrumpirse, la solicitud queda marcada hasta la siguiente comprobación; la UI muestra «Cancelación solicitada» y no afirma que se detuvo antes de confirmar el estado final. El procesamiento sigue siendo local al proceso Node y no proporciona recuperación automática del trabajo tras reinicio. `POST /import-previews` se conserva por compatibilidad con consumidores existentes, pero la pantalla React usa la operación asíncrona. No existe endpoint de aplicación ni importación definitiva en 01D-B.

Verificación del procesamiento asíncrono: typecheck, ESLint dirigido, build y `git diff --check` correctos; 784 pruebas dirigidas correctas en 9 archivos (contratos, protección de solicitudes, migraciones, esquema, persistencia de operaciones/previews y componentes React). La suite emite advertencias de claves React duplicadas en pruebas preexistentes de administración de competiciones; no afectan las pruebas del flujo de previews. No se ejecutaron E2E, pruebas visuales automatizadas ni consultas reales a football-data.org.

## Refinamientos de revisión del Product Owner

- Los cuatro indicadores del progreso tienen tamaño fijo de 44 × 44 px, proporción 1:1 y `shrink-0`. Las acciones del flujo usan las variantes sólidas existentes: dorado para «Ver vista previa», secundaria para regresar, modificar la selección y verificar cambios locales, y peligro para cancelar la consulta. El panel de preview explica que ningún registro deportivo local fue importado y que la confirmación llegará en PD-ARCH-01D-C; no ofrece una acción de importación ficticia.
- La UI toma cada transición de etapa del evento SSE persistido y ya no hace un GET de estado por evento. La suscripción depende del `operationId` activo, de modo que `queued → running` no abre otra conexión. Sigue existiendo lectura HTTP en recarga y recuperación ante desconexión. El backend registra una línea estructurada por transición real con operación, competición, etapa, estados, timestamp, duración disponible y total de registros procesados al completar; no registra respuestas deportivas, credenciales ni un mensaje por partido.
- La clave de reutilización incluye el conjunto ordenado de recursos. Las pruebas distinguen `season + stages` de `season + stages + teams`: generan scopes y previews distintos, y el segundo muestra equipos si el adapter los devuelve. La captura que solo mostraba temporada y fase no permite identificar por sí sola qué `operationId` o `previewId` estaba abierto; para verificar el caso manual se debe abrir el preview correspondiente y comprobar sus recursos seleccionados.
- El código de la pantalla de importación no crea imágenes PNG Base64. La política CSP observada (`default-src 'self'`) procede del servidor que sirve la compilación en el puerto 4300; Vite en 5173 no envía esa cabecera. No hay evidencia suficiente para atribuir el `data:image/png;base64` bloqueado a la aplicación o a una extensión. Se conserva la CSP restrictiva hasta identificar la URL y el iniciador exactos en las herramientas del navegador; no se agrega `img-src data:` por conjetura.
- Para PD-ARCH-01D-C, la futura acción «Confirmar importación» debe añadirse en el espacio de acciones del preview después de una pantalla de resumen y resolución de conflictos, con revalidación del fingerprint y confirmación explícita contra un endpoint nuevo. La presentación actual ya separa resumen, recursos y detalles; no presupone que el preview sea persistencia deportiva.
- Diagnóstico de HMR: `npm run dev` ejecuta el backend en 4300 y Vite en 5173. La respuesta de Vite incluye `/@vite/client` y la transformación de `Layout.tsx` incluye React Refresh; el backend sirve el último `dist` compilado y no actualiza vistas fuente mediante HMR. Al investigar, el `dist` era anterior al cambio local de `Layout.tsx`, lo que explica que una pestaña en 4300 no reflejara ese cambio. Para desarrollar, abrir `http://127.0.0.1:5173`; no se cambió `Layout.tsx` ni se desactivó StrictMode.

Verificación de estos refinamientos: typecheck, ESLint dirigido, formato, build y `git diff --check` correctos; 58 pruebas dirigidas correctas en cuatro archivos (operaciones, componente React, CSP y configuración Vite). No se ejecutaron E2E, pruebas visuales automatizadas ni nuevas consultas reales al proveedor.

### Jerarquía de acciones del preview

La variante `secondary` existente usa una superficie casi idéntica al panel del preview. Se añadió `secondaryFilled`, basada en los tokens de superficie morada y texto claro, y se aplicó solo a las acciones de este flujo: modificar selección, verificar cambios locales, volver a competición, reintentar y paginar. La acción de consulta y «Ver vista previa» conservan `primary`; «Cancelar consulta» conserva `danger`. Los detalles por registro y las referencias de advertencias usan `<details>/<summary>` nativos con fondo sólido e indicador de expansión. La verificación local anuncia su estado de carga y bloquea activaciones duplicadas. Tabs, selector Tabla/Cards y filtros mantienen sus patrones propios. No cambió el procesamiento ni se agregó confirmación de importación. Typecheck, ESLint dirigido, 27 pruebas de componentes/UI, build y `git diff --check` correctos; la revisión visual queda a cargo del Product Owner.

## Aceptación del Product Owner

El Product Owner aprobó explícitamente PD-ARCH-01D-B y autorizó su cierre técnico antes de iniciar PD-ARCH-01D-C. En el cierre se verificaron typecheck, lint dirigido, build y `git diff --check`; 781 pruebas dirigidas pasaron en nueve archivos. Los cambios ajenos de `apps/web/src/ui/Layout.tsx` quedan excluidos del checkpoint.
