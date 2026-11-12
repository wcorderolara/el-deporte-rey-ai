# REVIEW-APPROVAL-01 — Aprobación final con contenido editorial (resolución de P-1)

## Estado

- **Regla decidida por el Product Owner el 2026-11-12** como respuesta a la pregunta P-1 de UX-REVIEW-01. Está
  registrada como **PD-33** en `.orchestrate/source-of-truth.md`.
- **Documentada como refinamiento independiente. No está implementada** ni forma parte de PD-ARCH-01G-E.1, porque
  cambia la arquitectura de aprobación (ver la sección 3).
- Hasta que se implemente, el código sigue la regla PD-ARCH-01E-PD-02: el copy no es obligatorio para la aprobación
  final ni para la exportación.

## 1. Regla aprobada

La aprobación final de un carrusel debe exigir:

1. Todas las diapositivas requeridas aprobadas.
2. El contenido editorial publicable correspondiente aprobado.
3. Ausencia de errores bloqueantes.
4. Cumplimiento de las validaciones actuales.

Además:

- No se exigen aprobaciones duplicadas sobre el mismo contenido editorial.
- Un proyecto con un modelo legacy de copy conserva sus reglas y aprobaciones.
- No se invalidan proyectos aprobados antes.

## 2. Estado actual (inspección de contratos y código, 2026-11-12)

| Punto | ¿Se cumple hoy? | Evidencia |
| --- | --- | --- |
| 1. Diapositivas aprobadas | Sí | `approveCarousel` (`review/service.ts`) rechaza con `FINAL_APPROVAL_REFUSED` cada diapositiva no aprobada. |
| 2. Contenido editorial aprobado | **No** | `coveredElements` incluye el texto del carrusel solo si ya está aprobado (PD-ARCH-01E-PD-02). La aprobación final no lee el copy editorial de PD-ARCH-01H. |
| 3. Sin errores bloqueantes | Sí | Se rechazan diapositivas bloqueadas, con observaciones o con QA fallido (`blocked`, `flagged`, `qa_failed`), y un texto aprobado que esté bloqueado. |
| 4. Validaciones actuales | Sí | Advertencias de QA sin confirmar (`qa_ack_required`), conjunto de versiones con SHA-256 que se invalida con cualquier cambio (AD-13), datos publicables (AD-28, AD-38). |

Cómo está modelado hoy:

- **Texto del carrusel** (modelo de WI-1 y PD-ARCH-01E): es un elemento `caption` de cada carrusel. Se aprueba como
  una diapositiva y, si está aprobado, entra en el conjunto de versiones de la aprobación final y se exporta como
  `caption.txt`.
- **Copy editorial** (PD-ARCH-01H): son cinco entregables por proyecto (`facebook_instagram`, `tiktok_reels`,
  `viral_headlines`, `youtube` y `debate_question`). Cada uno se aprueba por separado, ligado a su versión exacta
  (`editorial_versions.approved_at`, DE-5 de 01H), y pertenece al borrador del proyecto, no a un carrusel. El módulo de
  revisión no lo lee, y ni la aprobación final ni la exportación lo incluyen.

## 3. Por qué no es un cambio menor

- **Conjunto de versiones (AD-13):** para que editar o regenerar el copy invalide la aprobación final, su versión debe
  formar parte del conjunto aprobado. Además, el servicio editorial tendría que invalidar las aprobaciones finales
  afectadas, que hoy pertenecen a otro módulo.
- **Contrato:** los elementos de `FINAL_APPROVAL_REFUSED` se identifican por `elementId`. Un entregable editorial
  pendiente necesita otra forma de elemento (cambio aditivo del contrato).
- **Granularidad:** el copy editorial es del proyecto y la aprobación final es de cada carrusel. Un proyecto puede tener
  varios carruseles.
- **Exportación:** hay que decidir si se exporta el copy aprobado y en qué archivo.
- **Compatibilidad:** hay que distinguir los proyectos con modelo legacy y no invalidar las aprobaciones finales
  válidas.
- **Interfaz:** el diálogo de aprobación final (UX-REVIEW-01) tendría que listar el copy pendiente.

## 4. Preguntas para el Product Owner antes de implementar

| ID | Pregunta | Recomendación |
| --- | --- | --- |
| RA-1 | ¿Cuál es «el contenido editorial publicable correspondiente» de un carrusel? (a) El entregable `facebook_instagram` de 01H; (b) todos los entregables generados; (c) el texto del carrusel. | (a): es el copy de la publicación del carrusel en Instagram y Facebook. Los demás entregables son para otros canales. |
| RA-2 | ¿Qué proyecto usa el «modelo legacy de copy»? | Los proyectos creados antes de que se implemente el refinamiento, con una marca en el proyecto como la versión del snapshot de escudos de 01G-E.1. Si la marca fuera «no tiene copy editorial», bastaría con no generarlo para saltarse la regla. |
| RA-3 | Si existen el texto del carrusel y el entregable editorial, ¿cuál se exige? | En los proyectos nuevos, el entregable editorial. El texto del carrusel sigue siendo opcional, para no aprobar dos veces el mismo contenido. |
| RA-4 | ¿La exportación incluye el copy editorial aprobado? | Sí, como archivo de texto junto a las diapositivas. `caption.txt` sigue igual en los proyectos legacy. |
| RA-5 | Con varios carruseles, ¿una aprobación del copy editorial vale para todos los carruseles del borrador? | Sí. El copy pertenece al borrador del proyecto. |

## 5. Alcance técnico estimado (tras las respuestas)

- `review/service.ts`: `approveCarousel` y `coveredElements` incluyen la versión aprobada del entregable que se exige.
  El conjunto de versiones registra también su ID.
- `editorial/service.ts`: al editar, regenerar o retirar la aprobación del entregable, se invalidan las aprobaciones
  finales que lo cubren.
- Contrato: un motivo y una forma de elemento nuevos en `FINAL_APPROVAL_REFUSED` (aditivo).
- Exportación del copy (RA-4).
- Interfaz: el diálogo de aprobación final lista el copy pendiente y enlaza con el modo «Copy editorial».
- Marca de proyecto legacy (RA-2). Puede necesitar una columna, y por tanto una migración. Se confirma al planificar.
- Pruebas de cada regla, de la compatibilidad y de la no invalidación de las aprobaciones anteriores.

## 6. Compatibilidad comprometida

- Las aprobaciones finales válidas y las exportaciones existentes no cambian.
- Los proyectos legacy conservan la regla PD-ARCH-01E-PD-02.
