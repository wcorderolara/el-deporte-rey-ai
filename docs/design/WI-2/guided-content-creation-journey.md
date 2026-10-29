# WI-2.1 — Guided Content Creation Journey

Status: Approved journey direction; implementation not authorized
Date: 2026-10-29

## 1. Journey objective

Help a first-time sports content creator move from sports information to approved, downloadable static graphics and text with the fewest reasonable decisions. Preserve verification, QA, approval, and traceability without forcing the creator to understand the technical workflow.

The persistent saved object is a **Proyecto**. The primary action is **Crear contenido**. The chosen output is a content format, such as Carrusel, Portada para Reel, Historia, or Publicación.

## 2. Five-stage journey

### Stage 1 — Definir contenido

**Creator goal:** Understand and select what will be created.

Visible choices:

1. Static content format.
2. Competition.
3. Season.
4. Stage, matchday, or whole-stage selection.
5. Content language.

Behavior:

- Show only formats actually available in the running product. During the initial redesign, Carrusel is the available format; later formats appear only when their separate work items are implemented.
- Use cards or a compact selector with an accurate aspect-ratio preview.
- Default Spanish, the current season, the recommended selectable source, and a sensible period where the data makes that recommendation safe.
- Explain the output in creator language: number/type of graphics, aspect ratio, and expected text deliverables.
- Keep source identifiers, cache details, retrieval timestamps, and adapter names out of the default view.

Primary action: **Continuar con los datos**.

Exit condition: format and sports selection are complete and understandable.

### Stage 2 — Confirmar datos

**Creator goal:** Confirm that the correct sports information will drive the creative.

Entry choices:

- **Obtener resultados automáticamente** — LIVE_DATA when configured and available.
- **Cargar resultados manualmente** — MANUAL_DATA through JSON, CSV, or form.
- **Probar con datos de demostración** — DEMO_DATA, always labelled synthetic.

Default view:

- Competition, season, stage/matchday.
- Matches/results included.
- Standings availability.
- Data-readiness status: Ready, Needs attention, or Cannot continue.
- Concise verified/unverified/operator-attested summary and its approval impact.
- Retrieval/import freshness in plain language.

Secondary view: **Ver detalles de verificación**, containing sources, evidence, disputes, provenance, references, import versions, and technical identifiers.

Manual path:

- Allow file import or form entry without leaving the guided workflow conceptually.
- Reuse the dedicated import capability and validation rules rather than creating a second importer.
- Preserve all-or-nothing validation and show every error with a correction path.
- After a successful import, return to the data preview with the imported selection active.

Primary action: **Confirmar datos y generar**.

Exit condition: the user explicitly confirms the data. Existing verification and publication-eligibility rules decide whether later approval is possible; the UI never upgrades an unverified state.

### Stage 3 — Generar contenido

**Creator goal:** Let the system create the first usable draft while understanding progress and recovery.

The guided action sequences the existing project creation and full generation behavior. User-facing progress groups the technical workflow into understandable states:

1. Preparando datos.
2. Creando textos.
3. Diseñando gráficos.
4. Comprobando calidad.

Technical stage/run details remain available under **Ver detalles técnicos**.

Required states:

- Not started.
- In progress with current activity.
- Recoverable failure with plain-language cause and retry.
- Project saved but generation failed.
- Completed with generated previews.

On completion:

- Remain on the completion view.
- Show representative previews, asset count, format, and any warnings.
- Present **Revisar contenido** as the prominent next action.
- Do not redirect automatically.

Exit condition: a generated draft exists or the user has a clear recovery action.

### Stage 4 — Personalizar y revisar

**Creator goal:** Make the creative accurate, on-brand, and approved.

Desktop editor:

```text
┌─────────────────┬─────────────────────────────┬──────────────────────┐
│ Asset navigation│ Large accurate preview      │ Editing inspector    │
│ thumbnails      │ selected aspect ratio       │ text/template/brand  │
│ status/issues   │ visual feedback             │ QA/review/actions    │
└─────────────────┴─────────────────────────────┴──────────────────────┘
```

Left panel:

- Ordered slide/asset thumbnails.
- Approval and issue state with text/symbol, not color alone.
- Previous/next navigation and filters.
- Ordering for carousels; no unnecessary rail for a single-image format.

Center panel:

- Large preview at the selected aspect ratio.
- Fit-to-workspace and enlarged inspection.
- Clear selected asset and generation/update feedback.
- No direct-manipulation promise until the supporting editing behavior exists.

Right panel:

- Headline, supporting text, caption, and hashtag editing where supported.
- Compatible template selection.
- Authorized brand settings/assets.
- Regenerate selected content.
- QA warnings, blocking data, approval state, withdrawal, and final-approval controls.

Review sequence:

1. Inspect selected asset and its issues.
2. Resolve blocking data, text, or QA warnings.
3. Approve using **Aprobar y siguiente**.
4. Approve caption/text deliverables individually where required.
5. Give explicit final approval after all required items are approved.

No bulk approval is included. Regeneration or edits invalidate affected approval exactly as today.

Tablet uses preview plus inspector with a horizontal asset rail. Mobile supports focused preview/review, previous/next, issue visibility, approval, and download preparation; advanced editing may direct the user to tablet/desktop.

Exit condition: valid explicit final approval exists.

### Stage 5 — Descargar

**Creator goal:** Obtain all approved assets and copy for manual use outside the platform.

Primary action: **Descargar contenido**.

Download summary:

- Static PNG images in the approved order.
- Captions, headlines, descriptions, and hashtags as applicable.
- Copy-to-clipboard controls for text where available.
- Manifest and technical file details where applicable.
- Destination and file list after generation.

History:

- Keep immutable local export records.
- Reopen the exact exported versions.
- Preserve hashes, manifest, data-mode labels, and slide-to-fact traceability.
- Use **Ver detalles de exportación** for technical records; do not make IDs/directories the primary success message.

The flow ends at download. There is no publish, schedule, upload, account connection, or social-platform credential action.

## 3. Data-mode branches

| Mode | Creator wording | Main-flow behavior | Required safeguards |
| --- | --- | --- | --- |
| LIVE_DATA | Obtener resultados automáticamente | Retrieve and preview supported data; offer manual fallback when unavailable | Never claim real-time; show verification/readiness; preserve permission and independent-source gates. |
| MANUAL_DATA | Cargar resultados manualmente | JSON, CSV, or guided form; return to preview after validation | Preserve originals, versions, all-or-nothing validation, operator-attested semantics, and manual-approval restrictions. |
| DEMO_DATA | Probar con datos de demostración | Fast safe trial of the complete creation journey | Persistent synthetic warning in project, preview, graphics, manifest, and history. |

## 4. Recovery model

| Failure point | Saved state | User-facing recovery |
| --- | --- | --- |
| Catalogue/data unavailable | No project yet unless already created | Retry; change automatic source when allowed; choose manual import; use demo data. |
| Manual validation rejected | Draft form/file remains local; rejected import not stored | Show complete error summary, retain correctable input where safe, retry. |
| Project created, generation failed | Project persists | Explain that the project is safe; retry generation from the project workspace. |
| Generation stage failed | Run diagnostics persist | Plain-language failure plus retry/restart; technical details optional. |
| Regeneration failed | Prior version remains | Keep current approved/unapproved state visible; retry selected asset. |
| Approval refused | Draft persists | Name blocking asset/data/QA reason and link to the exact resolution. |
| Download failed | Final approval and project persist | Retry download; do not require reapproval unless the approved version set changed. |

## 5. Success measurement

Primary measurement: elapsed time from the first **Crear contenido** action to a successful **Descargar contenido** result for a first-time creator using an eligible scenario.

Secondary measurements:

- Percentage completing all five stages.
- Number of nonessential decisions and backtracks.
- Interaction count by stage.
- Time and interactions spent resolving approval blockers.
- Time from visible error to successful recovery.
- Post-task confidence rating and comprehension of data status.

Because the current product is local and single-operator, initial measurement can use moderated usability sessions and test observations. No remote analytics service or user tracking is implied.
