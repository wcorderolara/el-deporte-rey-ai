# WI-2.1 — Static Content Format Roadmap

Status: Product scope approved; format implementation deferred to separate work items
Date: 2026-10-29

## 1. Supported-format target

| Content type | Preset | Resolution | Assets | Text deliverables | Current implementation status |
| --- | --- | --- | --- | --- | --- |
| Instagram carousel | Portrait 4:5 | 1080 × 1350 | Multiple ordered static images | Headline, description, caption, hashtags | Implemented by WI-1 and the baseline for the visual redesign. |
| Social post — portrait | Portrait 4:5 | 1080 × 1350 | One static image | Headline, description, caption, hashtags | Not implemented as a first-class single-image type. |
| Social post — square | Square 1:1 | 1080 × 1080 | One static image | Headline, description, caption, hashtags | Not implemented. |
| Story | Vertical 9:16 | 1080 × 1920 | One static image | Headline/supporting copy; optional caption variant | Not implemented. |
| Reel/TikTok cover | Vertical 9:16 | 1080 × 1920 | One static cover image | Headline/supporting copy; optional platform-oriented text | Not implemented. It is never a video deliverable. |
| Text content | No canvas | Not applicable | None required | Headlines, captions, descriptions, hashtags, copy variations | Partially implemented inside carousel drafts/exports; not yet a standalone creator flow. |

“Platform-oriented” describes wording and layout intent only. It does not imply an account connection, upload, scheduling, analytics, or publishing integration.

## 2. Current carousel-centric assumptions

WI-1 is correctly optimized for carousel delivery. Additional formats require deliberate later changes because:

- Configuration exposes one global canvas (`width`, `height`) and `maxSlidesPerCarousel`.
- Project creation has no persisted creator-facing content type or canvas preset.
- Content generation produces drafts containing carousels, ordered slide elements, and a caption element.
- Review/final approval and API paths are carousel-oriented.
- Template metadata distinguishes slide types but not compatible content types, canvas presets, or safe zones.
- Template layouts originate from a 1080 × 1350 reference, even though the render model records canvas dimensions.
- Export writes ordered `01.png`…`NN.png`, `caption.txt`, and `manifest.json` through a carousel export operation.
- UI routes, labels, tests, and review behavior assume multiple slides.
- Visual QA validates the existing template/render model, not format-specific safe zones for 1:1 or 9:16.

Therefore, adding a format card to the UI alone would be misleading. Format availability must be driven by implemented, contract-backed capabilities.

## 3. Target format architecture

Before the first additional format, define and approve an additive format architecture. Recommended concepts:

- **Content type:** `carousel`, `social_post`, `story`, `reel_cover`, and optionally `text_only`.
- **Canvas preset:** stable identifier plus width, height, and aspect ratio; e.g. `portrait_4_5`, `square_1_1`, `vertical_9_16`.
- **Creative asset:** one reviewable static image and its text fields, facts, template, render model, QA, versions, and approval state.
- **Asset group:** one or more assets plus associated text deliverables. A carousel is an ordered multi-asset group; a post/story/cover is a single-asset group.
- **Template compatibility:** supported content types, canvas presets, asset role, version, image slots, and safe-zone definition.
- **Text package:** headline, description, caption, hashtags, and named copy variations, independently copyable/exportable where applicable.

These are planning concepts, not approved schema or contract names. Architecture must decide final names and compatibility with the existing carousel model.

### Required architectural work

1. Persist content type and canvas preset on the project/creative request, with existing projects defaulting to carousel + portrait 4:5.
2. Make the workflow snapshot record the selected format/template compatibility needed for deterministic regeneration.
3. Extend or adapt content planning so a single asset does not require fake carousel-specific UI behavior.
4. Add format-aware template registries/layouts and visual-QA checks, including 9:16/square safe zones and overflow rules.
5. Preserve fact bindings, provenance, data blockers, versioning, item approval, final approval, invalidation, and traceability for every format.
6. Define additive API contract changes under PD-11, with a full Contract Safety assessment and updated typed schemas. Do not break existing carousel endpoints or clients.
7. Add data migration/default behavior for existing projects and exports.
8. Define download packaging and filenames for single images and text-only outputs while preserving manifest integrity.
9. Keep DEMO_DATA labelling and operator-attested metadata across every format.
10. Re-run security/design review if a format introduces a new input type, external service, raised limit, or other SC-05 trigger. Static canvas changes alone do not authorize any such trigger.

### Required UI work

- Format chooser with accurate thumbnail, dimensions, asset count, and availability.
- Format-aware creation summary and estimated output.
- Editor shell that switches between multi-asset rail and single-asset mode.
- Aspect-ratio-accurate preview and safe-zone guidance.
- Compatible template filtering.
- Format-specific text fields without social-account settings.
- Format-aware final review and **Descargar contenido** packaging summary.
- Project/history cards that identify format without exposing internal IDs.

## 4. Incremental rollout after the initial redesign

The UI-01 through UI-06 redesign must stabilize the existing carousel first. New formats follow separate architecture/product work items:

### SF-00 — Format architecture and contract proposal

- Decide the content-type/asset-group model.
- Produce data-model and additive API-contract proposals.
- Define template compatibility, safe zones, QA, approval, trace, and export rules.
- Decide how existing carousel projects migrate/default.
- No user-facing new format is enabled in this phase.

### SF-01 — Single portrait social post (4:5)

- Closest reuse of the existing 1080 × 1350 renderer and templates.
- Deliver one static image plus text package.
- Introduce single-asset editor behavior and download packaging.
- Validate that no carousel-only labels/actions appear.

### SF-02 — Square social post (1:1)

- Add 1080 × 1080 templates and QA rules.
- Validate hierarchy, standings density, and brand composition for a shorter canvas.
- Reuse the single-asset review/download model from SF-01.

### SF-03 — Story (9:16)

- Add 1080 × 1920 story templates and vertical safe zones.
- Optimize mobile preview while keeping full editing desktop/tablet first.
- Keep output strictly static.

### SF-04 — Reel/TikTok cover (9:16)

- Reuse the vertical canvas infrastructure but use cover-specific templates and safe-zone guidance.
- Label the output **Portada estática**, never video.
- Do not add media upload, video preview, audio, duration, timeline, or publishing controls.

### SF-05 — Standalone text content and copy variations

- Provide a focused text-only creation/review/download/copy flow.
- Decide the approved set of copy variations and length guidance before implementation.
- Preserve fact provenance and approval for fact-bearing copy.

The exact order after SF-01 may change based on creator research, but SF-00 and the 4:5 single-image foundation should precede 1:1 and 9:16 work.

## 5. Format-specific approval and traceability principles

- A carousel retains per-slide approval, caption approval, and final approval.
- A single-image format requires approval of the image/text asset and an explicit final approval unless the Product Owner later decides otherwise through a recorded decision.
- Text-only fact-bearing content must retain provenance, blockers, approval, and immutable exported versions.
- Regeneration/editing invalidates the affected approval and any dependent final approval.
- Every downloaded asset remains traceable to its data, template, version, and approval state.

## 6. Absolute exclusions

No format phase may introduce:

- Social login, account connection, credentials, upload, publishing, or scheduling.
- Social analytics, comments, messages, or account management.
- Video generation, editing, encoding, animation, audio, duration, transitions, or timelines.
- Claims that a static cover is a completed Reel/TikTok video.

