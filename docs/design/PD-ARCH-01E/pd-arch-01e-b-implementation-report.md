# PD-ARCH-01E — Informe de implementación (etapa 01E-B)

## Estado

**Aceptada por el Product Owner el 2026-11-05** y cerrada en `work/PD-ARCH-01E-B` (base `11c173d`). No se hizo
merge, push ni deploy. No se modificó el ETL, no se agregó sincronización automática y la generación no
consulta proveedores externos: todo sale de los datos locales congelados por el lote (01E-A).

## Resumen

El motor de contenido existente se amplía, sin un motor paralelo, con tres tipos de pieza sobre partidos que aún no se
han jugado:

| Tipo de pieza (`ContentPieceKind`) | Estructura del carrusel | Partidos que admite |
| --- | --- | --- |
| `round_calendar` — Calendario de jornada | Portada → Resumen de jornada (`round_overview`, 8 partidos por página) → un `fixture` por partido → Cierre | Cualquier estado local salvo `finished`, con fecha y nombres válidos. |
| `upcoming_matches` — Próximos partidos | Portada → un `fixture` por partido → Cierre | Solo `scheduled` o `postponed`, con fecha y nombres válidos. |
| `match_preview` — Previa individual | Portada → Información del encuentro (`match_preview`) → Cierre; una pieza por partido | Solo `scheduled` o `postponed`, con fecha y nombres válidos. |

El estado local decide siempre: una fecha pasada nunca convierte un partido en jugado, y un partido `finished` nunca
aparece como próximo. Los partidos por jugar no muestran marcador, resultado, ganador, pronóstico, cuotas, alineaciones,
lesiones, estadísticas ni clasificación.

Los resultados de 01E-A (`round_results`, `match_result`) no cambian: los proyectos existentes son proyectos de
resultados y siguen generándose, revisándose y exportándose igual.

## Arquitectura

- **Tipo de contenido del proyecto.** `projects.content_kind` (`results`, `calendar`, `upcoming`, `preview`; por defecto
  `results`) lo fija el servicio de lotes según el tipo de pieza (`CONTENT_KIND_OF`). La etapa de contenido lo recibe en
  `ContentInput.contentKind`.
- **Estructura** (`modules/content/structure.ts`). `planDraft` despacha por tipo: `results` conserva la planificación
  de 01E-A; los demás usan `planFixtures`, que elige los partidos con `examineFixture` (estado → `already_finished` /
  `not_upcoming`; faltan equipos o fecha → `not_verified`; exclusión del operador → `excluded_by_operator`), los ordena
  por fecha y equipo local y arma las diapositivas. `FixturePlan` no tiene marcador ni resultado.
- **Solicitud a la IA** (`content/request.ts`). Por partido por jugar solo se envían `{{t:<teamId>}}`,
  `{{f:m<n>:kickoff}}` y `{{f:m<n>:status}}` (etiqueta del estado local). No existen `:score` ni `:result` para ellos.
- **Composición** (`content/compose.ts`). Campos de plantilla: `title` (texto fijo), `match_status`, `team_home`,
  `team_away`, `kickoff`; la previa agrega `footer` (competición · temporada); el resumen de jornada usa `fixtures`
  (una línea por partido: local vs visitante · fecha).
- **Regeneración** (`content/regenerate.ts`). Reconstruye el plan de un `fixture`, `match_preview` o `round_overview`
  desde los hechos de la ejecución, con las mismas reglas.
- **Lotes** (`projects/content-batches/service.ts`). Orden estable de piezas: `round_results`, `round_calendar`,
  `upcoming_matches`, `match_result`, `match_preview`. Títulos: «Calendario · Jornada», «Próximos partidos · Jornada»,
  «Previa · Local - Visitante». El snapshot congelado lleva el estado local (`in_progress` → `in_play`) y el marcador
  solo en piezas de resultados. Las plantillas compatibles se calculan por los tipos elegidos.
- **Elegibilidad local** (`providers/sports/ingestion/local-selection.ts`). `localFixtureIneligibility(match,
  'calendar' | 'upcoming')`, usada por la vista previa del lote y por el snapshot congelado, igual que la regla de
  resultados de 01E-A.

## Nuevos SlideTypes y plantillas

| SlideType | Plantilla (`id@versión`) | Contenido | Ranuras |
| --- | --- | --- | --- |
| `round_overview` | `round-overview@1.0.0` | Título «Calendario · Jornada», líneas por partido en bandas alternas, titular y descripción IA, logo. | Sin escudos. |
| `fixture` | `fixture@1.0.0` | «Partido programado», estado, equipos con «vs», fecha y hora, titular y descripción IA, logo. | 2 escudos reservados, vacíos. |
| `match_preview` | `match-preview@1.0.0` | «Previa · Jornada», estado, equipos, fecha y hora, competición · temporada, titular y descripción IA, logo. | 2 escudos reservados, vacíos. |

Las tres usan la paleta, fuentes y constructor de modelos compartidos (`templates/shared.ts`, `fixtureBody`), la misma
identidad de marca que las plantillas de resultados. Se registran como versiones nuevas en `TemplateRegistry`; las
plantillas existentes no cambian de versión. `GET /templates` y la vista previa de plantillas (`rendering/preview.ts`)
las incluyen con datos de muestra.

## Contratos

Solo ampliaciones de enumeraciones y campos nuevos (sin operaciones nuevas ni cambios incompatibles):

- `SlideType`: `round_overview`, `fixture`, `match_preview` (Zod y OpenAPI: `Element.slideType`, `Template.slideType`).
- `TextFieldName`: `match_status`, `fixtures`.
- `ContentFlag.code`: `UNPLAYED_RESULT_CLAIM`.
- `LeftOutMatch.reason`: `already_finished`, `not_upcoming`.
- `ContentPieceKind`: `round_calendar`, `upcoming_matches`, `match_preview`; `kinds` admite hasta 5 elementos.
- `ContentPieceSkipReason`: `already_finished`, `not_upcoming`.
- `ContentBatchMatch`: `calendarIneligibility` y `upcomingIneligibility` (`ContentFixtureIneligibility | null`).

La prueba de documento OpenAPI registra cada delta en la lista de diferencias aceptadas.

## Persistencia

- `0021_project_content_kind.sql`: agrega `projects.content_kind` con `CHECK` y valor por defecto `results`; reconstruye
  `content_generation_items` y `content_generation_item_matches` (patrón `_new` de 0008, `defer_foreign_keys`) para
  ampliar los `CHECK` de `kind` y `skip_reason`, copiando las filas en orden de `rowid`.
- `0022_unplayed_slide_types.sql`: reconstruye `elements` con el mismo nombre (copia aparte con `rowid` original,
  `DROP`, `CREATE` con el `CHECK` ampliado de `slide_type`, reinserción con `rowid`, índice `idx_elements_carousel`
  recreado) para no tocar las tablas hijas ni sus referencias.
- `0023_content_kinds_reconcile.sql`: vuelve a reconstruir `content_generation_items` y
  `content_generation_item_matches` con la definición final de 0021, conservando todas las filas. Ver la incidencia
  más abajo.

Las tres son aditivas, transaccionales y verificadas con `PRAGMA foreign_key_check`; ninguna migración aplicada se editó.
La prueba nueva de migraciones parte de una base en la versión 20 con filas reales y comprueba que `elements`,
`element_versions`, `qa_results` y `carousels` quedan idénticos (incluido `rowid`), que los proyectos existentes quedan
como `results` y que los `CHECK` nuevos aceptan y rechazan lo esperado.

### Incidencia corregida durante la revisión manual

Al confirmar un lote con «Calendario de jornada» y «Próximos partidos», `POST /content-batches` respondía 500. El
servidor de desarrollo del PO había aplicado una versión preliminar de 0021 que solo agregaba `projects.content_kind`,
antes de que 0021 incluyera la reconstrucción de las tablas de ítems. En esa base el `CHECK` de
`content_generation_items.kind` solo admitía `round_results` y `match_result`. Las bases nuevas y las pruebas sí tenían
la definición ampliada, por eso no se detectó.

Como el ejecutor nunca aplica una versión dos veces y una migración aplicada no se edita, se agregó
`0023_content_kinds_reconcile.sql`. Se validó primero sobre una copia de la base del PO (en un directorio temporal, sin
tocar `data/edr.sqlite`): las filas de ítems y partidos quedaron idénticas, incluido `rowid`, y `foreign_key_check` e
`integrity_check` salieron limpios. Después se repitió la petición exacta del PO contra un servidor aislado sobre esa
copia: respondió 202, y el lote se completó con un calendario (Portada, 2 páginas de resumen, 10 partidos, Cierre) y
unos próximos partidos (Portada, 10 partidos, Cierre), todas las diapositivas con la QA aprobada. Una prueba de
regresión reproduce la 0021 preliminar y comprueba la reconciliación.

### Advertencia del control visual en el copy y revisión del copy

En la revisión manual, el copy del calendario quedaba con una advertencia del control visual sin confirmar, y el botón
para confirmarla solo existía dentro de «Detalles y verificaciones», plegado por defecto. La advertencia era
`capitalized_tokens`, que señala las palabras con mayúscula inicial del texto escrito por la IA que no son palabras
comunes, nombres de equipos verificados, etiquetas de la selección ni términos de la marca, porque podrían ser nombres
de personas o datos sin verificar. Marcaba «Calendario», la primera palabra del copy de los partidos por jugar, que
faltaba en la lista de palabras comunes.

- La lista de palabras de `capitalized_tokens` (`visual-qa/words.ts`) incorpora el vocabulario de los partidos por
  jugar en español e inglés («calendario», «programado», «aplazado», «próximos», «upcoming», «postponed», etc.). La
  prueba de extremo a extremo exige ahora que ninguna verificación falle, ni siquiera como advertencia. Sin la
  corrección, falla justamente con «Calendario».
- Revisión del copy: se quitó el encabezado duplicado («Texto de publicación y hashtags» aparecía dos veces, con dos
  estados), y el copy ya no tiene «Detalles y verificaciones», porque su texto ya se muestra completo.
- Lo que impide aprobar se muestra junto a las acciones, para el copy y para las diapositivas: datos bloqueantes,
  observaciones del contenido y «Control visual» con solo las verificaciones fallidas (advertencias con las palabras
  señaladas y el botón «Confirmar»; fallos bloqueantes con su motivo, que se resuelven regenerando).
- Por decisión del PO, «Detalles y verificaciones» se quitó también de las diapositivas: versión, procedencia de cada
  segmento (R-208) y lista completa de verificaciones aprobadas ya no se muestran en la revisión. Se eliminaron el
  componente `TextFields` y sus estilos. La procedencia sigue registrada en el manifiesto y en la traza de cada
  exportación; el resumen del borrador sigue avisando cuando hay datos atestiguados por el operador.

### Decisión PD-ARCH-01E-PD-02: el copy no es obligatorio para exportar

Por decisión del PO (2026-11-05), la aprobación final y la exportación ya no exigen el copy aprobado: el texto de
publicación se puede escribir, aprobar y exportar después.

- La aprobación final cubre todas las diapositivas y el copy solo si está aprobado (`review/service.ts`,
  `coveredElements`). La rechazan las diapositivas sin aprobar o bloqueadas, y un copy aprobado que esté bloqueado.
- La exportación incluye `caption.txt` solo cuando la aprobación final cubre el copy; si no, exporta las diapositivas y
  `manifest.json` (posición N + 1). La descarga acepta exportaciones con o sin copy. Los contratos HTTP no cambian: la
  lista de archivos simplemente no tiene `caption_text`.
- Aprobar el copy después cambia lo que cubre el carrusel: la aprobación final anterior deja de ser válida y se vuelve
  a aprobar el carrusel; la nueva exportación incluye el copy. Las exportaciones anteriores siguen descargables.
- Regenerar un copy que la aprobación final no cubre ya no la invalida: el contenido solo invalida las aprobaciones
  finales cuyo conjunto de versiones contiene la versión regenerada.
- Un copy con observaciones del contenido (por ejemplo, un marcador inventado) sigue sin poder aprobarse y nunca llega a
  una exportación.
- Interfaz: el panel de aprobación final lista solo las diapositivas pendientes y explica si la descarga incluye o no
  el texto de publicación.
- Pruebas actualizadas: `approval.test.ts` (exportación sin copy, descarga, regeneración del copy sin invalidar,
  aprobación posterior del copy con nueva exportación), `content.test.ts`, `review.int.test.ts`, `stage.test.ts`,
  `FinalApproval.test.tsx` y `model.test.ts`.

## Reglas de IA

- Instrucción `edr-draft-instruction-v2`, regla 5: las diapositivas `round_overview`, `fixture` y `match_preview`
  describen partidos no jugados; nunca se presentan como jugados ni mencionan ganador, marcador, resultado, favorito,
  pronóstico, cuotas o probabilidad.
- El adaptador stub tiene textos propios para los tres tipos y usa el texto de publicación «Calendario de partidos»
  cuando la solicitud contiene diapositivas de partidos por jugar.

## Validaciones

- `UNPLAYED_RESULT_CLAIM` (`content/checks.ts`, `words.ts`): en piezas de partidos por jugar se marca toda palabra de
  resultado o pronóstico, en español e inglés, con o sin tildes (por ejemplo «ganó», «empate», «favorito»,
  «pronóstico», «won», «odds», «likely»). Es una marca de contenido como las demás: la revisión la muestra y la
  regeneración la corrige. No se aplica a resultados.
- Las comprobaciones existentes (`UNKNOWN_FACT_REFERENCE`, `UNVERIFIED_NUMBER`, `NON_OFFICIAL_TEAM_NAME`,
  `FORBIDDEN_CONTENT`, límites y hashtags) se aplican igual.

## QA visual

- `data_match` compara el estado dibujado (`match_status`) con la etiqueta del estado local y la fecha con su hecho.
- En `round_overview`, `fixture` y `match_preview` cualquier elemento con semántica de marcador es una discrepancia
  bloqueante, diga lo que diga el texto almacenado.
- `team_names`, `text_fit`, `style_consistency`, `dimensions` y `capitalized_tokens` funcionan sin cambios sobre las
  plantillas nuevas.

## Interfaz

- `/projects/generate`, paso 2: los cinco tipos en dos familias, «Partidos jugados» (resultados de jornada, resultado
  individual) y «Partidos por jugar» (calendario de jornada, próximos partidos, previa individual). Se pueden elegir
  varios a la vez; cada uno se prepara como pieza propia.
- Paso 3: cada partido muestra una marca por familia elegida («Resultado final» / «Sin resultado final»; «Apto para
  calendario» / «Fuera del calendario»; «Por jugar» / «No está por jugar»), una ayuda adaptada al tipo (por ejemplo,
  para la previa: «Elige el partido o los partidos de la previa») y el botón «Seleccionar compatibles». La vista previa
  del servidor sigue siendo la autoridad.
- Paso 4: plantillas compatibles y motivos de omisión de los tipos nuevos.
- Revisión, detalle del proyecto, historial y marca: etiquetas de los SlideTypes, campos (`match_status`, `fixtures`),
  motivos (`already_finished`, `not_upcoming`) y la marca `UNPLAYED_RESULT_CLAIM`. El detalle del proyecto muestra el
  estado y las líneas del calendario.

## Compatibilidad

- Los proyectos, lotes, elementos y exportaciones existentes no cambian; `content_kind` vale `results` para todos.
- La creación de proyectos sin lote (backend de `/projects/new`) sigue creando proyectos de resultados.
- La revisión por elemento, la regeneración, la aprobación final y la exportación funcionan con los SlideTypes nuevos
  (prueba de extremo a extremo con base aislada).

## Pruebas

| Ámbito | Archivo | Qué cubre |
| --- | --- | --- |
| Integración | `apps/server/test/integration/delivery/local-fixture-content.test.ts` (nuevo) | Plan por estado (programado con fecha pasada, aplazado, en juego, finalizado, sin fecha); calendario sin partidos elegibles (omitido / 409); calendario completo (estructura, estados, título, sin marcador ni «1-0», sin marcas, placeholders `:status` y nunca `:score`/`:result`); próximos partidos; dos previas con reintento idempotente; regeneración, aprobación y exportación; sin tráfico externo. |
| Unitarias | `content/structure.test.ts` | Calendario ordenado con resumen y partidos; paginación del resumen; calendario sin partidos; próximos partidos solo programados/aplazados; exclusiones; previa válida, finalizada, en juego, sin fecha o sin nombre. |
| Unitarias | `content/checks.test.ts` | `UNPLAYED_RESULT_CLAIM` en español e inglés; texto neutral sin marcas; no aplica a resultados. |
| Unitarias | `projects/content-batches/plan.test.ts` | `localFixtureIneligibility` por estado (nunca por fecha); orden de los cinco tipos; títulos; piezas omitidas sin partidos; vista del partido. |
| Unitarias | `rendering/templates.test.ts` | Registro de 7 plantillas; renderizado completo sin desbordes; estado, equipos y fecha, nunca marcador; líneas del resumen; determinismo del PNG. |
| Unitarias | `visual-qa/core.test.ts` | QA aprobada en partido programado, aplazado y previa; estado distinto del local; marcador dibujado en partido por jugar. |
| Integración | `platform/db/migrations.int.test.ts`, `schema.int.test.ts`, `visual-qa/stage.int.test.ts`, `rendering/routes.int.test.ts` | Migraciones 21 y 22 (con filas existentes), columnas, versiones y lista de plantillas. |
| Contrato | `test/contract/openapi-document.test.ts`, muestras | Deltas de OpenAPI y paridad con Zod. |
| Web | `features/projects/GenerateContentPage.test.tsx` | Cinco tipos en dos familias; marcas por tipo; «Seleccionar compatibles»; previa con un partido elegible y otro omitido; carga de solicitud. |

Resultados de la verificación final:

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto. |
| ESLint (`--max-warnings 0`) y Prettier sobre los archivos cambiados | Correcto. |
| `vitest --project unit` | 85 archivos, 1714 pruebas, todas correctas. |
| `vitest --project integration` | 49 archivos, 588 pruebas, todas correctas (tras agregar 0023). |
| `vitest --project contract` | 7 archivos, 1728 pruebas, todas correctas. |
| `vitest --project unit-web` | 576 pruebas; 574 correctas y 2 fallas previas a 01E-B (breadcrumbs en `App.test.tsx` y `ReviewPage.test.tsx`), ajenas a este cambio. |
| `npm run build` | Correcto. |
| `git diff --check` | Sin observaciones. |

No se ejecutaron E2E ni automatización de navegador. Las pruebas usan bases aisladas; no se tocó `data/edr.sqlite`.

Durante la verificación se estabilizó una prueba de 01F (`preloads the competition, season, round and its stage…`) que
fallaba de forma intermitente: comprobaba la fase antes de que terminara la validación del enlace. Ahora espera a esa
validación; el comportamiento de la página no cambió.

## Limitaciones

- No hay datos de alineaciones, lesiones, estadísticas, historial ni clasificación en las previas: el dominio local no
  los tiene y no se inventan. Ampliarlos exige nuevos hechos verificables.
- El «Resumen de jornada» del calendario lista los partidos; no hay un resumen agregado de resultados (sigue fuera del
  alcance, como se documentó en la evaluación de 01E-B).
- Los escudos siguen como ranuras reservadas vacías (PD-03).
- `UNPLAYED_RESULT_CLAIM` es léxico: detecta palabras de resultado o pronóstico, no paráfrasis sin esas palabras. La
  regla de instrucción y la revisión humana siguen siendo necesarias.
- Las marcas del paso 3 del asistente son una guía del cliente; la vista previa del servidor decide.
- El estado «en juego» entra en el calendario con la etiqueta «En juego», sin marcador.

## Pasos de validación sugeridos para el PO

1. Reiniciar el servidor de desarrollo para que aplique las migraciones pendientes (en la base del PO, 0023; en una base
   nueva, 0021 a 0023). Son aditivas y los proyectos existentes quedan como resultados.
2. En **Crear contenido**, elegir una competición local, temporada y jornada con partidos programados, aplazados y
   finalizados.
3. Paso 2: marcar «Calendario de jornada» y «Próximos partidos»; paso 3: comprobar las marcas y usar «Seleccionar
   compatibles»; paso 4: revisar plantillas, piezas y motivos de omisión; confirmar.
4. Abrir cada proyecto: Portada → Resumen de jornada → Partidos → Cierre (calendario) y Portada → partidos → Cierre
   (próximos). Verificar estados, fechas y que no aparece marcador.
5. Repetir con «Previa individual» y uno o varios partidos; revisar, regenerar un elemento, aprobar y descargar.
6. Confirmar que un proyecto de resultados anterior sigue abriendo, revisándose y exportándose igual.

## Estado Git

- Rama: `work/PD-ARCH-01E-B`, base `11c173d` (cierre de PD-ARCH-01F).
- Cerrada con un commit propio en `work/PD-ARCH-01E-B` tras la aceptación del Product Owner.
