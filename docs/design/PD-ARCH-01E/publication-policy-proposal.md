# Propuesta: publicación de contenido generado desde competiciones locales

## Estado

**Resuelta por decisión del Product Owner (PD-ARCH-01E-PD-01, 2026-11-05), implementada y aceptada con 01E-A.**
Las opciones P1 a P3 quedan como antecedente; la decisión aplicada se describe al final.

## Problema observado

El PO generó un carrusel de «Liga Nacional de Guatemala · Fase Regular - Jornada 18 - Apertura 2026» desde datos
locales. En revisión, cada diapositiva aparece **Bloqueada** («usa datos que no son publicables») y no puede aprobarse.

Diagnóstico sobre una copia de la base (sin tocar el original): los 38 hechos de la ejecución están `unverified` con
`no_accepted_source` y no hay aprobaciones manuales. Es el comportamiento vigente, no un defecto de 01E-A:

1. La fuente local es `MANUAL_DATA` no aceptada: sus hechos quedan sin verificar (PD-02 exige dos fuentes
   independientes) y se pueden aprobar manualmente.
2. Un hecho aprobado manualmente solo es publicable si `verificationPolicy.manuallyApprovedPublication` es
   `allowed_without_accepted_source` **y** la competición del proyecto está atestada (`isOperatorAttestedCompetition`):
   un enlace de `config/catalogue.json` con `noAcceptedPublicSource: true` (AD-38).
3. Una competición atestada usa nombres de equipo fijados (*pinned*): sin mapa de identidades
   `config/team-identities/<competición>-<temporada>.json`, los hechos de equipo quedan `team_identity_unmatched` y la
   aprobación manual los rechaza.

Atestar exige editar dos archivos de configuración por competición y temporada, con UUID internos y un mapa de equipos
escrito a mano. Para datos que el operador ya administra en el estudio, ese procedimiento es desproporcionado.

Observación de interfaz (anterior a 01E): el panel «Datos que bloquean la aprobación» muestra solo su introducción; la
lista de hechos está dentro de «Detalles técnicos», colapsado.

## Opciones

### P1 — Atestación por competición local, explícita y auditada (recomendada)

- El operador marca, en el detalle de una competición local, «Atesto los datos de esta competición» con confirmación.
  Se registra quién no se conoce (no hay usuarios), pero sí cuándo, y se puede retirar.
- Migración aditiva: `competition_attestations` (competición, `attested_at`, `withdrawn_at`) con historial
  append-only.
- `isOperatorAttestedCompetition` se resuelve también para proyectos de la fuente local: proyecto → pieza → lote →
  competición local atestada. Los enlaces de catálogo existentes siguen funcionando igual.
- Identidad de equipos: para la fuente local, el mapa fijado se deriva de los equipos locales (`managed_teams`): el
  UUID del equipo es la clave estable y su nombre el nombre oficial. No se necesita ningún archivo.
- Se conserva todo lo demás: los hechos siguen `unverified` hasta la aprobación manual del operador, se muestran como
  «atestados por el operador» y nunca como «verificados»; PD-02 no cambia.
- Un proyecto generado antes de atestar necesita una nueva ejecución completa (la identidad se decide en verificación).

### P2 — Publicación de cualquier aprobación manual de la fuente local, sin atestación

Más simple, pero elimina la declaración explícita del operador que AD-38 exige y aplicaría a toda competición local,
incluidas las importadas de un proveedor cuya atribución (FU-8) sigue abierta. No se recomienda.

### P3 — Mantener AD-38 y facilitar la configuración

Un comando que genere el enlace de catálogo y el mapa de identidades desde los datos locales. No cambia la política, pero
mantiene la atestación fuera del producto y requiere reiniciar el servidor.

## Impacto de P1

| Área | Cambio |
| --- | --- |
| Persistencia | Migración aditiva de atestaciones; sin cambios en filas existentes. |
| Verificación | Resolución de atestación y de identidad fijada para la fuente local. |
| Publicabilidad | `publishabilitySettings` consulta la atestación local; la regla `publishability` no cambia. |
| Contratos | `ManagedCompetition.attestation` y operaciones para atestar y retirar (Zod y OpenAPI). |
| UI | Control de atestación con confirmación en Competiciones; aviso en la revisión cuando falta. |
| Pruebas | Atestar, retirar (invalida aprobaciones finales vigentes), aprobación manual, aprobación final y exportación de una pieza local; no regresión de AD-38 por catálogo. |

## Criterios de aceptación propuestos

- [ ] Una competición local se atesta y se retira desde la interfaz, con confirmación e historial.
- [ ] Tras atestar y volver a ejecutar, los hechos de la pieza se aprueban manualmente y el carrusel se aprueba y exporta.
- [ ] Sin atestación, el comportamiento es el actual.
- [ ] Retirar la atestación vuelve a bloquear la aprobación y invalida las aprobaciones finales vigentes.
- [ ] Los hechos aprobados manualmente nunca se presentan como verificados.
- [ ] Las competiciones atestadas por catálogo siguen funcionando sin cambios.

## Decisión requerida

Aprobar P1, P2 o P3 (o una variante) como modificación de AD-38. Mientras tanto, el contenido local se genera y revisa,
pero no se aprueba para exportación salvo con la atestación por configuración descrita en el informe de 01E-A.

## Decisión aplicada: PD-ARCH-01E-PD-01

El Product Owner indicó que los resultados agregados o modificados de forma manual, por proveedor o híbrida ya pasan por
validaciones y correcciones del operador en Competiciones, y que los textos se revisan y validan. Por tanto, al generar
contenido desde competiciones locales, esos datos se consideran aprobados y listos para la generación.

Implementación:

- La fuente `local` declara `"operatorValidated": true` en `config/*.config.json`. La regla de configuración solo lo
  admite en fuentes `MANUAL_DATA`.
- Migración aditiva `0019_operator_validated_approvals.sql`: `manual_approvals.origin` (`operator` por defecto u
  `operator_validated_source`). Las aprobaciones existentes conservan `operator`.
- La verificación registra, para cada hecho elegible de una fuente validada por el operador, una aprobación manual con
  origen `operator_validated_source`. Los hechos no elegibles (en disputa, identidad de equipo no resuelta, valor
  discrepante) no se aprueban.
- La publicabilidad admite aprobaciones manuales de una competición atestada en el catálogo (AD-38, sin cambios) **o**
  de una fuente validada por el operador.
- Se mantiene: los hechos nunca se presentan como verificados (PD-02 no cambia); cada aprobación puede revocarse dato por
  dato; las diapositivas se revisan y aprueban una por una, con QA visual, y el carrusel requiere aprobación final antes
  de exportar.
- Los proyectos generados antes de esta decisión necesitan una nueva ejecución completa para registrar las aprobaciones.
