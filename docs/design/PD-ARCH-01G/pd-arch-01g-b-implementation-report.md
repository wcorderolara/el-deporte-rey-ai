# PD-ARCH-01G-B — Informe de implementación: propuestas visuales con la API de imágenes de OpenAI

## Estado

**Aceptada por el Product Owner el 2026-11-06** y cerrada con un commit en `work/PD-ARCH-01G-B` (base
`395a2735948d6755a4e02e2a411491dbde03293f`, cierre de PD-ARCH-01G-A). No se hizo merge, push ni deploy. No se
implementó 01G-C ni 01G-D, no se crearon plantillas estructuradas, y no se modificó el ETL deportivo, la procedencia, el
motor de renderizado, la revisión ni la exportación de carruseles.

Antes del cierre se comprobó que PD-27 está registrada en `.orchestrate/source-of-truth.md` con los límites y
autorizaciones aprobados, y se repitieron las verificaciones de la sección 10 sobre el estado final, con los mismos
resultados.

Las pruebas automatizadas no hicieron ninguna llamada real a OpenAI: el adaptador se probó sobre un cliente de salida
simulado, con la clave sintética de las pruebas y sin abrir conexiones (el guardia de red de Vitest falla cualquier
conexión no local).

## Investigación técnica (documentación oficial, consultada el 2026-11-05)

Fuentes: guía «Image generation» y referencia de la API (`/images/generations`, `/images/edits`) en
`developers.openai.com`, guía «Image prompting», página de precios `developers.openai.com/api/docs/pricing` (la de
`platform.openai.com/pricing` respondió 403 a la consulta automática) y guía de códigos de error.

| Tema | Hallazgo |
| --- | --- |
| Modelos actuales | GPT Image 2.6 (Sunburst, Flare), GPT Image 2.5 (`gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`), `gpt-image-2`. Anteriores: GPT Image 1.5, 1 y 1 Mini. `gpt-image-1` fue retirado el 23 de octubre de 2026. La guía recomienda GPT Image 2.5 para integraciones nuevas: Flare para generación rápida y Sunburst para edición precisa. |
| API | Image API: `POST /v1/images/generations` (una imagen a partir de un prompt) y `POST /v1/images/edits` (con 1 a 16 imágenes de entrada, en JSON `images: [{ image_url }]` con URL `data:` en base64). La Responses API se orienta a experiencias conversacionales; no hace falta aquí. |
| Tamaños | Estándar: `1024x1024`, `1536x1024`, `1024x1536`. GPT Image 2 y 2.5 aceptan `WIDTHxHEIGHT` arbitrario: múltiplos de 16, proporción entre 1:3 y 3:1, máximo 3840 px por lado, entre 655 360 y 8 294 400 píxeles; por encima de 2560x1440 es experimental. |
| Calidad | `low`, `medium`, `high`, `auto`; `xhigh` y `max` solo en 2.5. Más calidad aumenta tiempo y costo. |
| Formatos | Salida `png` (por defecto), `jpeg`, `webp`, y `svg`/`gif` en 2.6. Entradas de referencia: imágenes (PNG en los ejemplos), menos de 50 MB. |
| Respuesta | `data[0].b64_json`; `usage` con `input_tokens`, `input_tokens_details.text_tokens` e `image_tokens`, `output_tokens` y `total_tokens`. No hay URL ni `revised_prompt` en los modelos GPT Image. |
| Errores | 401 (clave o permisos), 403 (región), 429 (límite de solicitudes, o saldo y límites de gasto: `insufficient_quota`, `credit_balance_exhausted`, `*_spend_limit_exceeded`), 500 y 503. Moderación: `error.code = moderation_blocked`. No reintentar errores de cuota ni de usuario. |
| Cuenta | Puede ser necesaria la API Organization Verification para usar los modelos GPT Image. |
| Latencia | Los prompts complejos pueden tardar hasta 2 minutos. |
| Precios (por millón de tokens) | 2.5 Flare/Sunburst y GPT Image 2: texto de entrada 5 USD, imagen de entrada 8 USD, imagen de salida 30 USD. Solo GPT Image 2 (y anteriores) tiene una tabla publicada de costo por imagen (por ejemplo `1024x1536`: baja 0,005, media 0,041, alta 0,165 USD). |

## Decisiones

| Tema | Decisión |
| --- | --- |
| Modelo por defecto | `gpt-image-2.5-flare`, configurable. También se configuran `gpt-image-2.5-sunburst` y `gpt-image-2`. Ningún modelo está fijado en código; la cuenta puede no tener acceso a alguno, y el botón «Comprobar acceso al modelo» lo consulta. |
| API | Image API: `generations` sin imágenes de entrada, `edits` cuando hay referencias, una base transformable o una propuesta de origen. Una solicitud por imagen (`n: 1`), salida PNG, moderación por defecto del proveedor. |
| Políticas | `protected` nunca se envía (solo reserva su espacio), `reference_only` solo como referencia de estilo, `reusable` como referencia o espacio reservado, `transformable` también como base. Detalle en «Políticas». |
| Costo | Sin precios en el código: precios y costos publicados en la configuración, con su fuente y fecha. Estimación previa solo con un costo por imagen publicado; costo real calculado con el uso informado. |
| Estados | Los que registra el servidor: Pendiente, Preparando referencias, Enviando solicitud, Generando, Guardando resultado, Completada, Fallida. Sin porcentajes. |
| SSE | Se reutiliza el flujo de eventos de las operaciones de importación (`platform/http/sse.ts`, movido sin cambios desde `competitions`). |

El encargo de 01G-B es la decisión del Product Owner que autoriza un proveedor de IA alojado y el costo asociado bajo
estos controles (SC-03, SC-05 y PD-22 de la fuente de verdad lo exigían antes de introducirlo). La revisión de seguridad
de SC-05 se hizo el 2026-11-06 y el Product Owner registró PD-27 (ver «Limitaciones»).

## Ajustes tras la primera validación del Product Owner (2026-11-05)

Diagnóstico de las dos primeras generaciones reales, hecho con una copia de solo lectura de la base:

- **Walter y Albert no se enviaron.** La base confirma que solo viajaron el logo, como espacio reservado (sin enviar su
  imagen), y la referencia «ejemplo-thumbnail».
- **Las personas no venían de esos recursos.**
  - Primer intento: la referencia «ejemplo-thumbnail» muestra a dos presentadores, y el modelo los copió.
  - Segundo intento: no se envió ninguna imagen. El estilo «MR BEAST» llevó al modelo a inventar caras de reacción.
  - El prompt 1 solo prohibía personas reales.
- **El logo y Ketsi no aparecían.** Solo se reservaba su espacio, así que la propuesta no los mostraba, aunque las
  instrucciones y la nota de revisión pedían usarlos.

Cambios:

- **Prompt `edr-design-prompt/2`:**
  - sin personas de ningún tipo (caras, presentadores, jugadores, aficionados, siluetas o personajes);
  - las referencias de estilo y los nombres de estilo aportan solo color, luz, texturas y energía;
  - nunca personas, logos, emblemas ni textos de la referencia;
  - cada original reservado tiene una zona exacta en porcentajes.
- **Capas originales** (`layers.ts`, migración 0026):
  - «Colocar el original en el diseño» dibuja localmente el archivo original, sin modificarlo, en su zona fija:
    logotipo arriba al centro, mascota abajo a la derecha, otro elemento abajo a la izquierda;
  - se admite un original por zona;
  - el fondo generado se guarda aparte (`getDesignProposalBackground`) y es la base de las variantes, así que el logo
    nunca se envía a la IA;
  - el detalle lista las capas con su caja en píxeles y permite ver solo el fondo.
- **Eliminar propuestas** (`deleteDesignProposal`):
  - se pide confirmación desde la lista o desde el detalle;
  - la eliminación es lógica: deja de aparecer y no se puede revisar ni usar para variantes;
  - la fila, las decisiones y los archivos se conservan;
  - se rechaza mientras se genera una variante de esa propuesta.
- **Textos del diálogo:** los usos de cada recurso se nombran por lo que hacen («Colocar el original en el diseño»,
  «Inspiración de estilo (se envía a la IA)»). La revisión separa los originales que se colocan sin IA de las imágenes
  que se envían.

## Dos modos de generación (decisión del Product Owner, 2026-11-05)

El prompt maestro del Product Owner se cortaba en silencio a 2.000 caracteres (el campo tenía `maxLength`) y aplanaba
sus saltos de línea. Además, chocaba con las reglas fijas del modo guiado: pedía textos, a Ketsi en una pose nueva, el
logo integrado por la IA y a los presentadores. El Product Owner eligió tener dos modos.

| | Diseño de plantilla (guiado) | Prompt propio (inspiración) |
| --- | --- | --- |
| Prompt | `edr-design-prompt/3`: el del servidor, con las reglas de marca; tus instrucciones van dentro, con sus líneas | `edr-own-prompt/3`: tu texto tal cual; solo se agrega qué es cada imagen enviada y las zonas de los originales colocados |
| La IA hace | solo el fondo y los espacios vacíos | la imagen completa, con textos y personajes si los pides |
| No permite | textos, personas, logos | enviar recursos «Protegidos» (logo, Ketsi oficial) |
| Ketsi | se coloca el original | para que la IA lo dibuje: una copia de Ketsi «Transformable» en Mi marca, enviada como imagen |
| Resultado | base de plantilla (01G-C) | imagen plana; si deja vacías las zonas de datos podrá ser base de plantilla (se decide en 01G-C) |

- **Límite de instrucciones:** 12.000 caracteres en los dos modos, con contador. Un texto más largo se rechaza; nunca se
  corta.
- **Migración 0027 (aditiva):** `mode`, `instructions_text` e `inherited_text`. Las columnas cortas quedan para las filas
  anteriores.
- **Contrato:** `DesignMode` en la entrada, la estimación, la generación, la propuesta y el detalle.
- **En las variantes:** se hereda el modo de la propuesta de origen.
- **Interfaz:**
  - selector de modo con su explicación y la tabla «¿Qué modo uso?» (en la sección y en el diálogo);
  - textos de cada uso según el modo, y aviso sobre los recursos protegidos;
  - columna, etiqueta y filtro de modo en la biblioteca.

## Variantes del prompt propio (validación del Product Owner, 2026-11-06)

Al solicitar cambios sobre una propuesta de prompt propio, la variante salió casi idéntica (solo cambió el logo). Causa
encontrada en una copia de la base:

- **Nota cortada:** la nota «Qué debe cambiar» tenía `maxLength=500`. El Product Owner pegó un prompt completo y el
  navegador lo cortó en silencio a 500 caracteres.
- **Prompt incompleto:** en el modo prompt propio, la variante enviaba solo esa nota cortada y la imagen anterior, con
  «apply the prompt above to it». No incluía el prompt original. Ese texto describía lo que ya había en la imagen, así
  que el modelo la devolvió casi sin cambios.

Cambios:

- **Nota:** se quitó el `maxLength` y se agregó un contador. Pasados 500 caracteres aparece un error; la nota ya no se
  corta. El texto de ayuda pide describir solo lo que cambia.
- **Prompt de la variante (prompt propio):** depende del punto de partida, que elige el operador.
  - «Editar la imagen anterior» (por defecto): el campo empieza solo con la nota de cambios. La imagen ya contiene el
    prompt original, y repetirlo contradice los cambios (por ejemplo, pide «0 - 0» cuando el cambio es dejar el
    marcador vacío). Se envía con la imagen anterior como imagen 1.
  - «Generar desde cero con este prompt»: el campo empieza con el prompt completo, seguido de `CAMBIOS SOLICITADOS:` y
    la nota, para que el operador los integre. No se envía la imagen ni `parentProposalId`.
  - Si el operador no editó el texto, al cambiar de opción cambia el texto inicial; si lo editó, se conserva.
  - En las dos opciones el texto se envía tal cual y no se hereda texto aparte (`inheritedInstructions` es nulo).
- **`edr-own-prompt/3`:** la imagen anterior se describe como la versión a editar. El texto pide aplicar todos los
  cambios, conservar lo demás y no devolverla igual. La versión 2 no llegó a usarse en una generación.
- **Nota de revisión de 1.200 caracteres** (pedido del Product Owner): antes admitía 500.
  - **Migración 0028 (aditiva):** agrega `design_proposals.decision_note_text` y `design_proposal_decisions.note_text`.
    Las columnas de 500 quedan para las filas anteriores y se leen cuando las nuevas están vacías.
  - **Contrato:** la nota de una decisión, `decisionNote` y la nota del historial admiten hasta
    `MAX_DESIGN_DECISION_NOTE = 1200`.
  - **Interfaz:** el contador y el error usan el mismo límite.
- **Modo guiado:** sin cambios.
- **Pruebas:**
  - integración, +1: variante de prompt propio con el prompt completo, una sola vez y sin herencia;
  - web, +1: nota sin cortar con contador, prompt completo más los cambios, y las dos opciones de punto de partida.

## 1. Resumen funcional

En **Plantillas** hay una sección nueva, **Propuestas visuales con IA**, separada de las plantillas del motor:

1. **Crear diseño con IA** abre un diálogo: tipo de contenido (Previa individual, Calendario, Próximos partidos,
   Resultados), formato (1:1, 4:5, 9:16), modelo, calidad, cantidad (hasta el máximo configurado), estilo (sugerencias o
   texto propio), instrucciones, y los recursos activos de Mi marca con el uso de cada uno, permitido por su política.
   Nada se selecciona automáticamente.
2. **Revisar alcance y costo** pide al servidor el alcance: modelo, tamaños, adaptación local, qué recursos se envían y
   cuáles solo reservan su espacio, las instrucciones efectivas para la IA, la estimación de costo (o el aviso de que no
   hay una confiable) y el uso del día.
3. La generación solo empieza tras marcar la confirmación de costo. El botón se desactiva al enviar, y una clave de
   solicitud evita una segunda generación por doble clic o reintento.
4. El progreso muestra los estados que confirma el servidor, la imagen en curso y las propuestas guardadas.
5. La biblioteca de propuestas tiene Tabla (por defecto) y Cards, con filtro por estado, miniatura, nombre, tipo,
   formato, fecha, estado, modelo y recursos usados. Se pueden comparar de 2 a 4 propuestas lado a lado.
6. El detalle muestra la imagen, sus datos, los recursos usados con su papel, el prompt enviado, el costo calculado y
   el historial de revisión. Desde ahí se aprueba, se rechaza o se solicitan cambios (con nota obligatoria), y se
   **solicita una variante**: la propuesta es la base y se conservan sus instrucciones.

Una propuesta aprobada sigue siendo una propuesta: no crea ni cambia plantillas, recursos de marca ni proyectos.

## 2. Arquitectura

```
web: Plantillas → DesignProposalsSection → designApi ──HTTP /api/v1/design/*──┐
server: modules/design (routes, service, prompt, policies, sizes, cost, image, repository)
          ├─ modules/brand: BrandAssetService (archivos verificados), brandContextOf (identidad), BrandFileStore
          ├─ providers/images: ImageGenerationProvider ← openai-adapter | disabled-adapter
          │      └─ cliente de salida de imágenes (lista propia, límites IMAGE_EGRESS_LIMITS)
          └─ platform/http: streamEvents (SSE), HttpProblem
```

- **Puerto `ImageGenerationProvider`** (`providers/images/port.ts`): `capabilities()`, `checkModelAccess()`,
  `generate()` con errores cerrados. El servicio no conoce la forma de las respuestas de OpenAI ni usa un SDK: el
  adaptador usa el cliente de salida de la plataforma, como el adaptador de texto existente.
- **Cliente de salida propio**: una segunda instancia de `platform/net` con su propia lista (solo el origen
  configurado de imágenes) y límites mayores (respuesta de 24 MiB, 300 s por solicitud, cuerpo de 48 M caracteres).
  El cliente por defecto (deportes y texto) conserva sus límites revisados y no puede llegar a OpenAI.
- **Contexto de marca**: el prompt usa `brandContextOf` (nombre, descripción, paleta con su uso, tipografías,
  preferencias). Los archivos se leen con `BrandAssetService.readFile`, que verifica el hash.
- **Separación contenido/diseño**: el prompt pide solo la composición, sin texto, cifras, escudos reales ni marcador, y
  deja vacías las zonas para equipos, emblemas, fecha y hora, competición y marca. El motor local insertará los datos
  (01G-C).

## 3. Modelo OpenAI seleccionado

`gpt-image-2.5-flare` por defecto, con tamaños exactos: 1:1 `1024x1024`, 4:5 `1024x1280`, 9:16 `1008x1792`. En
`config/dev-images.config.json` también están `gpt-image-2.5-sunburst` (edición precisa) y `gpt-image-2` (el único con
costo por imagen publicado, así que permite estimar antes de generar). Las calidades configuradas son baja, media y
alta.

Para un modelo sin tamaños libres, el servidor pide `1024x1024` o `1024x1536` y adapta localmente con resvg, con un
recorte centrado y sin deformar (4:5 queda en `1024x1280`, 9:16 en `864x1536`). Si el proveedor devuelve otro tamaño,
se adapta igual.

## 4. Integración

- `POST {baseUrl}/images/generations` o `/images/edits`, con `Authorization: Bearer` y la clave leída de
  `EDR_IMAGE_API_KEY` en el momento de la llamada. Cuerpo: `model`, `prompt`, `n: 1`, `size`, `quality`,
  `output_format: png` e `images` (en orden: la base primero, después las referencias).
- `GET {baseUrl}/models/{id}` para comprobar el acceso; no genera nada ni tiene costo.
- Concurrencia: como máximo `maxConcurrentRequests` solicitudes en curso por adaptador, y una generación activa a la
  vez por límite del servicio.
- Sin reintentos automáticos: un 429 guarda `Retry-After` y la generación termina en `RATE_LIMITED`. Un timeout avisa
  de que la solicitud pudo cobrarse.
- La imagen recibida se valida como no confiable: firma PNG o JPEG, cabecera (máximo 4096 px) y decodificación con
  resvg. Luego se adapta si hace falta y se guarda.

## 5. Contratos

Diez operaciones nuevas (etiqueta `design`), en Zod (`packages/contracts/src/http/design.ts`) y OpenAPI:

| Operación | Ruta | Notas |
| --- | --- | --- |
| `getDesignCapabilities` | `GET /design/capabilities` | estado (`disabled`, `missing_api_key`, `ready`), modelos, roles por política, límites y uso |
| `checkDesignModelAccess` | `POST /design/capabilities/check` | acceso de la cuenta al modelo |
| `estimateDesignGeneration` | `POST /design/estimates` | alcance, prompt efectivo y estimación; no guarda ni envía nada |
| `createDesignGeneration` | `POST /design/generations` | `requestKey` y `confirmCost: true`; 202 con `statusUrl` y `eventsUrl` |
| `getDesignGeneration` | `GET /design/generations/{generationId}` | estado registrado |
| `streamDesignGenerationEvents` | `GET /design/generations/{generationId}/events` | SSE reanudable |
| `listDesignProposals` | `GET /design/proposals` | biblioteca |
| `getDesignProposal` | `GET /design/proposals/{proposalId}` | detalle con prompt, referencias, uso, costo, decisiones y variantes |
| `getDesignProposalFile` | `GET /design/proposals/{proposalId}/file` | PNG o JPEG con CSP aislada y sin caché |
| `decideDesignProposal` | `POST /design/proposals/{proposalId}/decisions` | aprobar, rechazar o solicitar cambios |

- **Solicitar variante** es `createDesignGeneration` con `parentProposalId`.
- **Componentes nuevos:** 18.
- **Códigos de problema nuevos:** `IMAGE_PROVIDER_UNAVAILABLE` (503), `DESIGN_REFERENCE_REFUSED` (409) y
  `GENERATION_LIMIT_REACHED` (429).
- **Códigos de error cerrados de una generación:** `DesignGenerationErrorCode`.
- **Lo que nunca aparece en el contrato:** clave, URL del proveedor, ruta de archivo ni respuesta del proveedor.
- Los cambios son aditivos dentro de v1 (PD-11).

## 6. Persistencia

Migración `0025_design_proposals.sql`, solo aditiva:

- `design_generations`:
  - la solicitud: tipo, formato, estilo, instrucciones e instrucciones heredadas, calidad y cantidad;
  - proveedor, modelo, tamaño pedido, tamaño de salida y adaptación;
  - versión del prompt y prompt efectivo;
  - referencias, con su papel, la política que tenían y si se enviaron;
  - estimación mostrada, estado, imagen en curso, completadas, uso sumado y costo calculado;
  - error cerrado y mensaje fijo, `Retry-After` y fechas;
  - `request_key` UNIQUE y el hash de la solicitud.
- `design_generation_events`: el registro del SSE, solo de agregado.
- `design_proposals`: una imagen por fila, con su archivo, hash, tamaño, dimensiones, uso, costo y estado de revisión.
- `design_proposal_decisions`: el historial de decisiones, solo de agregado.

Los archivos van a `<dataDir>/design-proposals/<id>.png|jpg`, mediante el mismo almacén confinado de marca
(`BrandFileStore`, ahora con un directorio y un tope por instancia). Nunca hay base64 en SQLite ni se sobrescribe un
archivo; una variante es una fila y un archivo nuevos. Al arrancar, una generación interrumpida queda `failed` con
`INTERRUPTED`; las propuestas ya guardadas se conservan.

## 7. Componentes UI

- `features/design/`:
  - `DesignProposalsSection`: estado, uso, comprobación de acceso, progreso, biblioteca, comparación y detalle;
  - `CreateDesignDialog`: configuración, recursos por rol, revisión de alcance y costo, y confirmación;
  - `GenerationProgress`: SSE más el estado del servidor;
  - `ProposalDetailDialog`: revisión y variantes;
  - `CompareDialog`;
  - `designApi` y `copy`.
- `Modal` admite `size="lg"` (cambio aditivo).
- La página de Plantillas separa «Propuestas visuales con IA» de «Plantillas del motor».
- Tokens y primitivas existentes:
  - Button: dorado principal, secundario y rojo de peligro para Rechazar;
  - Badge, Alert, Card, Select, Textarea, ViewModeToggle, EmptyState, LoadingState, ErrorBanner.

## 8. Seguridad

- **Clave:**
  - existe solo en el servidor (`EDR_IMAGE_API_KEY` en `.env.local`);
  - se borra de `process.env` al construir el entorno inyectado y se lee en cada llamada;
  - se envía solo en `Authorization` al origen configurado.
  - Nunca está en la configuración, la base, los logs, las respuestas ni el navegador; hay pruebas de cada caso. Las
    pruebas usan la clave sintética y la configuración de pruebas la elimina.
- **Salida a red:**
  - el cliente de imágenes solo puede llegar a `https://api.openai.com` (lista propia, solo `https:`, sin
    redirecciones, deadline y tope por respuesta);
  - el cliente deportivo y el de texto no pueden llegar a OpenAI;
  - las configuraciones por defecto y de desarrollo no tienen URL de proveedores (reglas de neutralidad existentes):
    el adaptador solo se activa con `config/dev-images.config.json`.
- **Políticas aplicadas en el servidor:**
  - solo recursos activos y no eliminados, una sola vez cada uno;
  - una sola base;
  - los recursos `protected` nunca se envían;
  - se vuelve a comprobar al leer los archivos.
- **Errores:**
  - del cuerpo de error del proveedor solo se comparan `error.code` y `error.type` con listas cerradas;
  - el mensaje del proveedor nunca se guarda, registra ni muestra;
  - los logs llevan identificadores, estados, códigos, duraciones, tokens y costo, pero nunca el prompt, las
    instrucciones ni la imagen.
- **Archivos:**
  - la imagen recibida se trata como no confiable (firma, cabecera, decodificación);
  - se sirve tras una consulta a la base y una verificación de hash, con `nosniff`, CSP `sandbox` y `no-store`.
- **Protección local:** las rutas nuevas heredan Host, Origin, `X-EDR-Client` y el tipo de contenido (pruebas de
  protección de solicitudes).

## 9. Costos

- **Controles:**
  - confirmación explícita (`confirmCost: true` y la casilla);
  - cantidad máxima por solicitud;
  - una generación a la vez;
  - protección contra doble clic: botón desactivado y clave de solicitud con idempotencia en el servidor;
  - límite diario de imágenes. Una generación fallida cuenta cada solicitud que llegó al proveedor (pudo cobrarse) y
    nunca menos de lo que produjo;
  - límite de gasto mensual sobre el costo calculado (`monthlySpendLimit`, 10 USD en la configuración de desarrollo).
    Sin estimación publicada, se comprueba con la reserva por imagen (`spendReservePerImage`: 0.06, 0.12 y 0.25 por
    calidad). Sin reserva, sin precios o sin gasto calculable, la solicitud se rechaza (PD-27). Es un límite operativo,
    no uno garantizado: la solicitud en curso puede pasarlo;
  - ningún límite sube solo: cambian únicamente en la configuración;
  - sin reintentos automáticos.
- **Registro:** modelo, cantidad pedida y generada, uso en tokens por imagen y por generación, y costo calculado cuando
  hay precios configurados.
- **Estimación:** solo con un costo por imagen publicado (GPT Image 2). Para 2.5 se dice claramente que no hay una
  estimación confiable. La estimación se presenta como tal, nunca como costo definitivo, y los precios muestran su
  fuente y fecha.
- **Ninguna llamada a OpenAI fuera de una acción tuya:** ni en instalación, migraciones, pruebas, build ni arranque.
  Solo envían algo una generación confirmada y la comprobación de acceso.

## 10. Pruebas

| Suite | Archivo | Cobertura |
| --- | --- | --- |
| Integración | `modules/design/design.int.test.ts` (34) | Proveedor deshabilitado y sin clave; capacidades sin clave ni URL; comprobación de acceso; alcance, prompt sin datos deportivos y estimación; tamaños flexibles y recorte; políticas (protegido, solo referencia, transformable, reutilizable, inactivo, eliminado, repetido, dos bases); validación; confirmación obligatoria; estados registrados, archivos, uso y costo; referencias enviadas en orden como `data:` y nunca las protegidas; idempotencia y clave reutilizada; concurrencia y límite diario; límite mensual; 13 fallos del proveedor con códigos cerrados y sin su texto; propuestas conservadas tras un fallo sin reintento; logs sin clave, prompt ni imagen; decisiones solo de agregado sin tocar plantillas ni recursos; variantes con la base y las instrucciones heredadas; recuperación tras reinicio. |
| Unitarias | `providers/images/openai-adapter.test.ts` (10) | Endpoints y cuerpos, clave solo en `Authorization`, nada sin clave, concurrencia, comprobación de acceso, fallos de red, estados y marcadores de error, análisis estricto de la respuesta, opciones sin eco de valores, adaptador deshabilitado. |
| Unitarias | `modules/design/design.test.ts` (6), `platform/net/*.test.ts` (+5), `platform/config/load.test.ts` (+1) | Tamaños, roles, prompt, costo; lista y límites del cliente de imágenes; configuración `dev-images` igual a la de desarrollo salvo el adaptador. |
| Contrato | `test/contract/*` | Paridad Zod/OpenAPI de los 18 componentes y cuerpos en línea, conteos (113 operaciones, 86 rutas, 51 mutadoras, 161 esquemas), cambios registrados del documento, protección local, un escenario servido de las 10 operaciones con el proveedor simulado y la neutralidad de proveedores en las respuestas. |
| Web | `features/design/*.test.ts(x)` (15), `TemplatesPage.test.tsx` (+1) | Estado del proveedor, uso, acceso; roles por política y solo recursos activos; alcance, costo, confirmación y una sola creación con clave; estimación publicada y rechazo del servidor; texto inválido; progreso confirmado por el servidor y recarga; tabla, cards y filtro; comparación; decisiones y nota obligatoria; variante; vacío y error; separación de las plantillas. |

Resultados:

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto. |
| ESLint (`--max-warnings 0`, todo el repositorio) | Correcto. |
| Prettier | Correcto en los archivos de la fase. `prettier --check .` solo señala los 3 archivos del servidor que ya venían así (`errors.ts`, `respond.ts`, `import-preview.int.test.ts`). |
| `vitest --project unit` | 1740 pruebas, todas correctas. |
| `vitest --project integration` | 650 pruebas, todas correctas (incluye persistencia y migraciones 0025 a 0028). |
| `vitest --project contract` | 1974 pruebas, todas correctas (115 operaciones, 87 rutas, 52 mutadoras, 162 esquemas). |
| `vitest --project unit-web` | 611 pruebas: 609 correctas y las 2 fallas previas de breadcrumbs (`App.test.tsx`, `ReviewPage.test.tsx`). |
| `npm run build` | Correcto. |
| `git diff --check` | Sin observaciones. |
| `scripts/security-checks.mjs secret-scan` y `hygiene` | PASS. |

No se ejecutaron E2E ni automatización de navegador.

## 11. Limitaciones

- **Revisión de seguridad (2026-11-06):** un revisor independiente revisó los cambios sin commit en modo de solo
  lectura, sin red ni datos reales.
  - **Resultado:** no encontró vulnerabilidades explotables.
  - **Controles verificados:** la clave solo en el servidor y en `Authorization`; salida solo al origen configurado; los
    recursos protegidos nunca se envían; archivos confinados con verificación de hash; validación estricta y paridad
    Zod/OpenAPI; protección local en las rutas nuevas.
  - **F2 (baja), corregida:** el límite diario no contaba las solicitudes fallidas que pudieron cobrarse.
  - **F3 (baja), corregida (PD-27, condición 4):** cuando no hay estimación publicada, el límite mensual se comprueba
    con una reserva conservadora por imagen y calidad (`spendReservePerImage`). En desarrollo son 0.06 en baja, 0.12 en
    media y 0.25 en alta; lo observado en calidad alta es cerca de 0.08 por imagen. La solicitud se rechaza cuando no
    hay estimación ni reserva, cuando el modelo no tiene precios o cuando el gasto del mes no se puede calcular. Con
    una generación a la vez, el presupuesto es un límite operativo: puede pasarse por la solicitud en curso si su
    costo real supera la reserva (PD-27, condición 3).
  - **F1 (cumplimiento), resuelta:** el Product Owner autorizó registrar **PD-27** el 2026-11-06. PD-27 es la
    excepción a PD-22 y SC-03 para la API de imágenes de OpenAI, solo en 01G-B y sus validaciones manuales, y la
    decisión de aislamiento que pide SC-05 (procesamiento en el servidor, hasta 24 MiB y 300 s). Se registró en
    `.orchestrate/source-of-truth.md`: fila PD-27, y nota de enmienda en PD-22, SC-03 y SC-05, sin borrar el texto
    anterior. La sección 10 de ese documento pide una tarea del arquitecto; la entrada lo indica en su fuente.
- **Fuente de verdad, actualizada en parte:** solo se registró PD-27. `.orchestrate/source-of-truth.md` sigue sin
  reflejar el resto de las fases PD-ARCH. Su hash del contrato (sección 6, `PRJ-CONTRACT-ID`) ya no coincidía con el
  archivo antes de 01G-B, porque las fases PD-ARCH anteriores cambiaron el contrato; se actualiza al cierre del bloque. Las
  decisiones de 01G quedan en el [índice de la fase](./README.md).
- **Verificación con la API real:** las pruebas automáticas no llaman a la API real. El Product Owner la validó a mano
  el 2026-11-05 y el 2026-11-06, con generaciones reales en `gpt-image-2.5-flare` y `gpt-image-2.5-sunburst`, calidades
  media y alta, y 1 o 2 propuestas.
  - **Probado:** los dos modos, las variantes sobre la imagen anterior y una imagen de referencia enviada como base.
  - **Confirmado:** los campos de `usage` (`input_tokens_details`, `output_tokens_details`) y el costo calculado. Por
    ejemplo, USD 0.118 por 2 imágenes en calidad alta.
  - **Sin confirmar:** los códigos de error, porque no se produjo ningún fallo real.
- **Estimación previa no disponible para 2.5:** OpenAI no publica un costo por imagen para GPT Image 2.5. El costo se
  calcula después, con el uso informado.
- **«Enviando solicitud» casi no se ve:** el servidor lo registra mientras arma la solicitud y pasa a «Generando»
  cuando la solicitud está con el proveedor. El Image API sin streaming no confirma otro hito intermedio.
- **Sin cancelación:** no se puede cancelar una generación en curso. Las imágenes se piden una por una y lo ya
  guardado se conserva.
- **Aprobar no guarda en Mi marca:** una propuesta aprobada no se convierte en recurso de marca ni en plantilla. La
  conversión a plantilla estructurada es 01G-C.
- **Imágenes de referencia:** se envían completas (hasta 5 MB cada una en la biblioteca). Una selección que supere el
  tope del cuerpo de la solicitud falla con `INVALID_REQUEST` antes de enviarse.
- **El modelo puede no respetar todo:** puede no cumplir exactamente las zonas vacías ni la ausencia de texto, ni
  mantener la identidad de las referencias. Por eso cada propuesta requiere revisión humana.

## 12. Configurar la API key

1. Crea `.env.local` con permisos de propietario, si no existe: `umask 077 && touch .env.local && chmod 600 .env.local`.
2. Ábrelo en un editor y añade `EDR_IMAGE_API_KEY=` seguido de tu clave de OpenAI. No la pegues en la terminal, en un
   chat ni en un commit.
3. Comprueba que está, sin mostrarla: `grep -c '^EDR_IMAGE_API_KEY=..*' .env.local` (debe dar `1`).
4. Inicia el servidor con la configuración de imágenes: `EDR_CONFIG=config/dev-images.config.json npm run dev`.
5. Tu organización puede necesitar la verificación de OpenAI para los modelos GPT Image.

## 13. Validación manual

1. Inicia como en el punto 12. Al arrancar, la base pasa a la versión 28 (migraciones 0025 a 0028).
2. Abre **Plantillas**.
   - La sección «Propuestas visuales con IA» aparece aparte de «Plantillas del motor», con el uso del día.
   - «¿Qué modo uso?» compara los dos modos.
3. Pulsa **Comprobar acceso al modelo**. Debe indicar si la cuenta puede usar el modelo elegido.
4. **Modo guiado:** pulsa **Crear diseño con IA** y elige «Diseño de plantilla (guiado)».
   - Elige previa individual, 4:5, calidad baja, 1 propuesta, un estilo y unas instrucciones.
   - Pon el logo y Ketsi oficiales en «Colocar el original en el diseño».
   - En **Revisar alcance y costo**, comprueba dos cosas:
     - el logo y Ketsi aparecen en «Se colocan sin IA» y no en «Se envían a la IA»;
     - las instrucciones efectivas llevan las reglas de la marca.
   - Confirma el costo y genera.
5. Observa los estados hasta «Completada» y abre la propuesta.
   - Los originales aparecen como capas; «Ver solo el fondo generado» muestra la imagen sin ellas.
6. **Modo prompt propio, desde cero:** crea un diseño en «Prompt propio (inspiración)».
   - Pega un prompt de más de 2.000 caracteres: el contador lo acepta hasta 12.000 y no lo corta.
   - Envía una imagen de referencia tuya («Transformable») como imagen base.
   - En la revisión, el prompt efectivo es tu texto, seguido solo de `Image 1: "<tu imagen>"`.
7. **Solicitar cambios:**
   - En una propuesta de prompt propio, escribe en «Qué debe cambiar» una nota de hasta 1.200 caracteres.
     - Con 1.201 caracteres aparece un error y no se envía nada.
   - Con «Editar la imagen anterior»:
     - el campo trae solo tu nota;
     - el prompt efectivo termina con «Image 1: the previous version of this design. Edit it: …».
   - Con «Generar desde cero con este prompt»:
     - el campo trae el prompt completo seguido de `CAMBIOS SOLICITADOS:`;
     - no se envía la imagen anterior.
8. **Revisión:** aprueba una propuesta, elimina otra y compara dos o más.
   - La original de una variante no cambia.
9. **Sin efectos colaterales:** comprueba en Mi marca que los recursos no cambiaron.
   - En «Plantillas del motor» no debe aparecer ninguna plantilla nueva.

## 14. Estado Git

- Rama `work/PD-ARCH-01G-B`, base `395a2735948d6755a4e02e2a411491dbde03293f` (commit de cierre de PD-ARCH-01G-A en
  `work/PD-ARCH-01G-A`).
- Cerrada con un commit tras la aceptación del Product Owner del 2026-11-06; su hash queda en el
  [índice de la fase](./README.md). Sin merge, push ni deploy.
