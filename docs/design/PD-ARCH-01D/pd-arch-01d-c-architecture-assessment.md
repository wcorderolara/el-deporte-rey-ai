# PD-ARCH-01D-C — Evaluación previa a la escritura

Estado: evaluación previa a la implementación. Las resoluciones se implementaron según el [informe de PD-ARCH-01D-C](./pd-arch-01d-c-implementation-report.md); la columna «Resolución implementada» resume cada una.

## Modelo existente

`Competition` posee temporadas locales; `managed_teams` es un catálogo global. `competition_teams` y `season_participants` son asociaciones distintas. Los partidos requieren ambos participantes y admiten fase y jornada opcionales; `match_results` guarda el par de marcadores y `match_result_history` conserva sus cambios. La vinculación de proveedor y los snapshots de 01D-B están en tablas separadas. El `Db` inicia una transacción `BEGIN IMMEDIATE` y rechaza trabajo asíncrono dentro de ella.

## Incompatibilidades detectadas y resolución segura

1. El preview permite seleccionar `matches` sin `teams`, o `rounds` sin `stages`. La base local exige participantes para los partidos y una fase local cuando la jornada pertenece a una fase. No es seguro inferir identidades de los títulos. La aplicación debe exigir que las identidades de todas las dependencias estén resueltas mediante mappings existentes o registros del mismo snapshot; de lo contrario debe rechazar la confirmación con una explicación accionable. La pertenencia a temporada puede derivarse de las referencias de partidos revisados, aun cuando el proveedor no ofrezca tabla de posiciones.
2. 01D-B limita la lectura a 120 selecciones y el snapshot a 10,000 registros. Un preview con selecciones omitidas no representa una importación completa. La aplicación debe rechazar snapshots con `skipped` o errores de lectura; no puede anunciar éxito parcial sin que el usuario haya aceptado ese alcance.
3. Los candidatos por nombre en 01D-B son solo alertas y no mappings. No se deben usar como identidad automática. El usuario tendrá que escoger explícitamente el registro local o generar un preview nuevo con destino elegido. Si falta una decisión, la operación se bloqueará sin escribir.
4. El título visible de fases sustituye caracteres que el contrato local no acepta, por ejemplo `REGULAR_SEASON` → `REGULAR SEASON`. El identificador externo opaco debe conservarse íntegro en el mapping. Una fase sin nombre local válido debe bloquearse; nunca se reemplaza por un nombre inventado.
5. El dominio local no guarda baseline ni provenance por campo. Hasta que se pueda distinguir una modificación manual de un valor importado anterior, cualquier cambio ambiguo sobre un registro existente debe conservar el valor local y exigir resolución explícita. La creación de registros independientes sí puede proceder. Ningún resultado manual se sobrescribirá de forma implícita.

Estas reglas requieren migraciones **aditivas** para mappings y auditoría de aplicación. No requieren cambiar las migraciones históricas ni crear tablas deportivas paralelas. El snapshot original seguirá siendo la única fuente de datos de importación; aplicar nunca debe consultar el proveedor.

## Resolución implementada

| # | Resolución |
| --- | --- |
| 1 | Las dependencias se resuelven por el snapshot o por mapping; si faltan, el registro queda bloqueado (`DEPENDENCY_MISSING`) con opción explícita de omitirlo. Los participantes se derivan también de los partidos. |
| 2 | Las selecciones omitidas o el recorte por presupuesto bloquean la aplicación (`SOURCE_INCOMPLETE`, `SOURCE_TRUNCATED`). |
| 3 | Las coincidencias por nombre producen candidatos; la identidad requiere `link` hacia un candidato ofrecido o `skip`. Un mapping de otra competición es evidencia, nunca un vínculo automático. |
| 4 | Se crea el título visible compatible con el contrato; el identificador y la etiqueta externos se guardan en `external_identity_mappings.external_label`. |
| 5 | Se añadió baseline por campo en los mappings (`baseline_json`). Los valores locales que no coinciden con el último valor importado se conservan salvo `accept_incoming` explícito y auditado. |
