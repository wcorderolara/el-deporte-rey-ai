# PD-ARCH-01D-D — Informe de implementación

## Estado

Implementación **aceptada por el Product Owner el 2026-11-05**. PD-ARCH-01D-C fue aceptada y cerrada en el commit `cfc5ee2981d1b787f2e9aa915c1f03e75dc0531c`; 01D-D se cierra en `work/PD-ARCH-01D-D`.

## Arquitectura de provenance

La migración aditiva `0016_sports_field_provenance.sql` incorpora:

- `sports_field_provenance`: estado vigente por entidad y campo. El valor efectivo continúa en la tabla deportiva; esta tabla conserva origen, proveedor, referencia externa, último valor externo conocido, protección manual y aplicación relacionada.
- `sports_field_provenance_events`: historial mínimo append-only para importaciones, ediciones manuales y decisiones explícitas.

El diseño evita duplicar el valor efectivo. Los identificadores de aplicaciones son referencias de auditoría blandas porque la aplicación confirmada se registra al final de la misma transacción que escribe las entidades deportivas. La migración reconstruye de forma aditiva el provenance disponible en los baselines de mappings existentes y no elimina ni reescribe datos deportivos.

## Política de precedencia

1. Un campo sin override puede recibir una propuesta externa; solo cambia tras confirmación explícita.
2. Una edición manual de un campo importado actualiza el valor local y lo marca como `manual_override` protegido.
3. Un preview posterior conserva por defecto el valor local protegido y muestra la diferencia.
4. `accept_incoming` aplica el valor externo, actualiza el baseline y retira la protección.
5. `keep_local` conserva valor y protección; el baseline importado no avanza silenciosamente.
6. La ausencia de un campo externo no borra un valor local.
7. `null/null` y `0/0` continúan siendo estados distintos.

## Comportamiento por modo

- **Manual:** las operaciones existentes siguen disponibles sin proveedor. Las ediciones se registran como procedencia manual cuando existe un contexto trazable.
- **Provider:** las importaciones continúan siendo explícitas. Una corrección manual permitida genera protección.
- **Hybrid:** los valores importados y las modificaciones locales conviven; los overrides prevalecen hasta aceptar explícitamente el proveedor.

No se implementa sincronización automática ni periódica.

## Backend y contratos

- Los servicios de temporadas/equipos y calendario/resultados registran provenance dentro de la misma transacción que el cambio deportivo.
- La comparación consulta campos protegidos y genera conflictos conservadores.
- La aplicación registra los campos aceptados por proveedor y eventos de decisión.
- Se soportan actualizaciones confirmadas de temporada, equipo, fase, jornada, partido y resultado sin alterar mappings estables.
- `GET /api/v1/competitions/{competitionId}/provenance/{entityType}/{entityId}` consulta procedencia por campo.
- `GET /api/v1/competitions/{competitionId}/import-applications` expone historial resumido sin snapshots ni credenciales.

Zod y OpenAPI describen ambos recursos. Las validaciones de pertenencia, integridad, idempotencia y concurrencia permanecen vigentes.

## Frontend

- El detalle de partido muestra indicadores compactos de dato de proveedor y override protegido, además de procedencia expandible.
- Antes de editar un dato importado se informa que quedará protegido.
- La revisión del preview distingue los cambios protegidos.
- El detalle de competición incluye historial resumido y colapsable de importaciones, con conteos reales y trazabilidad secundaria.

### Corrección Provider → Hybrid

La validación visual y la validación imperativa de `ProviderBindingPanel` no coincidían. El botón quedaba habilitado para un cambio de modo sobre la misma vinculación, pero `save()` retornaba silenciosamente por la condición `binding && !replace`, aunque no existiera reemplazo de proveedor o competición externa.

El formulario ahora:

- usa `form` y un botón nativo `type="submit"`;
- deriva habilitación y validación de una sola comparación de identidad externa;
- exige `replaceExisting` únicamente cuando cambia proveedor o competición externa;
- conserva provider y external competition al alternar Provider/Hybrid;
- muestra estado sin cambios, validación, carga, éxito y error;
- bloquea envíos duplicados mediante `isLoading` y la guarda `busy`;
- conserva la confirmación explícita al cambiar a Manual.

El backend ya actualizaba el modo del binding activo sin duplicar historial. La prueba de persistencia ahora también recupera el binding por HTTP después del cambio.

### Sistema global de botones

Tailwind CSS `4.3.3` continúa integrado mediante `@tailwindcss/vite`; no se agregó otra configuración. `tokens.css` es la única fuente de los nuevos tokens semánticos y los expone a Tailwind v4 mediante `@theme static`:

- `--button-primary-*`: dorado sólido y texto inverso.
- `--button-secondary-*`: superficie morada/gris sólida y texto claro.
- `--button-danger-*`: rojo oscuro sólido y texto claro.
- `--button-disabled-*`: superficie y texto atenuados.
- `--button-focus-ring`: foco semántico de alto contraste.

`Button` y `buttonClassName` consumen exclusivamente las utilidades semánticas correspondientes. `secondaryFilled` y `quiet` permanecen como aliases de compatibilidad, pero las acciones renderizan el mismo tratamiento secundario sólido. Icon buttons, tabs, toggles, checkboxes y enlaces editoriales conservan sus patrones especializados.

Los módulos CSS heredados de proyectos, review, datos manuales, marca e importaciones consumen los mismos tokens durante la migración incremental; no se introdujo una segunda paleta ni una nueva librería.

## Compatibilidad

- La migración es aditiva y preserva las temporadas importadas de La Liga y Premier League.
- El backfill usa mappings existentes para recuperar la procedencia conocida.
- Las competiciones manuales no requieren provider binding.
- Review, aprobación, exportación y generación de contenido no se modifican.

## Escenarios cubiertos

- Edición manual sin proveedor.
- Importación Provider e Hybrid.
- Edición manual de un resultado importado y protección del campo.
- Nuevo preview que conserva el valor protegido.
- Aceptación explícita del proveedor y retiro de protección.
- Persistencia de eventos de proveedor, edición manual y resolución.
- Distinción entre marcador ausente y `0-0`.
- Migración, esquema, contratos HTTP y OpenAPI.
- Provider → Hybrid e Hybrid → Provider sin reemplazar el binding.
- Persistencia del modo tras volver a consultar el backend.
- Error recuperable, loading y prevención de doble envío.
- Provider/Hybrid → Manual con confirmación.
- Variantes Primary, Secondary, Danger, Disabled y Loading del botón compartido.

## Limitaciones y decisiones pendientes

- No existe identidad de usuario autenticada; no se inventa un autor y los eventos quedan sin `actorId`.
- La interfaz detallada se incorpora primero en partidos/resultados. El endpoint permite extenderla a las demás entidades sin cambiar persistencia.
- Retirar protección **sin** aceptar el proveedor no se ofrece todavía. Debe decidirse si el valor local actual se convierte en baseline o sigue siendo divergente; quitar solo el flag sería engañoso porque el siguiente preview volvería a detectar conflicto. Hoy las decisiones seguras son conservar local/protegido o aceptar proveedor.
- La trazabilidad es específica del módulo deportivo, no una auditoría genérica.

## Estado visual derivado de jornadas

El estado de presentación de una jornada no se persiste: se deriva de los estados locales de sus partidos ya
cargados por la pantalla de temporada.

- **Finalizada:** todos sus partidos están `finished`.
- **Por jugar:** todos sus partidos están `scheduled`, independientemente de que tengan fecha o marcador.
- **En curso:** existe un `in_progress`, hay una mezcla de finalizados y pendientes, o existe algún partido
  `postponed`/`cancelled` que todavía impide cerrar la jornada.
- **Sin partidos:** no contiene encuentros.

Un partido cancelado no cuenta como finalizado. El dominio local no admite un estado `suspended`; football-data.org
lo conserva como advertencia/registro no aplicable en la normalización en lugar de inventar una equivalencia local.
Las fechas pasadas y los marcadores no se utilizan para inferir el estado deportivo.

El listado de jornadas dentro de una fase ofrece tabla/cards y filtro por estado. Las jornadas directas reutilizan
el mismo indicador y filtro. El detalle muestra el badge y el resumen `N de M partidos finalizados`. Las variantes
de `Badge` consumen los tokens semánticos existentes: `success` (verde), `warning` (dorado), `info` (azul) y
`neutral` (gris). Una edición manual actualiza el estado React de `matches`; una importación confirmada se refleja
al navegar a la temporada con los datos persistidos, sin polling adicional.

## Validación manual sugerida

1. Abrir un partido importado de una competición Hybrid y revisar su procedencia.
2. Editar fecha, estado o marcador; confirmar `Modificado manualmente · Protegido`.
3. Generar otro preview y verificar que conserva el valor local por defecto.
4. Seleccionar aceptar proveedor, confirmar y comprobar que aplica el valor externo y retira la protección.
5. Abrir el detalle de competición y expandir el historial de importaciones.
6. Editar datos de una competición Manual y confirmar que funciona sin proveedor.
7. Abrir una fase con jornadas finalizadas, activas, programadas y vacías; alternar Tabla/Cards y cada filtro.
8. Abrir una jornada, cambiar un partido programado a finalizado y comprobar que el indicador y el conteo cambian
   sin recargar la página.

No se ejecutan E2E ni pruebas visuales automatizadas conforme a PD-UI-21.
