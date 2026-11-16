# Instrucciones para agentes de código

Este archivo es para Codex y para cualquier agente que lea `AGENTS.md`. Claude Code lee [`CLAUDE.md`](CLAUDE.md). Los
dos archivos describen el mismo proyecto y las mismas reglas. La guía completa está en el [README](README.md), en las
secciones 13 (agentes de código) y 14 (ramas, commits y Pull Requests).

## Antes de cambiar nada, lee

1. [`README.md`](README.md): instalación, funcionamiento, comandos y las secciones 13 y 14.
2. [`CLAUDE.md`](CLAUDE.md): el proyecto usa el framework de orquestación *orchestrate*. Su configuración es
   `.orchestrate/config.json` y su fuente de verdad es `.orchestrate/source-of-truth.md`.
3. [`.orchestrate/source-of-truth.md`](.orchestrate/source-of-truth.md): stack, arquitectura, decisiones (PD, AD, OD),
   reglas de negocio (BR), restricciones de seguridad (SC), contrato y pendientes (sección 9). Es la referencia
   principal: si algo de aquí la contradice, manda la fuente de verdad.
4. [`.orchestrate/config.json`](.orchestrate/config.json): formato de ramas, gates obligatorios, hash del contrato y
   autorizaciones.
5. [`contracts/http-api.openapi.yaml`](contracts/http-api.openapi.yaml): el contrato HTTP declarado.
6. [`docs/design/`](docs/design/): el informe de cada iniciativa relacionada con tu tarea.

## Reglas esenciales

El detalle está en el README, sección 13.3.

- Trabaja en `work/<ID>` (o en `task/<ID>/<taskId>`), creada desde `main` actualizado. `<ID>` es el identificador
  registrado en la fuente de verdad. Nunca hagas commit directo en `main`.
- No hagas merge a `main`, push ni deploy sin autorización explícita del Product Owner.
- No modifiques las migraciones existentes (`apps/server/migrations/`). Un cambio de esquema es una migración nueva.
- No cambies el contrato HTTP ni añadas dependencias sin una decisión del Product Owner. Las versiones son exactas.
- Usa solo datos sintéticos y `config/dev.config.json`, que no hace llamadas pagadas. Usa una carpeta de datos
  desechable (`EDR_DATA_DIR=/tmp/edr-agente`). Nunca uses la carpeta `data/` real.
- Los secretos van solo en `.env.local`, que nunca se sube. No los escribas en la configuración, el código ni los
  commits.
- Respeta las invariantes de la versión 1.0 (PD-36):
  - la IA de imágenes solo genera propuestas para plantillas;
  - las diapositivas finales se renderizan con Satori/resvg, sin IA de imágenes;
  - las aprobaciones gráficas y editoriales son independientes;
  - las exportaciones históricas no se modifican.
- No introduzcas datos de personas (PD-04, SC-07) ni escudos que no haya cargado el operador (PD-28).
- No elimines una prueba porque falle: corrige la causa.
- Detente y pregunta antes de cualquier decisión de producto, arquitectura, contrato o seguridad.

## Antes de entregar

- Ejecuta los gates del README, sección 14.4, y adjunta sus resultados.
- Escribe un informe en `docs/design/<ID>/`.
- Si hubo decisiones, actualiza la fuente de verdad.
- Commits: `tipo(alcance): descripción`, en inglés y en imperativo (README, sección 14.2).
