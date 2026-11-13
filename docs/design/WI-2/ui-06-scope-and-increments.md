# UI-06 — Estabilización, responsive y accesibilidad: alcance e incrementos

**Estado:** UI-06.1 aceptado por el Product Owner y cerrado el 2026-11-13 en `bcdecc7` (recuperación de las suites y
corrección de E2E-F01). UI-06.2 aceptado por el Product Owner y cerrado el 2026-11-13 en `c2defce` (responsive,
accesibilidad, O-1 y O-2). UI-06.3 aceptado por el Product Owner y cerrado el 2026-11-13 como incremento técnico. Con él UI-06 queda terminado;
WCAG 2.2 AA no se declara y la v1.0 no ha pasado la validación manual.
**Rama:** `work/WI-2-UI-06`, creada desde `9f5963fa0517ac4220acf4577fe92f3188c6217f` (cierre de REVIEW-APPROVAL-01).
**Origen:** instrucción del Product Owner «WI-2 / UI-06 — Estabilización, responsive y accesibilidad» (2026-11-13) y la
sección UI-06 de [`incremental-ux-ui-implementation-plan.md`](incremental-ux-ui-implementation-plan.md).

## 1. Objetivo

Dejar el flujo de creación de carruseles listo para el uso diario dentro de la arquitectura local actual: suites E2E y
de accesibilidad recuperadas, adaptación responsive, WCAG 2.2 AA y las inconsistencias técnicas pendientes resueltas.
No se rediseñan las interfaces aprobadas ni se reabren REVIEW-APPROVAL-01, PD-ARCH-01G-E ni sus decisiones.

## 2. Límites que aplican a todo UI-06

- Sin merge, push ni deploy. Sin commit hasta que el Product Owner acepte el incremento.
- Sin llamadas a proveedores deportivos ni a OpenAI: las suites usan los adaptadores `stub` (texto de diapositivas y
  copy editorial) y las imágenes se dibujan en local. No se generan costos de IA.
- Datos sintéticos y bases temporales: cada ejecución usa un directorio temporal fuera del repositorio; nunca
  `data/edr.sqlite`.
- Sin cambios en reglas de negocio, contratos (salvo el registro del hash con evidencia, sección 5 del informe de
  UI-06.1), migraciones anteriores ni funcionalidades ajenas. Sin proveedores nuevos.
- Sin una segunda arquitectura de componentes para móvil: las distribuciones de escritorio se adaptan.
- Por instrucción explícita del Product Owner, UI-06 ejecuta las suites de Playwright y de accesibilidad. PD-UI-21
  sigue vigente como regla general; esta instrucción la deja en suspenso solo para este trabajo.

## 3. Incrementos

### UI-06.1 — Recuperación de E2E y accesibilidad automatizada

Alcance:

- Diagnóstico de cada prueba E2E y de accesibilidad: interfaz anterior, selectores, rutas retiradas, navegación,
  aprobación, exportación, fixtures y pruebas que ya no corresponden al producto.
- Arnés: la configuración generada incluye la fuente de competiciones locales, con la que el producto crea contenido
  desde PD-ARCH-01F; las capturas de evidencia dejan de sobrescribir la evidencia aceptada de `docs/`.
- Pruebas actualizadas al comportamiento aprobado. Prioridad: crear contenido, seleccionar competición y jornada,
  generar el proyecto, revisar y aprobar diapositivas, revisar y aprobar copy, aprobar el carrusel gráfico de forma
  independiente, descargar el carrusel y verificar que la exportación lleva el copy aprobado.
- Escaneo axe (WCAG 2.0/2.1/2.2 A y AA, impactos serio y crítico) de las pantallas principales con sus datos cargados.
- Inconsistencias técnicas con evidencia: el hash registrado del contrato y el formato de Prettier de los tres archivos
  señalados. Clasificación de las 13 advertencias moderadas de `npm audit`, sin actualizar dependencias.
- Sin cambios en el código de la aplicación salvo los que una prueba demuestre necesarios y el Product Owner apruebe.
- Añadido por el Product Owner el 2026-11-13: la corrección del defecto E2E-F01 (cada descarga lleva solo el copy
  aprobado y publicable en ese momento; sección 4.1 del informe) y la frase del panel del copy que contradecía PD-33
  (sección 4.2). Condición del cierre: la corrección funciona, no introduce regresiones y todas las verificaciones
  pasan.

Criterios de aceptación:

1. `npm run test:e2e` y `npm run test:a11y` terminan sin fallos en un árbol limpio, sin red externa y sin datos reales.
2. Cada prueba que fallaba está corregida al comportamiento aprobado o sustituida por una equivalente, con la
   correspondencia documentada; ninguna se elimina solo por fallar.
3. El recorrido principal (puntos 1 a 9 de la prioridad) pasa en el navegador y comprueba el contenido del ZIP
   descargado, incluido `copy-editorial.txt`.
4. Los hallazgos de accesibilidad reales quedan listados con su pantalla, regla y propuesta; los que el incremento no
   corrige quedan asignados a UI-06.2 sin silenciarlos en la suite.
5. Las verificaciones existentes (typecheck, ESLint, Prettier, unitarias, integración, contrato, build, auditoría)
   siguen pasando.
6. Ejecutar las suites no deja cambios en el árbol de trabajo.
7. E2E-F01: la prueba de regresión del recorrido pasa sin marca de fallo esperado y falla si la descarga vuelve a
   entregar un copy desactualizado (comprobado con una mutación temporal).

Resultado: todos los criterios se cumplen (informe, secciones 4.1 y 8).

### UI-06.2 — Adaptación responsive y correcciones de accesibilidad

Alcance (sujeto a validación del Product Owner tras UI-06.1):

- Anchos 1440, 1280, 1024, 768 y 390 px en navegación lateral, competiciones, temporadas y jornadas, generación,
  revisión de diapositivas, revisión editorial, plantillas, Mi marca y proyectos.
- WCAG 2.2 AA: teclado, foco visible y su orden, contraste, etiquetas, estados deshabilitados, diálogos, pestañas,
  formularios, errores, anuncios de estado, controles de zoom, barras laterales contraíbles, tamaño de objetivos,
  reflow a 320 px CSS (400 % de zoom), espaciado de texto, colores forzados y movimiento reducido.
- Correcciones de los hallazgos registrados por UI-06.1 (sección 4.4 del informe), asignados a este incremento por el
  Product Owner el 2026-11-13: A11Y-01 (contraste de la trazabilidad), A11Y-02 (nombre accesible de las miniaturas),
  R-02 (tooltip de Inicio a 768 px) y R-03 (vista previa de la revisión a 1280 × 720). Siguen declarados en la suite
  hasta que se corrijan. O-1 y O-2 quedan a la espera de la decisión del Product Owner.
- Mientras estos hallazgos sigan abiertos no se declara el cumplimiento de WCAG 2.2 AA.
- Instrucción del Product Owner del 2026-11-13 («WI-2 / UI-06.2 — Responsive, accesibilidad y corrección de
  hallazgos»): criterios AC-01 a AC-12, sin commit hasta su aceptación, sin actualizar `@fastify/static`, sin tocar
  la política de exportaciones, PD-33 ni PD-34, y O-1 y O-2 presentadas sin asumir la decisión.

Criterios de aceptación:

1. Cada pantalla priorizada se usa en los cinco anchos sin desplazamiento horizontal de la página ni funciones
   inaccesibles; las distribuciones de tres columnas se apilan en pantallas pequeñas.
2. Sin violaciones axe serias o críticas y sin bloqueos manuales de teclado o reflow en esas pantallas.
3. La identidad visual aprobada no cambia; cada cambio visible tiene evidencia antes y después.

Resultado: aceptado por el Product Owner y cerrado el 2026-11-13 (informe, sección 18). A11Y-01, A11Y-02, R-02 y
R-03 corregidos y sus excepciones retiradas de la suite; la validación encontró y corrigió R-04 (editor de plantillas
por debajo de 900 px), R-05 (título de Competiciones a 320 px) y A11Y-03 (tooltips sin cierre con Escape, WCAG
1.4.13); 34 pantallas y estados medidos en los cinco anchos, al 200 % y a 320 px. O-1 (nota de Mi marca) y O-2
(nombres accesibles de las acciones de equipos) aprobadas e implementadas (PD-35). WCAG 2.2 AA no se declara: faltan
lectores de pantalla, zoom real, colores forzados, dispositivos físicos y navegación compleja por teclado. Informe:
[`ui-06-2-responsive-a11y-report.md`](ui-06-2-responsive-a11y-report.md).

### UI-06.3 — Regresión integral y estabilización final

Alcance (sujeto a validación del Product Owner tras UI-06.2):

- Regresión de todas las suites y de los gates configurados.
- Casos límite del plan de UI-06: textos largos en español e inglés, 20 diapositivas, conjuntos máximos de datos y
  errores de importación, estados lentos y fallidos, generación interrumpida.
- Auditoría de CSS Modules restantes (M5 de `tailwind-v4-migration-strategy.md`).
- Actualizaciones de dependencias que el Product Owner apruebe a partir de la clasificación de UI-06.1. Candidata:
  `@fastify/static` 10.1.11 (mismo mayor; sección 7.3 del informe), que necesita una autorización aparte.
- Pendientes que deja UI-06.2 (su informe, sección 18.3): trazabilidad con una disputa entre fuentes, la validación
  manual de accesibilidad si el Product Owner la incluye, y el color del enlace de la página de error de sección
  dentro de las páginas del estudio.

Criterios de aceptación:

1. Todos los gates configurados pasan, o cada excepción queda documentada con su decisión.
2. Las limitaciones conocidas quedan registradas en la fuente de verdad.

Instrucción del Product Owner del 2026-11-13 («WI-2 / UI-06.3 — Regresión integral y estabilización final»): define la
v1.0 (registrada como PD-36), autoriza evaluar y aplicar solo `@fastify/static` 10.1.11, pide escenarios extremos de
carrusel, datos deportivos y copy, errores y recuperación, una disputa entre fuentes, la auditoría de CSS Modules, una
revisión estructurada de accesibilidad y la página de error de sección, con los criterios AC-01 a AC-12, sin commit
hasta su aceptación.

Resultado: aceptado por el Product Owner y cerrado el 2026-11-13 como incremento técnico, con D06, D07 y D08
corregidos y TEAM-DISPLAY-01 separado como iniciativa posterior. Informe:
[`ui-06-3-regression-stabilization-report.md`](ui-06-3-regression-stabilization-report.md) (sección 22).

## 4. Documentos

- Informe de UI-06.1: [`ui-06-1-e2e-a11y-recovery-report.md`](ui-06-1-e2e-a11y-recovery-report.md).
- Informe de UI-06.2: [`ui-06-2-responsive-a11y-report.md`](ui-06-2-responsive-a11y-report.md).
- Informe de UI-06.3: [`ui-06-3-regression-stabilization-report.md`](ui-06-3-regression-stabilization-report.md).
