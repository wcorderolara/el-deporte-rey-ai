# PD-ARCH-01D-C — Importación confirmada y persistencia transaccional

**Estado:** aceptada por el Product Owner el 2026-11-04; pendiente únicamente del commit técnico de cierre al registrar esta decisión. Sin merge, push ni deploy.
**Base aceptada:** PD-ARCH-01D-B, commit de cierre `e3c67e48abb2b19b0f25e65d1630578bd239ecb1` (`feat(competitions): add import preview and async progress`).
**Rama:** `work/PD-ARCH-01D-C`, creada desde ese commit.
**Límite:** aplicar, tras confirmación explícita, el snapshot persistido de 01D-B sobre el modelo deportivo local. Sin sincronización recurrente ni funciones de 01D-D.

## 1. Paso inicial

El commit de cierre de 01D-B (`e3c67e4`) y la rama `work/PD-ARCH-01D-C` ya existían al iniciar esta sesión. Ambas ramas apuntan al mismo commit, y el commit contiene solo archivos de 01D-B. El cambio ajeno de `apps/web/src/ui/Layout.tsx` (breadcrumbs comentados) sigue sin commit y no se modificó.

Una sesión anterior dejó un borrador sin commit: migración `0013`, servicio síncrono `import-apply.ts`, contratos y la evaluación previa. La base de datos de desarrollo (`data/edr.sqlite`) ya había aplicado `0013`. El runner registra migraciones por nombre, sin checksum, así que `0013` se conserva sin cambios. Todo lo demás se completa con migraciones aditivas posteriores (sección 12). El servicio y los contratos del borrador se reemplazaron.

## 2. Modelo deportivo inspeccionado

| Entidad | Tabla | Restricciones relevantes |
| --- | --- | --- |
| Competición | `competitions` | — |
| Temporada | `competition_seasons` | `UNIQUE (competition_id, normalized_label)`; etiqueta `DisplayName` (80) |
| Equipo global | `managed_teams` | `UNIQUE (normalized_name, normalized_region)`; nombre `TeamName` (64); región opcional |
| Equipo de competición | `competition_teams` | PK `(competition_id, team_id)` |
| Participante | `season_participants` | PK `(season_id, team_id)`; trigger: exige `competition_teams` |
| Fase | `competition_stages` | `UNIQUE (season_id, normalized_name)` |
| Jornada | `competition_rounds` | únicos por `(season, stage, name)`; FK compuesta a fase/temporada |
| Partido | `competition_matches` | FK a participantes de la temporada; fase/jornada opcionales y coherentes (trigger); índice anti-duplicado por equipos, fase, jornada y fecha |
| Resultado | `match_results` + `match_result_history` | par de marcadores nulo o completo; historial por cambio |

Las escrituras reutilizan las operaciones de dominio existentes: `CompetitionAdministrationService` (temporada, equipo, asociación, participante) y `CompetitionCalendarService` (fase, jornada, partido, calendario y resultado). Sus transacciones se convierten en savepoints de la transacción externa. No se crearon tablas deportivas paralelas.

**Campos que el proveedor no entrega o que se derivan:**

- región del equipo: queda `NULL`;
- orden de fases: sigue el orden del catálogo del proveedor, después de las fases locales existentes;
- nombres de jornada: `Jornada N` es el título neutral del snapshot de 01D-B; no se crean jornadas ausentes del snapshot;
- fecha del partido: puede ser nula;
- participantes: se inscriben también a partir de los equipos de los partidos importados, porque la tabla del proveedor depende de la suscripción.

No se inventan regiones, identificadores, nombres ni resultados.

## 3. Arquitectura de aplicación (Extract → Transform → Load)

1. **Extract (01D-B):** el snapshot inmutable de `competition_import_previews`. La aplicación **nunca** consulta el proveedor; las pruebas verifican que el contador de lecturas del adapter no cambia.
2. **Transform (`import-transform.ts`):** función pura e independiente del adapter. Recibe solo `ImportPreviewItem[]`, un puerto de lectura `ImportLocalState` y las decisiones explícitas. Produce un plan ordenado de pasos (`season.create`, `team.create`, `competitionTeam.add`, `participant.add`, `stage.create`, `round.create`, `match.create`, `match.update`, `mapping.put`), las líneas de revisión por registro, los bloqueos agregados, los conteos previstos y un `planHash` determinista.
3. **Load (`import-persist.ts`):** ejecuta el plan dentro de la transacción mediante los servicios de dominio y escribe mappings con baseline. `import-local-state.ts` es el adaptador SQLite de lectura.
4. **Servicio (`import-apply.ts`):** plan de solo lectura, operación durable, etapas, SSE, cancelación, recuperación y auditoría.

Orden real de aplicación, adaptado a las restricciones: temporada → equipos y asociación con la competición → participantes (explícitos y de partidos) → fases → jornadas (por número dentro de cada fase) → partidos con estado y marcador → mappings y baseline.

## 4. Identidad y mappings

`external_identity_mappings` (0013, extendida en 0014/0015):

| Columna | Uso |
| --- | --- |
| `provider_key`, `resource`, `scope_key`, `external_id` | identidad externa; `UNIQUE` |
| `local_id` | entidad local existente (sin modelo paralelo) |
| `competition_id`, `binding_id` | competición y vinculación que establecieron la identidad |
| `external_label` | etiqueta opaca del proveedor (por ejemplo `REGULAR_SEASON`) |
| `origin` | `created` (creada por importación) o `linked` (vinculada a un registro existente por decisión explícita) |
| `baseline_json` | último valor importado por campo sincronizado (provenance) |
| `last_application_id`, `created_at`, `updated_at` | historial mínimo |

- **Alcance:** `scope_key = competitionId|externalScope`. Las identidades pertenecen a su competición (ADR-01D-04, ADR-01D-07), también las del catálogo global de equipos. El ámbito externo de temporada separa IDs que solo son únicos por temporada.
- **Unicidad inversa** (`uq_external_identity_local`, 0015): dentro de un ámbito, un registro local tiene como máximo una identidad por recurso del proveedor. Así dos equipos externos nunca se fusionan en uno.
- **Reutilización:** una segunda importación de la misma competición resuelve todo por mapping, sin duplicados.
- **Otra competición:** si el mismo equipo externo ya está mapeado en otra competición, se ofrece como *candidato con evidencia*, nunca como vínculo automático.
- **Sin re-apuntar:** un mapping confirmado no cambia de `local_id`. Si la entidad local desaparece o cambia de contexto, el registro queda bloqueado.
- **Nombres:** nunca determinan identidad. Una coincidencia de nombre solo produce candidatos que requieren `link` u `skip`.

## 5. Reglas de transformación

- **Temporada:** el destino elegido en la vista previa, el mapping existente, un `link` explícito o una temporada nueva. Una etiqueta local ocupada bloquea la creación.
- **Equipos:** se crean solo con un nombre `TeamName` válido y libre. Se asocian a la competición y se inscriben como participantes cuando juegan un partido importado.
- **Fases:** título visible compatible con el contrato local (`REGULAR SEASON`). El identificador y la etiqueta externos (`regular`, `REGULAR_SEASON`) se guardan en el mapping.
- **Jornadas:** relacionadas con su fase y temporada y ordenadas por la numeración del proveedor.
- **Partidos:** requieren ambos equipos, la fase y la jornada resueltos (snapshot o mapping); si no, quedan bloqueados con opción de omitir. La fecha se normaliza a ISO-8601 UTC. Los estados se mapean sin aproximación; uno desconocido omite el partido con advertencia.
- **Resultados:** solo existen cuando el proveedor entrega marcador. `0-0` es un marcador explícito y la ausencia de resultado sigue siendo `NULL/NULL`. Un partido creado recibe estado y marcador en una sola actualización de resultado, con su historial.

## 6. Conflictos y protección de datos manuales

Cada campo sincronizado se compara en tres vías (incoming / local / baseline). Los campos sincronizados en esta fase son fecha y estado del partido, y marcador:

- igual al entrante → sin cambios;
- local igual al último baseline importado → actualización segura;
- distinto y sin baseline coincidente → **valor local protegido**: se conserva y se informa como «conflicto no aplicado».

Un marcador local desconocido (`NULL`) puede completarse; un marcador registrado nunca se reemplaza sin baseline coincidente o decisión explícita. Los nombres de equipos, fases y jornadas existentes no se renombran.

**Decisiones explícitas** (`link`, `skip`, `accept_incoming`), por registro:

- `link` solo hacia candidatos ofrecidos por el backend;
- `skip` omite el registro y todos los que dependen de él;
- `accept_incoming` reemplaza un valor protegido de partido o resultado.

Una decisión no aplicable bloquea el plan. Las decisiones honradas se auditan en `competition_import_decisions`.

## 7. Confirmación desde la interfaz

La vista previa muestra la **Revisión de importación**: totales, bloqueos, advertencias, identidades por confirmar, valores protegidos y dependencias sin resolver, con acción masiva para omitirlas. El plan lo calcula el backend con las decisiones actuales.

**Confirmar importación** es la acción principal: variante `primary`, dorado sólido y texto `text-inverse`, junto a «Modificar selección» y «Verificar cambios locales». Solo está habilitada cuando el backend declara el plan listo. Eso cubre vigencia, vinculación, destino, bloqueos, integridad y que no haya otra aplicación en curso (`APPLY_IN_PROGRESS`). Si no está disponible, muestra el motivo enlazado por `aria-describedby`.

El modal (`Modal` existente, con foco atrapado) resume competición, temporada, proveedor, destino, creaciones, actualizaciones, sin cambios, valores conservados, omitidos, conflictos bloqueantes y advertencias. Incluye el texto acordado y las acciones Cancelar / Confirmar importación. Abrir el modal no persiste nada.

## 8. Transacción y rollback

**Límite transaccional:** una aplicación es un único `BEGIN IMMEDIATE` (`Db.transaction`) por temporada. Dentro de esa transacción el servicio:

1. vuelve a comprobar que no exista otra aplicación del snapshot;
2. revalida existencia, vigencia, huella del snapshot, vinculación activa y fingerprint local;
3. recalcula el plan y exige el `planHash` que el operador confirmó;
4. ejecuta todos los pasos;
5. inserta `competition_import_applications`, la auditoría de decisiones y el estado `completed` de la operación.

Cualquier error deshace la temporada, los equipos, las asociaciones, los partidos, el historial y los mappings. La operación queda `failed` con un código sanitizado y el mensaje «No se guardó ningún cambio». La transacción no admite trabajo asíncrono, así que ninguna E/S puede intercalarse.

## 9. Idempotencia y concurrencia

- **Mismo snapshot:** índice único parcial `uq_import_apply_preview` (una operación viva o completada por snapshot). Un reintento con el mismo plan y las mismas decisiones devuelve la misma operación; con otras decisiones responde 409.
- **Doble clic y reintentos:** devuelven la misma operación. La UI además deshabilita el botón mientras inicia, aunque no depende de ello.
- **Concurrencia por competición:** índice único parcial `uq_import_apply_active_competition` más `BEGIN IMMEDIATE`; otra petición recibe `409 RUN_IN_PROGRESS`.
- **Snapshot ya aplicado:** no se reutiliza como preview nuevo y su plan informa `ALREADY_APPLIED`.
- **Segundo snapshot del mismo destino:** si los datos cambiaron, el fingerprint lo vuelve obsoleto, o el recálculo del plan detecta `IMPORT_PLAN_CHANGED`.

## 10. Operación asíncrona y SSE

Se reutiliza el patrón de 01D-B (tabla de operaciones, tabla de eventos, SSE reanudable con `Last-Event-ID`). El manejador SSE se extrajo a una función compartida por ambos flujos.

**Etapas:** `validating` → `resolving_identities` → `transforming` → `persisting`; **estados:** `queued`, `running`, `completed`, `failed`, `cancelled`.

- **Cancelación:** se acepta hasta antes de `persisting`. Después, `409` («ya está guardando los datos»).
- **Recuperación:** al reiniciar, toda operación viva pasa a `failed / INTERRUPTED`. Como la finalización ocurre dentro de la misma transacción, nunca hay aplicación parcial.
- **Avance:** la UI muestra solo etapas confirmadas por eventos, sin porcentajes, y recupera la operación tras recargar (`sessionStorage` + `GET`).

## 11. Resultado y navegación

Los conteos provienen de las filas realmente escritas en la transacción:

- temporadas, equipos creados y reutilizados, asociaciones, participantes;
- fases, jornadas, partidos creados y actualizados, resultados;
- mappings, sin cambios, omitidos y conflictos no aplicados;
- la lista de registros no aplicados.

El resultado se puede consultar después de que expire el preview.

Navegación: **Ver temporada**, **Ver equipos**, **Volver a competición** y «Preparar otra importación». Las vistas locales no tienen caché cliente y consultan al montarse, así que muestran de inmediato lo persistido. La propia página recarga su lista de temporadas al completar la importación.

## 12. Contratos y migraciones

**Endpoints:**

- `POST /api/v1/competitions/{competitionId}/import-previews/{previewId}/application-plan`: plan de solo lectura con decisiones.
- `POST /api/v1/competitions/{competitionId}/import-previews/{previewId}/applications`: confirma e inicia (`202`); idempotente.
- `GET /api/v1/competitions/{competitionId}/import-applications/{operationId}`: estado y resultado persistido.
- `POST /api/v1/competitions/{competitionId}/import-applications/{operationId}/cancel`
- `GET /api/v1/competitions/{competitionId}/import-applications/{operationId}/events`: SSE.

**Componentes nuevos** (OpenAPI y Zod): `ImportApplyDecision`, `ImportApplyPlanRequest`, `ImportApplyStartRequest`, `ImportApplyCounts`, `ImportApplyPlanItem`, `ImportApplyBlocker`, `ImportApplyPlan`, `ImportApplyPlanResponse`, `ImportApplication`, `ImportApplyOperation`, `ImportApplyOperationResponse`, `ImportApplyOperationStartResponse`. Los esquemas del borrador que nunca se publicaron se eliminaron.

**Migraciones (aditivas; ninguna histórica modificada):**

- `0013_confirmed_competition_imports.sql`: borrador ya aplicado en la base de desarrollo; se conserva intacto (`external_identity_mappings`, `competition_import_applications`).
- `0014_import_application_operations.sql`:
  - columnas de competición, vinculación, etiqueta externa, origen, baseline y última aplicación en los mappings;
  - operaciones y eventos de aplicación con índices únicos parciales;
  - auditoría de decisiones.
- `0015_competition_scoped_identity_uniqueness.sql`: sustituye el índice inverso de 0014 por uno con ámbito de competición. El servidor de desarrollo en ejecución aplicó 0014 durante esta sesión, así que el ajuste va como migración nueva.

Las tablas nuevas no guardan credenciales, cuerpos crudos del proveedor ni secretos. Auditoría: qué snapshot (`preview_id`, `snapshot_hash`) se aplicó, cuándo, con qué vinculación, sobre qué destino y con qué decisiones.

## 13. Seguridad y observabilidad

- Entrada estricta: objetos cerrados, listas acotadas (2000 decisiones), hash de 64 hexadecimales y UUID en todas las rutas. Se mantienen la cabecera de cliente y las protecciones de origen/host existentes.
- Logs por transición:
  - siempre: `operationId`, `previewId`, `competitionId`, etapa, estado y duración;
  - al completar: `applicationId`, `destinationSeasonId` y conteos;
  - al fallar: `errorCode`.
- No se registran snapshots, nombres ni tokens; la prueba de logs lo verifica. Los mensajes al usuario están en español, sanitizados y sin detalles internos.

## 14. Cambios sobre código de 01D-B

- `import-preview.ts`: un preview ya aplicado no se reutiliza para una nueva solicitud. Sin esto, un snapshot ya aplicado se reutilizaba porque la huella de un preview sin destino no incluye partidos.
- `index.ts`: SSE compartido (comportamiento idéntico) y formato Prettier del archivo, que ya estaba fuera de formato en `HEAD`.

## 15. Evidencia de pruebas

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | correcto |
| ESLint dirigido (competiciones, visual-qa, contratos, plataforma, pruebas de contrato, web de competiciones) | correcto, 0 avisos |
| Unitarias (`unit` + `unit-web`) | 2,235 correctas; 2 fallos ajenos (ver abajo) |
| Integración y persistencia (`integration`, completo) | 560/560 correctas |
| Contrato (`contract`, completo) | 1,619/1,619 correctas |
| `npm run build` | correcto |
| `git diff --check` | correcto |
| E2E / navegador | no ejecutados, por instrucción |

**Cobertura específica de 01D-C:**

- **Integración** (`import-apply.int.test.ts`, 11 pruebas):
  - importación completa de temporada, equipos, participantes, fases, jornadas, partidos y resultados, con relaciones;
  - `0-0` frente a desconocido;
  - sin lecturas del proveedor;
  - idempotencia: doble envío, reintento y segundo snapshot sin duplicados;
  - baseline y protección manual, con aceptación auditada;
  - identidad ambigua, vínculo explícito y omisión con dependientes;
  - identidades por competición;
  - snapshot expirado, obsoleto, re-vinculado y con hash no confirmado;
  - dependencias ausentes;
  - rollback total con reintento;
  - concurrencia por competición;
  - cancelación antes de persistir y rechazo durante el guardado;
  - recuperación tras reinicio;
  - SSE reanudable y logs seguros.
- **Dominio** (`import-transform.test.ts`, 10 pruebas):
  - orden de dependencias y numeración;
  - `0-0`, fechas y marcadores inválidos;
  - mappings existentes y referencias fuera del snapshot;
  - candidatos por nombre, decisión inválida y evidencia de otra competición;
  - unicidad inversa;
  - regla de tres vías y aceptación;
  - completar desconocido frente a proteger registrado;
  - inválidos, fuente incompleta y obsolescencia;
  - hash determinista.
- **UI** (`ImportPreviewPage.test.tsx`, 6 pruebas nuevas o actualizadas):
  - botón dorado principal, deshabilitado con motivo accesible y habilitado tras una decisión;
  - modal sin persistencia y cancelación;
  - inicio único;
  - etapas confirmadas por SSE sin porcentajes;
  - resultado con conteos y enlaces;
  - fallo sin afirmar persistencia;
  - recuperación tras recarga.
- **Esquema y migraciones:** columnas, claves foráneas, índices y versiones 13–15. Además, se verificó la migración 15 sobre una copia de la base de desarrollo.

**Fallos preexistentes detectados y corregidos** (introducidos por 01D-B y ajenos a 01D-C; se corrigieron por estar en archivos tocados por esta fase):

- el patrón `^/api/v1/competitions/` faltaba en `ContractPatterns`;
- una muestra de respuesta de preview no tenía `relationships`;
- `problem.test.ts` esperaba 38 códigos en vez de 39;
- `visual-qa/stage.int.test.ts` listaba migraciones solo hasta la 10.

**Fallos preexistentes no corregidos:** `App.test.tsx` y `ReviewPage.test.tsx` (breadcrumbs). Los causa el cambio ajeno sin commit de `Layout.tsx`, que esta fase no modifica.

## 16. Limitaciones conocidas

- Se sincronizan fecha, estado y marcador de partidos existentes. Los cambios de fase/jornada de un partido ya importado y los renombres de equipos, fases o jornadas se conservan locales y no se proponen.
- Los registros locales creados antes de 01D-C no tienen baseline. Al vincularlos, cualquier diferencia queda protegida hasta aceptar el valor entrante.
- Vincular los equipos de una segunda competición exige una decisión por equipo; no hay vínculo masivo (experiencia de operador de 01D-D).
- Un snapshot con selecciones omitidas o recortado por el presupuesto de 120 selecciones se bloquea. No hay importación parcial aceptada por el usuario.
- El fingerprint de un preview sin destino no cubre partidos; el recálculo del plan dentro de la transacción compensa esa brecha.
- El preview y su plan siguen mostrando las operaciones de 01D-B en las pestañas de registros. La revisión de importación es la vista autoritativa.
- No se validó en esta sesión con un token real de football-data.org: toda la evidencia usa el adapter stub. La validación funcional con la fuente real queda para la aceptación del Product Owner.

## 17. Criterios de aceptación

| Criterio | Estado técnico |
| --- | --- |
| Generar un preview desde football-data.org | flujo de 01D-B sin cambios; pendiente de validación del PO con la fuente real |
| Revisar registros y conflictos | implementado (pestañas de 01D-B y revisión de importación) |
| Confirmar explícitamente | implementado (botón principal y modal) |
| Transformación al dominio local | implementado y probado |
| Mappings persistidos | implementado y probado |
| Crear o reutilizar entidades correctas | implementado y probado |
| Sin duplicados por reintentos | implementado y probado |
| Operaciones transaccionales | implementado y probado (rollback total) |
| Datos manuales protegidos | implementado y probado |
| Resultado con cambios realmente persistidos | implementado y probado |
| Vistas locales con datos importados | implementado; vistas sin caché |
| Proceso observable y recuperable | implementado y probado |
| Pruebas dirigidas | correctas, salvo los 2 fallos ajenos documentados |

**Aceptación del Product Owner:** confirmada el 2026-11-04. La implementación, las importaciones incrementales y la persistencia transaccional quedan aprobadas como checkpoint para iniciar PD-ARCH-01D-D.
