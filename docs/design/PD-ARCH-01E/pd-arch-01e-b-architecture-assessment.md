# PD-ARCH-01E-B — Evaluación arquitectónica: ampliación versionada del motor de contenido

## Estado

Aprobada por el Product Owner, **implementada y aceptada** (2026-11-05) en `work/PD-ARCH-01E-B`; ver el
[informe de implementación](./pd-arch-01e-b-implementation-report.md). Se apoya en PD-ARCH-01E-A (lotes, adaptador
local, snapshots congelados y contexto deportivo del proyecto), que no cambia.

## Objetivo

Agregar, como versiones nuevas del motor existente, tres tipos de pieza que hoy no tienen plantilla ni reglas de
estructura:

| Tipo | Contenido | Partidos que admite |
| --- | --- | --- |
| A. Calendario de jornada | Partidos programados de una jornada: equipos, fecha y hora. | Cualquier estado distinto de `finished`; los finalizados se listan aparte o se excluyen según la regla aprobada. |
| C. Próximos partidos | Encuentros pendientes de la selección. | Solo `scheduled` y `postponed` con fecha; una fecha pasada nunca convierte un partido en disputado. |
| D. Previa de partido | Una pieza por encuentro seleccionado. | Un partido no finalizado; solo datos locales del dominio. |

El «Resumen de jornada» (E) no se implementó en 01E-A porque, con el motor actual, sería el mismo carrusel de resultados
con otro nombre. Un resumen genuino exige hechos agregados (por ejemplo, goles totales de la jornada) que el motor no
deriva hoy; derivarlos requiere reglas de cálculo, versión de cálculo y semántica de verificación explícitas. Se propone
decidirlo junto con 01E-B o en un incremento posterior.

## Por qué no cabe en 01E-A

- `SlideTypeSchema` es un enum cerrado (`cover`, `match_result`, `standings`, `closing`) compartido por contratos,
  revisión, renderizado, QA visual y exportación.
- `modules/content/structure.ts` incluye **solo** partidos `finished` con marcador; cualquier otro estado se lista como
  omitido. Cambiar esa regla afectaría a todos los proyectos existentes.
- La solicitud a la IA (`content/request.ts`), las sustituciones (`compose.ts`) y las comprobaciones (`checks.ts`) están
  definidas por tipo de diapositiva y por los hechos de resultado.
- El QA visual compara el texto renderizado con los hechos de marcador (`data_match`).

## Arquitectura propuesta

1. **Tipo de pieza en el proyecto.** Migración aditiva: `projects.content_kind TEXT NOT NULL DEFAULT 'round_results'`
   con `CHECK` sobre los tipos aprobados. Los proyectos existentes conservan el comportamiento actual sin reescritura.
   El tipo viaja en el *configuration snapshot* de la ejecución para que un redraft use la misma regla.
2. **Estructura por tipo.** `planDraft` despacha por `content_kind`. La regla vigente se convierte en la variante
   `round_results` sin cambios de comportamiento (pruebas de no regresión sobre los borradores actuales). Variantes
   nuevas:
   - `round_calendar`: portada, una diapositiva `fixture` por partido no finalizado (orden de calendario), cierre.
   - `upcoming_matches`: igual que el calendario, filtrado a `scheduled`/`postponed` con fecha.
   - `match_preview`: portada opcional y una diapositiva `match_preview` del partido.
3. **Plantillas versionadas.** Nuevos `SlideType` `fixture` y `match_preview` con plantillas `fixture@1.0.0` y
   `match-preview@1.0.0` registradas en `TemplateRegistry`. Las versiones existentes no cambian; los elementos ya
   renderizados conservan su `template_id`/`template_version`.
4. **Hechos.** Se reutilizan `match_teams`, `match_kickoff`, `match_status` y `team_official_name`. No se agregan
   estadísticas, alineaciones, probabilidades ni pronósticos: el dominio no los contiene.
5. **IA.** Nuevos campos de solicitud por tipo de diapositiva con marcadores para equipos y fecha. Nueva comprobación de
   contenido que bloquee afirmaciones de resultado o pronóstico sobre partidos no disputados (por ejemplo, marcadores o
   ganadores en una previa). Se mantiene el adaptador de IA actual; no se agrega proveedor.
6. **QA visual.** `data_match` compara equipos, fecha y hora mostradas con los hechos; `text_fit` y `team_names` se
   aplican a las nuevas plantillas. `dimensions` y `style_consistency` sin cambios.
7. **Lotes.** `ContentPieceKind` agrega `round_calendar`, `upcoming_matches` y `match_preview`. La elegibilidad por tipo
   se define junto a `localResultIneligibility` (por ejemplo `localFixtureIneligibility`) y la usan la vista previa y
   el congelado, como en 01E-A. El documento congelado conserva partidos no finalizados con marcador `null`, que el
   formato de importación manual ya admite.

## Contratos afectados

- `SlideType` (OpenAPI y Zod): `fixture`, `match_preview`.
- `ContentPieceKind`, `ContentPieceSkipReason` (nuevos motivos, por ejemplo `kickoff_missing`, `already_finished`).
- `Template` (sin cambio de forma; nuevas entradas en `listTemplates`).
- `Draft`/`Element`: nuevos campos de texto por tipo de diapositiva.
- `Project`/`ProjectSummary`: `contentKind`.
- Manifiesto de exportación: tipos de diapositiva nuevos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Regresión del carrusel de resultados. | Variante `round_results` idéntica, cubierta por las pruebas de entrega existentes. |
| Contenido que sugiere resultados de partidos no disputados. | Comprobación de contenido nueva y revisión humana obligatoria. |
| Plantillas con texto largo (nombres, fechas). | `text_fit` y casos con nombres largos en las pruebas de renderizado. |
| Partidos sin fecha. | Se omiten con motivo explícito; nunca se inventa una fecha. |

## Criterios de aceptación propuestos

- [ ] Calendario, próximos partidos y previa individual generables por lote desde datos locales.
- [ ] Ningún partido no finalizado se representa con marcador ni se considera disputado por su fecha.
- [ ] Plantillas nuevas versionadas; las existentes y los elementos ya renderizados no cambian.
- [ ] QA visual valida equipos, fecha y hora de cada diapositiva nueva.
- [ ] Ninguna afirmación de resultado, estadística o pronóstico no respaldada por los datos locales.
- [ ] Proyectos y borradores anteriores se comportan igual (pruebas de no regresión).
- [ ] Revisión, aprobación y exportación funcionan con los nuevos tipos.
- [ ] Contratos Zod/OpenAPI, migración aditiva y pruebas de contrato, integración, persistencia y UI.
