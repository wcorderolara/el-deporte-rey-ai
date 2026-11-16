# PD-ARCH-01E — Evaluación arquitectónica previa

## Estado

Evaluación previa a la implementación. El Product Owner la resolvió el 2026-11-05:

- **Opción por etapas.** PD-ARCH-01E se divide en **01E-A** (integración con el motor existente y generación por lotes de
  los tipos soportados) y **01E-B** (ampliación versionada del motor para calendario, próximos partidos y previa). Solo
  01E-A se implementa ahora; 01E-B queda documentada en
  [pd-arch-01e-b-architecture-assessment.md](./pd-arch-01e-b-architecture-assessment.md).
- **Modo de datos.** La fuente local declara `MANUAL_DATA` (no se agrega un cuarto modo).
- **Procedencia de los snapshots locales.** Cada lote confirmado se congela como una importación de formulario de la
  fuente local, con una versión por pieza (ver «Brecha de procedencia» abajo).

Checkpoint de PD-ARCH-01D-D (aceptada el 2026-11-05): `698b90dec4f4cd0c18a022f6cf778dbab2bdd4fd` en
`work/PD-ARCH-01D-D`. Rama de trabajo: `work/PD-ARCH-01E`, creada desde ese commit.

## Discrepancias con la planificación aprobada

| Fuente | Contenido | Impacto |
| --- | --- | --- |
| `docs/design/PD-ARCH-01/implementation-roadmap.md` | 01E = relación reutilizable de contenido; 01F = integración de datos locales con el pipeline de generación. | El prompt de 01E pide generar desde datos locales (alcance que el roadmap asignaba a 01F) y prohíbe implementar 01F. Se interpreta que el prompt redefine 01E; 01F queda sin implementar con el alcance que el PO le asigne. |
| Prompt 01E, sección 7 | Cinco tipos: calendario, resultados, próximos partidos, previa individual y resumen. | El motor produce un único tipo de pieza. Resuelto por el PO: 01E-A cubre lo soportado y 01E-B la ampliación. |
| Prompt 01E, sección 9 | "No rediseñar el motor de plantillas." | Los tipos A, C y D requieren nuevos `SlideType`; quedan en 01E-B. |

## Capacidades existentes

1. **Creación de proyectos.** `ProjectsService.create` resuelve una selección de catálogo
   `(competitionId, sourceId, seasonId, stageId, matchday)` mediante `CatalogueService`, que lista competiciones de las
   *fuentes* configuradas. Guarda fuente, modo, `selectionRef` opaco y etiquetas. No conocía las competiciones locales.
2. **Plantillas.** `TemplateRegistry`: plantillas versionadas en código, una por `SlideType`
   (`cover`, `match_result`, `standings`, `closing`). El operador no elige plantilla: cada diapositiva usa la versión
   vigente de su tipo.
3. **Assets.** Marca (`modules/brand`) y renders PNG por versión de elemento. Los escudos son ranuras opcionales; no se
   inventan logos (PD-03).
4. **Renderizado.** Satori + resvg, determinista, por versión de elemento; vista previa en `modules/rendering/preview.ts`.
5. **Relación proyecto ↔ contenido.** Un proyecto tiene ejecuciones y un borrador activo con uno o más carruseles.
   Ejecución: research → verificación → contenido (IA) → renderizado → QA visual; después revisión, aprobación por
   elemento, aprobación final y exportación.
6. **Contratos.** `createProject`, `startRun`, `getRun`, `setExcludedMatches`, `getDraft`, revisión y exportación.
7. **Generación múltiple.** No existía: un proyecto = una selección = un borrador; sin lotes ni idempotencia.
8. **Preview y exportación.** Preview de diapositivas; exportación (`NN.png`, `caption.txt`, `manifest.json`) tras
   aprobación final.
9. **Datos que consumen las plantillas.** Hechos verificados o candidatos. La estructura incluye **solo partidos
   `finished` con marcador**; la clasificación solo si la fuente la aporta.

## Brechas y resolución en 01E-A

| # | Brecha | Resolución |
| --- | --- | --- |
| G1 | Los proyectos no podían usar competiciones locales. | Adaptador `local-competitions` (modo `MANUAL_DATA`, no aceptado) registrado en el puerto de ingesta. |
| G2 | No había relación entre proyecto y contexto deportivo local. | Migración aditiva `0017`: lote, piezas y partidos por pieza; `Project.sportsContext`. |
| G3 | No había generación por lotes ni idempotencia. | Operación de lote con `requestKey` único y transacción `BEGIN IMMEDIATE`. |
| G4 | Selección de partidos al crear. | Cada pieza congela exactamente sus partidos elegibles. |
| G5 | Tipos A, C y D no existen en el motor. | 01E-B. |
| G6 | Atribución de datos importados de football-data.org (FU-8). | Sin cambios; sigue abierta. |

## Brecha de procedencia (descubierta durante la implementación)

`retrievals.import_version_id` y `observations.import_version_id` tienen clave foránea hacia
`manual_selection_versions`, y la restricción `(data_mode = 'MANUAL_DATA') = (import_version_id IS NOT NULL)` exige que
toda observación `MANUAL_DATA` cite una versión de importación manual. Un snapshot local sin versión hacía fallar el
research (`internal`). Cambiar a `LIVE_DATA` impedía la aprobación manual y, por tanto, la exportación.

Opciones presentadas: congelar la selección como versión de importación (recomendada), reconstruir las tablas de
auditoría o detenerse. **El PO eligió congelar la selección**: no se reconstruye ninguna tabla existente y cada pieza
queda trazable a su snapshot exacto. Efecto visible: cada lote aparece en el historial de importaciones como una
importación de formulario de la fuente «Datos deportivos locales».

## Compatibilidad con la verificación

La fuente local `MANUAL_DATA` no aceptada produce hechos `unverified` con valor candidato. El borrador se genera y queda
bloqueado para aprobación hasta la aprobación manual de los hechos; la publicación de hechos aprobados manualmente sigue
AD-28/AD-38 (competición configurada sin fuente pública aceptada). No se relaja PD-02.
