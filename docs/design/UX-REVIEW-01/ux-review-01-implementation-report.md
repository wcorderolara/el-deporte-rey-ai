# UX-REVIEW-01 — Informe de implementación: revisión de contenido

Fecha: 2026-11-10. Rama: `work/PD-ARCH-01G-D`. **Aceptado por el Product Owner el 2026-11-11** y con commit en
`work/PD-ARCH-01G-E` (ver el [índice](./README.md)). No hay merge, push ni despliegue.

## 1. Alcance

Refinamiento de UX/UI de `/projects/:projectId/review`. Se reutilizan las operaciones, los tipos y el estado
existentes. Fuera del frontend solo cambia una cosa, por decisión del Product Owner: se retiró la operación
`setExcludedMatches` del contrato y del servidor (A-6), registrada como PD-31 en la fuente de verdad. No cambian:

- las migraciones ni los datos guardados;
- el resto del servidor y de los contratos (OpenAPI y Zod);
- las reglas de aprobación individual, masiva y final;
- la navegación aprobada en PD-ARCH-01F (rutas, menú y migas).

## 2. Problemas de UX identificados

| # | Problema en la versión anterior |
| --- | --- |
| U-1 | Una sola página larga: carrusel, texto de publicación, aprobación final, copy editorial y detalles del borrador apilados. Había que desplazarse para pasar de la diapositiva a la aprobación final o al copy. |
| U-2 | La diapositiva compartía el espacio con un panel de acciones y la cabecera ocupaba mucho: la imagen no era la protagonista. |
| U-3 | Dos botones de aprobación por diapositiva («Aprobar diapositiva» y «Aprobar y siguiente»). |
| U-4 | «Aprobar todas» siempre visible, aunque ninguna diapositiva fuera elegible. |
| U-5 | La aprobación final era un panel al final de la página, sin confirmación. |
| U-6 | El texto del carrusel (caption) y el copy editorial de 01H estaban en secciones distintas, con dos conceptos de «copy». |
| U-7 | Las validaciones (datos bloqueantes, observaciones, control visual) ocupaban el panel aunque no hubiera nada que hacer. |
| U-8 | El copy editorial: textos en tarjetas pequeñas, pestañas para entregables vacíos y una edición que **se cerraba al guardar aunque el servidor rechazara el cambio** (se perdía el texto). Al cambiar de pestaña se perdía la edición. |
| U-9 | La descarga y el historial estaban dentro del panel de aprobación final, sin las descargas secundarias disponibles. |

## 3. Decisiones

| ID | Decisión |
| --- | --- |
| D-1 | **Una sola ruta con dos modos** («Diseño visual» y «Copy editorial») como pestañas. Los dos paneles quedan montados (el inactivo con `hidden`): la diapositiva seleccionada, las ediciones abiertas y los mensajes sobreviven al cambio de modo. |
| D-2 | **Cabecera persistente:** volver al proyecto, título completo (sin truncar; ajusta en varias líneas si hace falta), tipo de contenido, competición, temporada, fase y jornada, formato real de las diapositivas (`1080 × 1350 px` según la versión) y estado del proyecto. Indicadores compactos: diapositivas aprobadas, copy aprobado, bloqueos y advertencias (esta última solo si hay alguna). Todos derivan del borrador y del paquete editorial mostrados; no hay estado paralelo. |
| D-3 | **Diseño visual en tres columnas** con desplazamiento propio: lista de diapositivas (miniatura, número, tipo y estado con símbolo y texto), vista previa (protagonista) e inspector. La lista se puede contraer a una columna estrecha de números. |
| D-4 | **Vista previa:** anterior, siguiente, contador, ajustar al espacio, zoom (125 %, 150 %, 200 %, 300 % del tamaño ajustado) y pantalla completa solo si el navegador la admite. El zoom y la pantalla completa no cambian la diapositiva. |
| D-5 | **Una sola acción de aprobación** por diapositiva («Aprobar diapositiva»): aprueba la versión mostrada y pasa a la siguiente pendiente (el comportamiento de «Aprobar y siguiente», con la misma protección si el operador cambió de diapositiva mientras tanto). Un atajo «Siguiente pendiente» permite saltar sin aprobar. |
| D-6 | **Aprobación masiva:** «Aprobar todas (N)» solo cuando hay diapositivas elegibles; si no, «Ver motivos» abre el mismo diálogo de siempre con elegibles, aprobadas, advertencias, bloqueadas y pendientes. El diálogo dice que **no aprueba el copy editorial ni el texto del carrusel**. |
| D-7 | **Validaciones compactas:** «Sin errores», «1 bloqueo», «2 advertencias»… con el detalle desplegable (severidad, descripción, elemento afectado y corrección existente). Se abren solas cuando hay algo que hacer, para que un botón deshabilitado siempre esté explicado. Solo resultados reales del servidor. |
| D-8 | **El texto del carrusel (caption)** pasa al modo «Copy editorial» como la pestaña «Texto del carrusel», con su revisión de siempre (aprobar, retirar, regenerar, confirmar advertencias). Avisa de lo que el servidor hace: solo entra en la descarga (`caption.txt`) si está aprobado al dar la aprobación final, y aprobarlo o retirarlo después invalida la aprobación final. |
| D-9 | **Copy editorial en dos columnas** (≈ 70 / 30): texto a la izquierda, acciones y validaciones a la derecha. Pestañas solo para los entregables que existen (Facebook / Instagram, TikTok / Reels, YouTube, Titulares virales, Pregunta de debate) y «Copy para redes» mientras no hay ninguno. La aprobación sigue siendo **por entregable** (DE-5). |
| D-10 | **Contadores:** palabras para los textos largos, caracteres para las líneas cortas y número de hashtags, tal como los calcula el servidor. **No se muestran límites recomendados**: los límites existen solo en el servidor y no están en el contrato; un texto fuera de rango aparece como aviso `LENGTH_OUT_OF_RANGE`. |
| D-11 | **Ediciones protegidas:** se conservan al cambiar de pestaña o de modo; una edición abierta retiene la aprobación y la regeneración de ese entregable, y «Regenerar los cinco textos» mientras haya alguna abierta. Salir de la revisión con cambios sin guardar pide confirmación («Cambios sin guardar»), y cerrar o recargar la pestaña activa el aviso del navegador. **Un guardado rechazado ya no pierde el texto.** |
| D-12 | **Regeneración editorial:** con instrucciones opcionales (el servidor ya las admite), la confirmación de costo de PD-30 en cada generación facturada y nunca automática. El botón dice «Regenerar con IA» solo con un escritor de IA; con el stub dice «Regenerar texto de prueba». |
| D-13 | **«Investigación y fuentes»** queda como panel secundario plegado bajo el texto, con lo que ya existía (acontecimientos, fuentes con fecha de consulta, información no verificada, discrepancias) y la nota de que no se consultaron fuentes externas. |
| D-14 | **Aprobación final en un diálogo**, sin página propia. «Aprobar carrusel completo» se habilita con la misma condición de siempre (`readyForFinalApproval` del servidor y ninguna aprobación final válida). El diálogo muestra datos reales: diapositivas aprobadas, estado del texto del carrusel, estado del copy editorial (que no forma parte del carrusel) y errores bloqueantes. Confirmar llama a `approveCarousel`; nada se da por aprobado antes de la respuesta. |
| D-15 | **Después de aprobar** la vista no navega: se actualizan el estado del proyecto, los indicadores y las acciones. «Descargar carrusel» pasa a ser la acción principal (el mismo `CarouselDownload` de 01F: reutiliza la exportación de la aprobación vigente o la escribe antes). El menú «⋮ Más opciones» ofrece «Actualizar la vista» y, con la aprobación final válida, solo lo que existe: la diapositiva seleccionada (PNG de `getSlideImage`), el copy editorial en `.txt` (el mismo archivo de 01H, hecho en el navegador) y copiar el copy editorial. No se ofrece «Descargar solo imágenes (ZIP)»: no existe esa operación. |
| D-16 | **Marco de la página:** la revisión usa la variante `workspace` del shell (ancho completo, sin la cabecera vacía), la misma del editor de plantillas. A partir de 1200 px el área de trabajo ocupa la altura de la ventana y cada columna se desplaza sola. |
| D-17 | **Se eliminó** lo que no tenía datos o duplicaba: las cajas «Aprobada» / «Sin problemas detectados» repetidas junto al estado, el doble botón de aprobación, la caja de progreso duplicada y el panel de aprobación final al pie. No se añadió telemetría, engagement estimado, tips, certificaciones, IDs técnicos ni nombres de API. La información técnica real (versión, fecha, tamaño, versión de plantilla del control visual y textos de la diapositiva) queda en «Detalles de la versión», plegado. |

### Ajustes del Product Owner (2026-11-10, tras la primera entrega)

| ID | Ajuste |
| --- | --- |
| A-1 | «Actualizar la vista» deja de ser un botón de la cabecera y pasa al menú «⋮ Más opciones», junto a la acción principal. Antes de la aprobación final el menú solo ofrece esa opción. |
| A-2 | «La descarga está lista.» ya no se muestra en la revisión: solo se anuncia a los lectores de pantalla (`CarouselDownload` con `quietSuccess`). Lo mismo para los resultados correctos del menú. Los errores siguen visibles. En la página del proyecto el mensaje no cambia. |
| A-3 | La revisión ya no enlaza al «Historial de exportaciones». El historial sigue en la página del proyecto y en «Exportaciones». |
| A-4 | Se retiró de la revisión la sección «Datos y trazabilidad del borrador» (resumen del borrador, partidos fuera del borrador y editor de exclusiones). No se reubicó nada de la sección: el modo de datos y la nota de datos aprobados manualmente («atestiguados por el operador») ya no aparecen en la revisión (el Product Owner retiró también el banner y la insignia que se habían añadido sin pedirse). El modo de datos sigue en «Datos y verificación» y en la trazabilidad. Los partidos fuera del borrador siguen en «Datos y verificación». |
| A-5 | **El editor de exclusiones de partidos (OD-03) se eliminó del producto** (respuesta a P-2: «no debería existir»). Se borraron el componente `ExclusionsEditor.tsx`, sus textos, sus pruebas, los métodos `listFacts` y `setExcludedMatches` del cliente de la revisión, sus fixtures de prueba y su CSS. La operación del servidor y del contrato se retiró después (A-6). Los borradores que ya tengan partidos excluidos siguen mostrándolos como «Excluido por el operador» en «Datos y verificación». |
| A-6 | **La operación `setExcludedMatches` se retiró del contrato y del servidor** (respuesta a P-3; decisión PD-31 de la fuente de verdad). Se quitaron `PUT /projects/{projectId}/draft/exclusions` del OpenAPI, su esquema y su entrada en `packages/contracts`, la ruta y el método del servicio de proyectos, y sus pruebas (integración del módulo de proyectos y casos de contrato y de protección de peticiones). De las dos pruebas de entrega que la usaban, `approval.test.ts` pierde el último paso (excluir el partido bloqueado y aprobar el borrador nuevo) y `export-history.test.ts` crea el borrador nuevo con un `redraft` de `startRun`. Es un cambio incompatible dentro de v1: PD-31 lo registra como excepción a PD-11, sin ruta v2. Los datos guardados no cambian y no hay migración: el campo `excludedMatchKeys` del borrador, el motivo `excluded_by_operator` y el parámetro de ejecución de OD-43 se conservan para leer lo ya escrito. La base local no tenía ningún borrador ni ejecución con exclusiones. |
| A-7 | **La ruta de navegación vuelve a la cabecera de la aplicación, en su propio bloque debajo del título y la descripción** (pedido del Product Owner: desde la página del proyecto no había forma de volver a «Mis proyectos»). `ui/Layout.tsx` la muestra en todas las páginas con cabecera, salvo en Inicio (solo se nombraría a sí misma) y en las subpáginas de competiciones, que ya tienen su propia ruta con los nombres reales (`ownBreadcrumbs` en `app/shellContext.ts`). Se corrigieron dos entradas que ahora se verían mal: en «Exportaciones», «Mis proyectos» enlazaba a `/`, y «Competiciones» mostraba «Inicio / Inicio». La revisión no cambia: no tiene cabecera de página y su propia cabecera ya enlaza «Volver al proyecto». |
| A-8 | **El carrusel exportado (`/projects/:id/exports/:exportId`) usa el diseño de la revisión** (pedido del Product Owner, 2026-11-11). Tres paneles separados: lista de diapositivas, la vista previa de la revisión (`SlidePreview`: «Diapositiva NN de NN», anterior/siguiente, zoom y pantalla completa) y un panel lateral con el estilo del inspector: «Resumen», insignia «Exportado», fecha, campos de la diapositiva y dos acciones a todo el ancho, «Descargar carrusel» (botón principal; antes no tenía estilo) y «← Volver al proyecto» (botón secundario; antes era un enlace de texto). Se quitó el aviso «Contenido atestiguado por el operador» de esta vista (OD-28). El manifiesto sigue declarando `operatorAttested` y la trazabilidad conserva el aviso. Se corrigió además el carril compartido: entre 900 y 1152 px la lista se ponía en horizontal dentro de una columna estrecha (solo se veía una miniatura, cortada). Desde 900 px ahora queda vertical, y la columna pasa de 11 a 13rem para que «Aprobada» no se parta. Afecta también a la revisión. La etiqueta de demostración y «Ver texto de publicación» no cambian. |
| A-9 | **Un único espacio de diapositivas para la revisión, el detalle del proyecto y el carrusel exportado** (pedido del Product Owner, 2026-11-11: estandarizar). `review/SlideWorkspace.tsx` reúne la lista en su panel, `SlidePreview` y el panel lateral; `SlidePanel` da al panel lateral el estilo del inspector. La revisión los usa con el mismo DOM y las mismas clases de antes. En el detalle del proyecto, «Contenido generado» pasa al mismo diseño: estado por diapositiva en la lista, anterior/siguiente, zoom y pantalla completa, y el panel «Contenido del carrusel» con el estado de la versión, el nombre de la diapositiva, sus campos (ahora también «Título» y «Titular») y las acciones a todo el ancho («Descargar carrusel», «Revisar contenido» o «Continuar revisión»). Se borró `ReviewWorkspace.tsx`, que ya no usaba nadie, y las 10 clases del contenedor antiguo en `Review.module.css`. |

## 4. Flujo anterior y flujo nuevo

**Anterior:** cabecera con progreso → barra «Aprobar todas» → espacio de la diapositiva (lista, imagen, acciones) →
texto de publicación → panel de aprobación final con descarga → sección de copy editorial → detalles del borrador.
Todo en una columna con desplazamiento de página.

**Nuevo:**

1. Cabecera: contexto del proyecto, indicadores, la acción final (aprobar o descargar) y el menú
   «⋮ Más opciones».
2. Diseño visual: seleccionar diapositiva → revisar la vista previa → aprobar (pasa a la siguiente pendiente),
   regenerar o confirmar advertencias desde el inspector. «Aprobar todas (N)» cuando corresponde.
3. Copy editorial: generar el paquete si no existe → leer, copiar, editar y guardar, aprobar o regenerar cada
   entregable → aprobar el texto del carrusel.
4. «Aprobar carrusel completo» → diálogo con el estado real → confirmar.
5. Misma vista: «Descargar carrusel» y el menú; las diapositivas y el copy siguen revisables.

## 5. Componentes

Nuevos (`apps/web/src/features/review/`):

| Archivo | Responsabilidad |
| --- | --- |
| `ReviewHeader.tsx` | Cabecera persistente, indicadores, selector de carrusel y hueco de acciones. |
| `SlidePreview.tsx` | Vista previa con navegación, zoom y pantalla completa. |
| `SlideWorkspace.tsx` (A-9) | `SlideWorkspace` (lista, vista previa y panel lateral en tres columnas) y `SlidePanel` (panel con el estilo del inspector), compartidos por la revisión, el detalle del proyecto y el carrusel exportado. |
| `ValidationSummary.tsx` | Resumen y detalle de validaciones de una versión. |
| `FinalApproval.tsx` | Acción «Aprobar carrusel completo» y su diálogo de confirmación. |
| `ReviewDownloads.tsx` | Descarga principal tras la aprobación final y el menú «⋮ Más opciones» (actualizar la vista y descargas secundarias). |
| `UnsavedChangesGuard.tsx` | Confirmación al salir con cambios sin guardar (`useBlocker`) y aviso de `beforeunload`. |
| `editorial/useEditorialPackage.ts` | Lectura compartida del paquete editorial (la página lo necesita para indicadores, diálogo y descargas). |
| `ReviewModes.test.tsx` | Pruebas del espacio de trabajo nuevo. |

Modificados:

| Archivo | Cambio |
| --- | --- |
| `ReviewPage.tsx` | Composición: cabecera, modos, paneles montados, selección de diapositiva por carrusel, menú, descargas, nota de datos atestiguados y foco tras la aprobación final. Sin la sección de detalles del borrador. |
| `CarouselReview.tsx` | Modo «Diseño visual»: lista con estados, aprobación masiva condicionada, avance a la siguiente pendiente. Sin el panel de aprobación final ni el caption. |
| `ElementReview.tsx` | Inspector nuevo (una acción de aprobación, validaciones compactas, detalles plegados, siguiente pendiente); diseño en tres columnas para diapositivas y en dos para el caption, con copiar por campo. Misma lógica de operaciones. |
| `ReviewThumbnailRail.tsx` | Opciones nuevas y opcionales: estado como insignia, columna a toda altura, modo contraído, acción en la cabecera e introducción. El carrusel exportado y el detalle del proyecto usan la columna a toda altura (A-8, A-9). |
| `editorial/EditorialCopy.tsx` | Dos columnas, pestañas solo para lo que existe, caption como pestaña, ediciones por entregable que sobreviven a las pestañas, guardado que no pierde texto, protección al salir. |
| `editorial/copy.ts`, `editorial/download.ts`, `copy.ts` | Textos nuevos; `deliverableText`, `copyText` y `saveUrl` exportados para reutilizarlos. |
| `model.ts` | `elementStatus`, `reviewIndicators`, `currentEditorialVersions`, `nextPendingSlide` (funciones puras). |
| `Review.module.css` | Clases para la lista a toda altura y contraída, alias oscuros (`.theme`); se borraron 39 clases que ya no usaba nadie (incluidas las del editor de exclusiones). Desde 900 px la lista a toda altura es vertical (A-8). |
| `history/CarouselDownload.tsx` | Opción `quietSuccess`: el mensaje de éxito solo se anuncia. Sin ella (página del proyecto) no cambia nada. |
| `history/ExportDetailPage.tsx` (A-8, A-9) | `SlideWorkspace` y `SlidePanel` con el resumen y las acciones con estilo. Sin `AttestedNote`. Un `h2` solo para lectores de pantalla mantiene el orden de los encabezados. |
| `history/DownloadExportButton.tsx`, `history/attested.ts`, `history/copy.ts` (A-8) | Opción `statusClassName` para el mensaje de la descarga; se borró `exportUsesAttestedFacts`, que ya no se usa; texto `previewTitle`. |
| `SlidePreview.tsx` (A-8) | Opciones `imageAlt` y `noImageText`, para conservar los textos propios de la exportación. |
| `api.ts` | Sin `listFacts` ni `setExcludedMatches`, que solo usaba el editor de exclusiones. |

| `projects/ProjectGeneratedContent.tsx` (A-9) | «Contenido generado» con `SlideWorkspace` y `SlidePanel`; acciones a todo el ancho. |

Eliminados: `ExclusionsEditor.tsx` (y sus pruebas, que estaban en `ReviewPage.test.tsx`) y `ReviewWorkspace.tsx` (A-9).
| `ui/primitives/Tabs.tsx` | Insignia opcional por pestaña (texto o símbolo con texto accesible) y tamaños `sm` / `lg`. Compatible con los usos existentes. |
| `app/AppShell.tsx` | La regla de `/projects/:id/review` pasa de `studio` a `workspace`. Nada más del shell. |
| Pruebas | `ReviewPage`, `ElementReview`, `FinalApproval`, `EditorialCopy`, `model`, `App` y el soporte de pruebas (`openMode`, `openCopyTab`, `openCaption`). |

## 6. Arquitectura frontend

- Estado del servidor: el mismo `useDraft` (respuesta inmediata de cada operación y recarga del borrador) y el nuevo
  `useEditorialPackage`, que solo mueve la lectura que antes hacía `EditorialCopy` para compartirla.
- Estado de interfaz en `ReviewPage`: modo, carrusel, diapositiva seleccionada por carrusel, cambios sin guardar
  (informado por el copy) y mensaje de la aprobación final. Las ediciones viven en `EditorialCopy`, que no se desmonta
  al cambiar de modo.
- Las reglas siguen en el servidor (AD-13, T10-F15). El modelo del frontend solo explica el estado mostrado y deshabilita
  controles; toda negativa del servidor se muestra.
- Sin librería de estado nueva ni dependencias nuevas. Estilos con utilidades de Tailwind y los tokens existentes; las
  piezas heredadas siguen con el módulo CSS ya tokenizado.

## 7. Funcionalidades preservadas

Aprobación de la versión exacta (R-406), retirada, regeneración por elemento (R-217) que deja la versión pendiente del
control visual, confirmación de advertencias una por petición (OD-38), datos bloqueantes con su motivo (R-206, R-271,
R-272), observaciones de contenido, aprobación masiva secuencial con reintento seguro, aprobación final con la misma
condición y la lista de elementos rechazados, aprobación final invalidada (AD-13), varios carruseles, descarga del
carrusel sin reutilizar exportaciones de una aprobación anterior, banner de demostración, copy editorial de 01H completo (generación, costo, edición, aprobación por entregable,
regeneración con instrucciones, descarga `.txt`, investigación y fuentes). Por decisión del Product Owner (A-3, A-4)
la revisión ya no muestra el historial ni los partidos fuera del borrador, y el editor de exclusiones se eliminó (A-5).

## 8. Pruebas

Ejecutadas el 2026-11-10 en la rama:

| Verificación | Resultado |
| --- | --- |
| Typecheck (raíz y web) | OK |
| ESLint (todo el árbol, `--max-warnings 0`) | OK |
| Prettier | OK en todos los archivos tocados. 3 avisos **preexistentes** en archivos no tocados (`competitions/import-preview.int.test.ts`, `projects/respond.ts`, `platform/http/errors.ts`), los mismos que registró 01H. |
| Unit + unit-web | 2502 de 2502 (2026-11-11). A-8 añadió una prueba del carrusel exportado con el diseño de la revisión; la del aviso atestiguado comprueba ahora que no aparece. A-9: la prueba del detalle del proyecto comprueba el espacio de diapositivas compartido (posición, anterior/siguiente y panel). Las 2 pruebas de la ruta de navegación, que fallaban desde que se ocultó, se rehicieron con A-7: la ruta en la página del proyecto y en «Datos y verificación», su ausencia en Inicio, en la revisión y en las competiciones, y el enlace «Volver al proyecto» de la revisión. |
| Integración | 679 de 679 (2 menos: las pruebas de la operación retirada en A-6) |
| Contrato | 2409 de 2409 (18 menos: los casos de la operación retirada en A-6) |
| Build de producción | OK |
| `git diff --check` | OK |

Cobertura nueva o actualizada: navegación entre modos y su semántica de pestañas; selección, anterior/siguiente, zoom y
lista contraída; aprobación individual con avance, retirada y regeneración; aprobación masiva condicionada; edición,
guardado, guardado rechazado sin pérdida, copiar, regeneración y aprobación editorial; ediciones conservadas entre
pestañas y modos; confirmación al salir con cambios; diálogo de aprobación final (cancelar, carga, Escape bloqueado
durante el envío, éxito sin navegar, rechazo del servidor y cambio concurrente que deshabilita la confirmación);
menú «Más opciones» (actualizar la vista y descargas), éxito de la descarga solo anunciado, sin enlace al historial;
 proyecto cuyo copy editorial no se puede leer; carrusel sin caption; helpers del modelo. Ninguna
prueba llama a servicios reales ni de pago.

Validación visual (Chrome sin interfaz con Playwright, `config/dev-full.config.json`, proyecto real de la base local):
1440 × 900, 1280 × 800 y 1024 × 768 en los dos modos, sin desbordamiento horizontal; axe sin violaciones en los dos
modos ni en el diálogo. Para ver estados pendientes, el script reescribía en el navegador la respuesta del borrador y
**bloqueaba toda petición que no fuera GET**: no se aprobó, generó ni exportó nada en la base real.

## 9. Limitaciones

- Por debajo de 1200 px la página no se ajusta a la altura de la ventana: se desplaza la página y, desde 900 px, las
  acciones del copy y el inspector quedan fijos a la vista. Por debajo de 900 px las columnas se apilan (sin experiencia
  móvil avanzada, fuera de alcance).
- El zoom es relativo al tamaño ajustado (hasta 300 %) y se desplaza con las barras; no hay arrastre con el ratón.
- Los indicadores son del carrusel seleccionado; el copy editorial es del borrador. «Bloqueos» cuenta lo que no se
  puede aprobar sin corregir: elementos con datos no publicables, observaciones o control visual fallido, y entregables
  editoriales con avisos.
- «Descargar diapositiva» usa el atributo `download` sobre la dirección de `getSlideImage` (mismo origen).
- No se probó una aprobación final ni una descarga reales contra la base: quedan para la validación manual. La extensión
  de Chrome no estaba conectada, así que no hubo recorrido interactivo.
- Con varios carruseles, la pestaña «Texto del carrusel» muestra el del carrusel seleccionado.

## 10. Pregunta para el Product Owner

- **P-1:** ¿La aprobación final debe exigir el texto del carrusel o el copy editorial? Hoy no los exige
  (PD-ARCH-01E-PD-02, DE-5): la interfaz conserva esa regla y el diálogo solo informa de su estado. Exigirlos cambiaría
  la arquitectura de aprobación y necesita autorización; no se hizo.
- **P-2 (resuelta, 2026-11-10):** el editor de exclusiones no debe existir; se eliminó de la interfaz (A-5).
- **P-3 (resuelta, 2026-11-10):** la operación `setExcludedMatches` se retiró también del servidor y del contrato
  (A-6, PD-31).

## 11. Validación manual

1. Arranca con `EDR_CONFIG=config/dev-full.config.json npm run dev` y abre `/projects/<id>/review` de un proyecto con
   borrador.
2. Cabecera: título completo, contexto, formato y estado; indicadores coherentes con la lista de diapositivas.
3. Diseño visual: selecciona diapositivas, usa anterior/siguiente, zoom, ajustar y pantalla completa. Contrae la lista.
4. Aprueba una diapositiva y comprueba que pasa a la siguiente pendiente; retira una aprobación; regenera una y verifica
   que vuelve a «Pendiente del control visual».
5. «Aprobar todas (N)»: confirma que no aprueba el texto del carrusel ni el copy editorial.
6. Copy editorial: edita un entregable, cambia de pestaña y de modo y vuelve: el texto sigue. Intenta volver al proyecto
   y comprueba la confirmación. Guarda, copia, aprueba y retira. Regenera un entregable con instrucciones (con escritor
   facturado, confirma el costo antes; no se genera nada sin confirmación).
7. Abre «Investigación y fuentes».
8. Con todo listo, «Aprobar carrusel completo»: revisa el diálogo, cancela, vuelve a abrirlo y confirma.
9. Sin salir de la vista: «Descargar carrusel» (sin el texto «La descarga está lista.») y el menú «⋮ Más opciones»
   («Actualizar la vista» y las descargas secundarias). No aparecen el historial ni «Datos y trazabilidad del
   borrador».
10. Repite a 1440, 1280 y 1024 px.
11. Abre `/projects/<id>`: «Contenido generado» tiene el mismo espacio de diapositivas que la revisión.
12. Abre `/projects/<id>/exports/<exportId>`. Comprueba los tres paneles, anterior/siguiente y zoom, «Descargar carrusel» con estilo de botón principal y «← Volver al proyecto», y que no aparece «Contenido atestiguado por el operador».

## 12. Estado de Git

Con commit en `work/PD-ARCH-01G-E` tras la aceptación del 2026-11-11, junto con PD-ARCH-01H y el menú lateral
colapsable, porque comparten archivos. Sin merge, push ni despliegue. Los cambios de UX-REVIEW-01 son los archivos de la sección 5, esta carpeta y,
por A-6: `contracts/http-api.openapi.yaml`, `packages/contracts/src/http/operations.ts` y `review.ts` (comentario),
`apps/server/src/modules/projects/routes.ts`, `service.ts`, `index.ts` y `projects.int.test.ts`, los comentarios de
`modules/content/stage.ts` y `workflow/snapshot.ts`, las pruebas de contrato (`openapi-document`, `served-operations`,
`request-protection`, `support/samples.ts`), las de entrega (`approval`, `export-history`, `support.ts`) y la fila
PD-31 de `.orchestrate/source-of-truth.md`. El hash del contrato en `.orchestrate/config.json` no se tocó: ya no
coincidía con el archivo antes de este cambio.
Los cambios preexistentes de la rama (PD-ARCH-01G-D, PD-ARCH-01H y el menú lateral colapsable) se conservaron;
`AppShell.tsx` y `App.test.tsx` ya tenían cambios de ese menú; aquí se tocaron la regla de la revisión, la ruta de
navegación (A-7) y sus pruebas, junto con `ui/Layout.tsx` y `app/shellContext.ts`. Por A-8: `history/ExportDetailPage.tsx` y su prueba, `history/DownloadExportButton.tsx`, `history/attested.ts` y `history/copy.ts`. Por A-9: `review/SlideWorkspace.tsx` (nuevo), `review/ReviewWorkspace.tsx` (borrado, estaba en el commit f25df3a), `projects/ProjectGeneratedContent.tsx` y `projects/ProjectDetailPage.test.tsx`. `editorial/EditorialCopy.tsx`, `editorial/copy.ts` y `editorial/download.ts` son de 01H (sin seguimiento
todavía) y se modificaron sobre esa versión.
