# El Deporte Rey GT — Estudio creativo AI

Aplicación web **local y de un solo operador** que convierte los datos de tus competiciones de fútbol en carruseles para
Instagram (1080 × 1350) listos para revisar, aprobar y descargar. También genera el copy editorial para redes.

Un solo proceso de Node.js, escuchando solo en `127.0.0.1`, sirve la interfaz web y una API JSON. Ejecuta todo el flujo
en tu máquina: datos deportivos, verificación, textos, renderizado de las diapositivas y control visual. Guarda todo en
una base SQLite y en la carpeta `data/`. No hay inicio de sesión ni acceso remoto, y **nada se publica
automáticamente**: tú descargas los archivos y los publicas a mano.

> Esta guía explica, paso a paso, todo lo necesario para instalar el proyecto, traer tus datos, ejecutarlo, trabajar
> con él, usar la IA y las plantillas. Los detalles técnicos (seguridad, puertos, credenciales) están en
> [docs/local-setup.md](docs/local-setup.md).

## Índice

1. [Requisitos](#1-requisitos)
2. [Instalación paso a paso](#2-instalación-paso-a-paso)
3. [Configuraciones y claves](#3-configuraciones-y-claves)
4. [Ejecutar el proyecto](#4-ejecutar-el-proyecto)
5. [Cargar los datos que ya tienes](#5-cargar-los-datos-que-ya-tienes)
6. [Cómo funciona](#6-cómo-funciona)
7. [Cómo se trabaja, paso a paso](#7-cómo-se-trabaja-paso-a-paso)
8. [Generar con IA: qué necesitas](#8-generar-con-ia-qué-necesitas)
9. [Plantillas: crear, publicar y usar](#9-plantillas-crear-publicar-y-usar)
10. [Pruebas y comandos](#10-pruebas-y-comandos)
11. [Problemas frecuentes](#11-problemas-frecuentes)
12. [Estructura del repositorio y documentación](#12-estructura-del-repositorio-y-documentación)

---

## 1. Requisitos

| Requisito | Detalle |
| --- | --- |
| Sistema | macOS o Linux. En Windows, usa **WSL** (los scripts usan sintaxis de shell POSIX). |
| Node.js | **Exactamente `22.22.2`** (fijado en `.nvmrc` y en `engines`). Otra versión se rechaza (`engine-strict`). Se recomienda [nvm](https://github.com/nvm-sh/nvm). |
| npm | El que viene con Node.js 22.22.2. |
| Git | Para clonar el repositorio. |
| Navegador | Chrome, Edge, Firefox o Safari actual. |
| Red | `https://registry.npmjs.org/` para instalar dependencias. Solo si usas IA o datos en vivo: `https://api.openai.com` y `https://api.football-data.org`. |

No hace falta instalar nada más de forma global. Los navegadores de las pruebas end-to-end se descargan solos, dentro
del proyecto (`.cache/`).

## 2. Instalación paso a paso

1. **Clona el repositorio** (necesitas acceso a él si es privado):

   ```sh
   git clone git@github.com:wcorderolara/el-deporte-rey-ai.git   # por SSH
   # o: git clone https://github.com/wcorderolara/el-deporte-rey-ai.git
   cd el-deporte-rey-ai
   ```

2. **Instala y activa Node.js 22.22.2** (con nvm, que lee `.nvmrc`):

   ```sh
   nvm install
   nvm use
   node --version   # debe decir v22.22.2
   ```

3. **Instala las dependencias** desde el lock file (no ejecuta scripts de instalación):

   ```sh
   npm ci
   ```

4. **Crea tu archivo de credenciales** `.env.local`. Está ignorado por Git y **nunca se sube**:

   ```sh
   cp .env.example .env.local
   chmod 600 .env.local
   ```

   Ábrelo con un editor y rellena **solo** lo que vayas a usar (sección 3). Si solo vas a trabajar con datos locales y
   sin IA, puedes dejarlo vacío.

5. **Comprueba que todo compila** (opcional, recomendado la primera vez):

   ```sh
   npm run typecheck
   npm run test:unit
   ```

## 3. Configuraciones y claves

### 3.1 Qué configuración usar

La configuración se elige con la variable `EDR_CONFIG`. Todas están en `config/` y ninguna contiene secretos.

| Quiero… | Configuración | Claves necesarias en `.env.local` |
| --- | --- | --- |
| Trabajar con mis competiciones locales, sin IA ni datos en vivo | `config/dev.config.json` (por defecto en `npm run dev`) | Ninguna |
| Lo anterior más importar datos de football-data.org | `config/dev-live.config.json` | `FOOTBALL_DATA_API_TOKEN` |
| Lo anterior más propuestas de diseño con IA (imágenes) | `config/dev-images.config.json` (sin football-data) | `EDR_IMAGE_API_KEY` |
| **Todo**: football-data, imágenes con IA y copy editorial con IA | `config/dev-full.config.json` | `FOOTBALL_DATA_API_TOKEN`, `EDR_IMAGE_API_KEY`, `EDR_AI_API_KEY` |
| Uso local compilado (un solo puerto), sin IA | `config/app.config.json` (por defecto en `npm start`) | Ninguna |

Todas las configuraciones incluyen la fuente **«Datos deportivos locales»** (tus competiciones de Competiciones) y unas
fuentes de demostración con datos sintéticos.

### 3.2 Las claves

Escríbelas en `.env.local`, una por línea, sin comillas:

```sh
FOOTBALL_DATA_API_TOKEN=   # token gratuito de https://www.football-data.org (solo para importar datos en vivo)
EDR_IMAGE_API_KEY=         # clave de la API de OpenAI para generar imágenes (propuestas de diseño)
EDR_AI_API_KEY=            # clave de la API de OpenAI para el copy editorial
```

- Puede ser la misma clave de OpenAI en las dos variables.
- Las claves solo las lee el servidor. Nunca llegan al navegador, a la base de datos, a los logs ni a las respuestas de
  la API.
- Para comprobar que una clave está puesta **sin mostrarla**: `grep -c '^EDR_AI_API_KEY=..*' .env.local` (imprime `1`
  si está).
- Nunca pegues una clave en un chat, un issue, un commit o un log. Tras cambiar `.env.local`, reinicia el servidor.

## 4. Ejecutar el proyecto

### 4.1 Modo desarrollo (el habitual)

```sh
npm run dev                                                # solo datos locales, sin IA
EDR_CONFIG=config/dev-full.config.json npm run dev         # con football-data e IA
```

Abre **http://127.0.0.1:5173** en el navegador.

- Arranca dos procesos: la API en `127.0.0.1:4300` (se reinicia sola al cambiar el código) y la web de Vite en
  `127.0.0.1:5173`, que reenvía `/api` a la API.
- Usa exactamente `127.0.0.1:5173` o `localhost:5173`. Cualquier otra dirección se rechaza con un error 421.
- Para detenerlo: `Ctrl + C` en la terminal.

### 4.2 Uso local compilado (un solo puerto)

```sh
npm run build
npm start                                                  # configuración config/app.config.json
# o, con todo activado:
EDR_CONFIG=config/dev-full.config.json npm start
```

Abre **http://127.0.0.1:4300**. En este modo la interfaz es la última compilada: si cambias código, vuelve a ejecutar
`npm run build`.

### 4.3 Qué pasa en el primer arranque

- Se crea la carpeta `data/` con permisos solo para tu usuario.
- Se crea la base `data/edr.sqlite` y se aplican todas las **migraciones** de `apps/server/migrations`.
- En cada arranque se aplican las migraciones pendientes. **Ojo en modo desarrollo:** la API se reinicia sola con cada
  cambio, así que una migración nueva se aplica a tu base en cuanto existe el archivo (ver la sección 11).

## 5. Cargar los datos que ya tienes

### 5.1 Traer la carpeta `data/` de otra instalación (copia completa)

Toda tu información vive en `data/`: la base de datos, los escudos, los recursos de marca, las propuestas de diseño,
las imágenes renderizadas, las exportaciones y los archivos importados. Para moverla a otra máquina:

1. **Detén el servidor en las dos máquinas** (`Ctrl + C`). Así la base queda completa y consistente.
2. Copia la carpeta **entera** `data/` de la instalación de origen. Debe incluir:

   ```text
   data/
     edr.sqlite          (y, si existen, edr.sqlite-wal y edr.sqlite-shm: cópialos también)
     brand-assets/       recursos de Mi marca
     design-proposals/   propuestas de diseño generadas con IA
     team-badges/        escudos de los equipos
     renders/            imágenes de las diapositivas
     exports/            carruseles descargados
     imports/            archivos originales importados
   ```

3. Pégala en la raíz del proyecto (`el-deporte-rey-ai/data/`), o en otra ruta indicada con `EDR_DATA_DIR`:

   ```sh
   EDR_DATA_DIR=/ruta/a/mis/datos npm run dev
   ```

4. Asegúrate de que el código es **igual o más nuevo** que el de la instalación de origen (`git pull` en `main`). El
   servidor aplica solo las migraciones que falten; si la base es más nueva que el código, no arranca
   (`migration_unknown_applied`).
5. Arranca (sección 4) y revisa **Competiciones**, **Mis proyectos** y **Exportaciones**.

> `data/` contiene escudos subidos con autorización, tus recursos de marca y tu trabajo: está ignorada por Git a
> propósito. Muévela solo por un medio privado y nunca la subas al repositorio. Para respaldarla, copia la carpeta con
> el servidor detenido.

### 5.2 Crear los datos a mano en Competiciones

Es la fuente con la que se crea el contenido. Se explica en la [sección 7.2](#72-competiciones-tus-datos-deportivos).

### 5.3 Importar desde football-data.org

1. Pon `FOOTBALL_DATA_API_TOKEN` en `.env.local` (plan gratuito) y arranca con `config/dev-live.config.json` o
   `config/dev-full.config.json`.
2. En **Competiciones**, abre una competición y, en «Fuente de datos», pulsa **«Configurar fuente de datos»**.
3. Elige el «Modo de administración» **«Provider»** o **«Hybrid»** («Manual» desvincula el proveedor), el «Proveedor»
   y la «Competición externa». Pulsa **«Guardar configuración»**.
4. Pulsa **«Importar datos»**. Elige la «Temporada externa», el «Destino local (opcional)» y qué información consultar
   («Temporada», «Equipos», «Participantes», «Fases», «Jornadas», «Partidos», «Resultados»). Pulsa **«Consultar y
   preparar vista previa»**.
5. Revisa la vista previa. Cada registro aparece como «Nuevo», «Cambiaría», «Sin cambios», «Conflicto», «Inválido» u
   «Omitido». En «Revisión de importación», decide cada registro que lo requiera: «Conservar el valor local»,
   «Vincular con …», «Aceptar el valor entrante» u «Omitir estos registros».
6. Pulsa **«Confirmar importación»** y confirma. Al terminar verás «Importación completada».

Las correcciones que hagas a mano quedan **protegidas** («Modificado manualmente · Protegido»): una importación
posterior no las sobrescribe sin tu decisión. Lo mismo vale para el nombre de presentación de los equipos.

### 5.4 Importaciones manuales de archivos (menú «Datos»)

El menú **«Datos»** («Importaciones manuales») acepta un archivo JSON o CSV, o un formulario:

- **JSON** con formato `edr-manual-import/1`. **CSV** de partidos o de clasificación, con la fila de encabezados
  exacta. Son archivos UTF-8 de hasta 512 KiB.
- Hay ejemplos válidos en `fixtures/manual/valid/` (`liga-manual.json`, `liga-manual-matches.csv`,
  `liga-manual-standings.csv`) y ejemplos de errores en `fixtures/manual/invalid/`.
- La importación es todo o nada: si un registro tiene un error, no se guarda nada. No se admiten datos de personas.

> Estas importaciones se conservan como **historial** y no alimentan «Crear contenido». El contenido se crea siempre
> desde **Competiciones** (secciones 5.2 y 5.3).

### 5.5 Escudos y recursos de marca

Los escudos se suben a mano en cada equipo (sección 7.2). Los logotipos, la mascota, los fondos y las referencias se
suben en **Mi marca → Recursos** (sección 7.1). Si traes la carpeta `data/` completa (5.1), ya vienen incluidos.

## 6. Cómo funciona

### 6.1 El recorrido de los datos

```text
Competiciones (tus datos)  ──►  Crear contenido  ──►  Generación (por pieza)
                                                        1. Investigación: lee los datos de la jornada
                                                        2. Verificación: crea hechos con su estado
                                                        3. Contenido: arma las diapositivas y sus textos
                                                        4. Renderizado: dibuja cada diapositiva (PNG)
                                                        5. Control visual: comprueba datos, nombres y ajuste
                          ──►  Revisión: apruebas diapositivas, texto y copy
                          ──►  Aprobación final del carrusel
                          ──►  Descarga (ZIP) y publicación manual
```

- **Renderizado determinista.** Las diapositivas finales las dibuja el motor de la aplicación (sin IA de imágenes), con
  una plantilla del motor o una plantilla visual publicada. El mismo proyecto produce siempre la misma imagen.
- **La IA solo se usa en dos lugares:** para crear **propuestas de diseño** que se convierten en plantillas, y para
  escribir el **copy editorial**. Los textos de las diapositivas los genera un redactor fijo, sin coste, y los nombres de
  los equipos, los marcadores y las fechas vienen siempre de tus datos, nunca de texto inventado.
- **Instantánea por proyecto.** Al crear un proyecto se guardan los escudos, las versiones de plantilla y los nombres de
  presentación de ese momento. Los cambios posteriores solo afectan a los proyectos nuevos.

### 6.2 Estados de los datos

- Cada fuente tiene un modo: **«Datos manuales»** (tus competiciones e importaciones), **«Datos en vivo»**
  (football-data.org) o **«Datos de demostración»** (sintéticos).
- El contenido de demostración lleva siempre la marca «Contenido de demostración» y no debe publicarse.
- Cada hecho tiene un estado: «Verificado», «Sin verificar» (con su motivo) o «Aprobado manualmente» (atestiguado por el
  operador). Puedes consultarlos en «Datos y verificación».

## 7. Cómo se trabaja, paso a paso

El menú lateral («Tu estudio») tiene:

- **«Crear contenido»**, también como botón principal arriba;
- «Inicio» y «Mis proyectos»;
- **«Competiciones»** y **«Exportaciones»**;
- «Mi marca», con «Recursos» e «Identidad visual»;
- «Plantillas», con «Crear plantilla» y «Plantillas del motor»;
- «Datos».

### 7.1 Mi marca (una vez)

- **Recursos → «Subir recurso».**
  - En «Subir un recurso de marca» eliges la «Categoría» («Logotipo», «Mascota», «Elemento gráfico», «Fondo», «Referencia
    gráfica»), el «Archivo» y el «Nombre».
  - El archivo debe ser PNG o JPEG, de hasta 5 MB y 4096 × 4096 px. Las referencias gráficas también admiten WebP.
  - Eliges el «Uso por inteligencia artificial»:
    - «Protegido», el valor por defecto para el logotipo y la mascota: se usa tal cual y nunca se envía a la IA;
    - «Solo referencia»: solo inspira el estilo y no se inserta en el contenido final;
    - «Reutilizable»: se incorpora en plantillas sin modificarlo;
    - «Transformable con IA»: además puede servir de base para variantes con IA. Úsalo solo si la marca lo permite.
  - Guarda con **«Guardar recurso»**.
  - Un recurso que ya se usa en diapositivas o plantillas no se puede eliminar; puedes desactivarlo.
- **Identidad visual.**
  - Muestra el nombre, la cuenta (`@ElDeporteReyGT`), la mascota, la paleta y la tipografía de la marca.
  - Con «Editar descripción y usos» documentas el uso de cada color y fuente, y las preferencias gráficas.

### 7.2 Competiciones (tus datos deportivos)

1. **Crear la competición:** «Crear competición» → «Nombre de la competición».
2. **Equipos:** en la competición, pulsa «Equipos» → «Agregar equipo». Puedes elegir un «Equipo existente» o crear un
   «Nuevo equipo» con su «Nombre del equipo» y «Zona o ciudad (opcional)».
3. **Editar un equipo** («Editar equipo»):
   - **«Nombre del equipo»:** el nombre oficial, que identifica al equipo y se usa en el copy y las integraciones.
   - **«Nombre para mostrar (opcional)»:** hasta 32 caracteres, por ejemplo «Real Madrid» en lugar de «Real Madrid CF».
     Se dibuja en las imágenes de los proyectos nuevos, en lugar del nombre oficial. Déjalo vacío para usar el oficial.
   - **«Escudo»:** «Subir escudo» con un PNG o JPEG de hasta 5 MB (recomendado: PNG con fondo transparente). Hay que
     indicar la «Fuente del escudo» y marcar «Confirmo que tengo autorización para usar este escudo». Sin escudo, las
     plantillas muestran solo el nombre.
4. **Temporada:** «Crear temporada» → «Nombre o periodo» (por ejemplo, `2026/27`).
5. **Participantes:** en la temporada, «Administrar Equipos» → «Agregar participantes».
6. **Calendario:** «Ver calendario».
   - Crea las «Fases» si las hay (por ejemplo, Apertura) y las **jornadas** («Crear jornada»).
   - En cada jornada, «Agregar partido»: «Equipo local», «Equipo visitante» y «Fecha y hora».
7. **Resultados:** en cada partido, abre «Registrar o corregir resultado». Elige el «Estado del partido» («Programado»,
   «En curso», «Finalizado», «Pospuesto», «Cancelado»), escribe el marcador y pulsa «Guardar estado y marcador».

### 7.3 Crear contenido (asistente de 5 pasos)

Abre **«Crear contenido»**, o pulsa «Generar contenido» desde una jornada para empezar con el contexto ya elegido.

1. **Contexto deportivo:** «Competición», «Temporada», «Fase» y «Jornada».
2. **Tipo de contenido:** puedes elegir varios a la vez.
   - Partidos jugados: «Resultados de jornada» y «Resultado individual».
   - Partidos por jugar: «Calendario de jornada», «Próximos partidos» y «Previa individual».
3. **Partidos:** marca los partidos. Las marcas «Resultado final», «Apto para calendario» y «Por jugar» indican cuáles
   sirven para cada tipo, y «Seleccionar compatibles» elige todos los válidos.
4. **Plantilla:** para cada tipo de diapositiva, elige la «Plantilla del motor» o una **plantilla visual publicada**
   (formato 4:5). Verás una vista previa con tus datos reales.
5. **Revisión:** comprueba el resumen (plantillas, escudos y piezas que «Se generará» u «Omitida») y pulsa **«Confirmar y
   generar N piezas»**.

Pasarás a **«Resultado de la generación»**, que se actualiza solo. Cada pieza muestra su estado («En cola»,
«Generando», «Generada», «Fallida» u «Omitida») y el botón «Abrir proyecto». Cada pieza es un proyecto.

### 7.4 Revisar el contenido

En el proyecto, pulsa **«Revisar contenido»**. Hay dos pestañas: **«Diseño visual»** y **«Copy editorial»**.

**Diapositivas («Diseño visual»):**

- **«Aprobar diapositiva»** aprueba la diapositiva y pasa a la siguiente pendiente. **«Aprobar todas (N)»**, en el
  bloque «Aprobación masiva», aprueba de una vez todas las que están listas.
- **Advertencias del control visual:** se revisan y se confirman con «Confirmar la advertencia».
- **Diapositivas bloqueadas:** una diapositiva bloqueada o con errores se corrige con **«Regenerar diapositiva»**.
- **Aprobación final:** **«Aprobar carrusel completo»** se habilita cuando **todas** las diapositivas están aprobadas y
  ninguna está bloqueada. Confirma con «Confirmar aprobación final».

**Texto del carrusel** (la leyenda de Instagram, en la pestaña «Texto del carrusel» de «Copy editorial»):

- Se aprueba con «Aprobar texto del carrusel».
- Es opcional: sin aprobarlo, la descarga lleva solo las diapositivas.

**Copy editorial** (Facebook / Instagram, TikTok / Reels, YouTube, Titulares virales y Pregunta de debate):

- **«Generar copy editorial»** (o «Regenerar los cinco textos»). Con la configuración `dev-full` usa la IA de OpenAI y
  pide confirmar el costo. En las demás configuraciones genera un «Texto de prueba (sin IA)» gratuito. Ver la
  sección 8.2.
- Cada texto se puede editar («Editar texto» → «Guardar cambios»), copiar, regenerar con instrucciones y aprobar
  («Aprobar copy»). **«Aprobar todos los copys (N)»** aprueba de una vez todos los textos listos.
- Los textos con avisos no se pueden aprobar hasta corregirlos o regenerarlos. La cuenta `@ElDeporteReyGT` está
  permitida.
- **Descargas aparte de las diapositivas:** «Descargar este copy (.txt)» y «Descargar todos los copys (.txt)».
- El copy es independiente de la aprobación del carrusel: puedes aprobarlo antes o después.

### 7.5 Descargar y publicar

- Con el carrusel aprobado aparece **«Descargar carrusel»**. Cada descarga crea una exportación nueva, el archivo
  `carrusel-XXXXXXXX.zip`, que contiene:
  - `01.png` … `NN.png`: las diapositivas, en orden;
  - `caption.txt`: el texto del carrusel, si está aprobado;
  - `copy-editorial.txt`: el copy editorial aprobado;
  - `manifest.json`: las versiones, los hashes y los datos usados (trazabilidad).
- En «Más opciones» puedes descargar una diapositiva suelta (PNG) o el copy editorial.
- Todas las descargas quedan en **«Exportaciones»** y en el «Historial de exportaciones» del proyecto. Las anteriores no
  se modifican nunca.
- **Publica a mano** en tus redes. La aplicación no publica nada.

### 7.6 Datos y verificación

En el proyecto, «Más opciones del proyecto» → **«Datos y verificación»** muestra cada hecho usado (partidos, equipos,
jornada) con su estado y su origen. En los proyectos con datos manuales puedes «Aprobar manualmente» un hecho.

## 8. Generar con IA: qué necesitas

La IA es opcional. Sin ella puedes hacer todo el flujo con las plantillas del motor y el texto de prueba.

### 8.1 Propuestas de diseño con IA (imágenes)

Sirven para crear plantillas visuales propias. Las diapositivas finales nunca se generan con IA.

**Necesitas:**

1. Una cuenta de la [API de OpenAI](https://platform.openai.com) con saldo y acceso a los modelos GPT Image. Puede
   pedirte la verificación de la organización.
2. La clave en `.env.local`: `EDR_IMAGE_API_KEY=…`.
3. Arrancar con `config/dev-images.config.json` o `config/dev-full.config.json`.

**Cómo se usa:**

1. Ve a **Plantillas → Crear plantilla → «Propuestas visuales con IA»**.
2. **«Comprobar acceso al modelo»** verifica la clave sin coste.
3. Pulsa **«Crear diseño con IA»** y rellena:
   - **«Modo de generación»:** «Diseño de plantilla (guiado)» o «Prompt propio (inspiración)»;
   - **«Tipo de contenido»** y **«Formato»**: usa **«4:5 · Vertical (feed)»** para los carruseles;
   - **«Modelo»**, **«Calidad»** y **«Cantidad de propuestas»**;
   - **«Instrucciones»**;
   - **«Recursos de marca»:** para cada recurso, «No usar», «Inspiración de estilo», «Base para transformar» o «Colocar
     el original en el diseño». Los recursos «Protegidos» (el logo y Ketsi oficiales) **nunca se envían a la IA**: solo
     se colocan como original. Para que la IA dibuje a Ketsi, sube en Mi marca una copia con uso «Transformable con
     IA».
4. Pulsa **«Revisar alcance y costo»**. Verás el costo estimado. Marca la confirmación de que la generación usa tu clave
   de OpenAI y puede tener costo, y pulsa **«Generar N propuestas»**.
5. Revisa cada propuesta: «Aprobar», «Solicitar cambios y generar variante», «Rechazar» o «Eliminar». Aprobar no crea
   ninguna plantilla; con una propuesta aprobada, pulsa **«Crear plantilla»** (sección 9.2).

**Límites configurados** (en `providers.images` de `config/dev-images.config.json` y `config/dev-full.config.json`):

- hasta 4 imágenes por petición y 4 referencias;
- 20 imágenes al día;
- USD 10 de gasto calculado al mes;
- una generación a la vez.

Los precios y modelos se cambian solo en la configuración. Nada se envía a OpenAI al arrancar, en las pruebas ni en la
compilación.

### 8.2 Copy editorial con IA (texto)

**Necesitas:**

1. Una cuenta de la API de OpenAI con saldo.
2. La clave en `.env.local`: `EDR_AI_API_KEY=…`.
3. Arrancar con `config/dev-full.config.json`, la única que configura el redactor de OpenAI (`providers.editorial`: el
   modelo, el tiempo máximo y los precios).

**Cómo se usa:**

1. En la revisión del proyecto, abre «Copy editorial».
2. Revisa el «Costo de la generación» y marca «Confirmo el costo estimado de esta generación».
3. Pulsa «Generar copy editorial». **Cada generación pide la confirmación del costo.**

**Límites configurados:** 30 generaciones al día y USD 5 al mes.

Sin la clave, el panel indica que el redactor no está listo. En las demás configuraciones se usa el «Texto de prueba
(sin IA)», sin coste.

### 8.3 Textos de las diapositivas

Los titulares y las descripciones de las diapositivas los escribe siempre un redactor determinista, sin IA y sin coste.
Los nombres de equipos, los marcadores y las fechas se rellenan con tus datos.

## 9. Plantillas: crear, publicar y usar

### 9.1 Plantillas del motor

- Están siempre disponibles y no se editan: «Portada», «Resultado de partido», «Tabla de posiciones», «Calendario de
  jornada», «Partido programado», «Previa de partido» y «Cierre».
- Puedes verlas en **Plantillas → «Plantillas del motor»**.
- Usan la paleta y las tipografías de tu marca y los escudos de los equipos.

### 9.2 Crear una plantilla visual (desde una propuesta aprobada)

1. En una propuesta aprobada, pulsa **«Crear plantilla»**. Rellena:
   - «Nombre de la plantilla»;
   - «Tipo de contenido de la plantilla» («Portada», «Resultado de partido», «Calendario de jornada», «Partido
     programado», «Previa de partido» o «Cierre»). **No se puede cambiar después.**
   - la casilla de que revisarás el fondo antes de publicar.

   Pulsa «Crear borrador» y se abrirá el **«Editor de plantilla»**.
2. **Añade capas** con «Agregar capa». Los tipos son:
   - «Texto» (fijo);
   - «Dato deportivo», vinculado a un dato: «Competición», «Temporada», «Fase», «Jornada», «Equipo local», «Equipo
     visitante», «Fecha del partido», «Hora del partido», «Estado del partido», «Marcador», «Goles del local», «Goles
     del visitante»;
   - «Imagen de Mi marca», «Logotipo oficial» y «Ketsi»;
   - «Escudo local» / «Escudo visitante», solo en plantillas de partido;
   - «Lista de partidos», solo en «Calendario de jornada»: una fila por partido, con escudos, nombres, fecha, hora y
     estado.
3. **Estilo de cada texto:**
   - «Familia», tamaños máximo y mínimo, «Líneas máximas» y color de la paleta;
   - alineación horizontal y vertical;
   - «Si el texto no cabe»: reducir hasta el tamaño mínimo o mantener un tamaño fijo;
   - «Efecto» (sombras, brillos, contorno, marcador dorado) y «Mostrar en mayúsculas».
4. **Datos obligatorios:** el panel «Validación» los exige según el tipo. Por ejemplo, «Resultado de partido» necesita
   los dos equipos y el marcador, y «Calendario de jornada» necesita «Partidos de la jornada». Los errores impiden
   publicar.
5. **Vista previa con datos locales:** cambia a «Vista previa», elige «Competición», «Temporada», «Jornada» y «Partido»,
   y pulsa «Previsualizar». La dibuja el mismo motor que las diapositivas finales, con tus datos, tus escudos y los
   nombres de presentación.
6. **Guarda y publica:** «Guardar borrador» y después **«Publicar plantilla»**. Una versión publicada es **inmutable**.

### 9.3 Usar y mantener las plantillas

- **Usarla:** en «Crear contenido», paso 4 «Plantilla», elige la plantilla visual publicada (formato 4:5) para su tipo
  de diapositiva.
- **Cambiarla:** pulsa «Crear nueva versión», edita y publica. Cada proyecto conserva la versión con la que se creó, así
  que **los proyectos anteriores no cambian**.
- **Retirarla:** «Archivar» la oculta para los proyectos nuevos y «Restaurar» la recupera. «Eliminar» solo está
  disponible en plantillas nunca publicadas o archivadas. Una plantilla archivada sigue dibujando los proyectos que ya
  la usaron.

## 10. Pruebas y comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidores de desarrollo (API 4300 + web 5173). |
| `npm run build` / `npm start` | Compila / arranca la versión compilada (4300). |
| `npm run typecheck` | Comprueba los tipos de todo el proyecto. |
| `npm run lint` | ESLint (incluidas las reglas de seguridad) y Prettier. |
| `npm run format` | Formatea el código con Prettier. |
| `npm run test:unit` | Pruebas unitarias (servidor y web). |
| `npm run test:integration` | Pruebas de integración de la API con datos sintéticos. |
| `npm run test:contract` | Conformidad con el contrato HTTP (`contracts/http-api.openapi.yaml`). |
| `npm run test:e2e` / `npm run test:a11y` | Compila y ejecuta los recorridos en navegador / las pruebas de accesibilidad (puerto 4310, datos temporales). |

Las pruebas usan siempre datos sintéticos y directorios temporales. Nunca usan claves reales ni tu carpeta `data/`, y
bloquean cualquier conexión a internet.

## 11. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| `npm ci` falla por la versión de Node | Hace falta exactamente Node 22.22.2: `nvm install && nvm use`. |
| Error **421** o «Misdirected Request» | Estás entrando por una dirección no permitida. Usa `http://127.0.0.1:5173` en desarrollo o `http://127.0.0.1:4300` en el modo compilado. |
| El servidor no arranca: `migration_unknown_applied` | La base de `data/` es más nueva que el código. Actualiza el código (`git pull`) o usa la carpeta de datos que corresponde a esa versión. |
| Una migración nueva se aplicó a mi base sin querer | En `npm run dev` la API se reinicia con cada cambio y aplica las migraciones pendientes. Para probar cambios que traen migraciones, detén el servidor o usa otra carpeta: `EDR_DATA_DIR=/tmp/edr-pruebas npm run dev`. |
| Puerto ocupado (4300, 5173 o 4310) | Otro proceso lo usa: detenlo, o cambia la API con `EDR_PORT`. |
| «Falta la clave del proveedor de IA de texto» | Pon `EDR_AI_API_KEY` en `.env.local`, arranca con `config/dev-full.config.json` y reinicia. |
| No aparece «Crear diseño con IA» o falla el acceso al modelo | Arranca con `dev-images` o `dev-full`, revisa `EDR_IMAGE_API_KEY` y pulsa «Comprobar acceso al modelo». |
| No veo mis cambios de código en `:4300` | Ese puerto sirve la versión compilada. Usa `:5173` o ejecuta `npm run build`. |
| «Aprobar carrusel completo» está deshabilitado | Faltan diapositivas por aprobar o alguna está bloqueada. Usa «Aprobar todas (N)» y revisa los motivos que indica el botón. |
| No hay botón «Descargar carrusel» | Primero hace falta la aprobación final del carrusel. El copy se puede descargar aparte en «Copy editorial». |

## 12. Estructura del repositorio y documentación

```text
apps/server/       servidor Fastify: módulos (src/modules/*), proveedores (src/providers/*), migraciones (migrations/)
apps/web/          interfaz React (Vite)
packages/contracts esquemas compartidos (Zod) del contrato HTTP y del dominio
contracts/         contrato HTTP declarado (OpenAPI)
config/            configuraciones sin secretos (sección 3)
fixtures/          datos sintéticos para pruebas y ejemplos de importación
e2e/               pruebas en navegador y de accesibilidad
docs/              documentación técnica y de diseño
data/              tus datos (se crea al arrancar; ignorada por Git)
```

- [docs/local-setup.md](docs/local-setup.md): instalación, puertos, credenciales y condiciones de uso.
- [.orchestrate/source-of-truth.md](.orchestrate/source-of-truth.md): decisiones, reglas de negocio y contrato.
- [docs/design/](docs/design/): diseño e informes de cada fase (por ejemplo, `TEAM-DISPLAY-01` para los nombres de
  presentación).
