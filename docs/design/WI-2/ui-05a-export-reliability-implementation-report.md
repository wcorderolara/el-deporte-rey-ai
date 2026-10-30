# UI-05A — Export reliability and download

Status: Accepted by the Product Owner on 2026-10-30; committed on `work/WI-2.1-ui-05a`.

## Findings and behavior

Exports were already generated and persisted. The configured default is `dataDir: "data"`; configuration resolves that relative to the repository root (not the process working directory). Thus the default location is `<repository-root>/data/exports/<projectId>/<exportId>/`, while the API records the data-root-relative value `exports/<projectId>/<exportId>`. Existing inspected folders contained PNGs, `caption.txt`, and `manifest.json`. The operator-facing issue was that this relative location was easy to misinterpret and the browser had no artifact download route. Export generation was not prematurely claiming success: file writes are awaited before the database record is created. UI-05A additionally reads the files back and checks their expected SHA-256 before recording.

The existing export service requires a currently valid final approval on the server. It checks the approved current version set, rejects superseded drafts or blocked content, and writes precisely those approved versions. It sorts included slide versions by stored carousel position and then writes one caption and one manifest. The number of images is therefore the actual slide structure that passed generation/splitting and final approval; it is not calculated from matches, stages, or a fixed display count. The content planner groups included results into generated carousels up to configured `maxSlidesPerCarousel` (with a cover and closing slide per split); standings are included only when usable rows are available, paginated by `standingsRowsPerSlide`, and placed according to planner rules. Match exclusions affect the generated structure upstream. Export uses only the selected carousel’s exact approved version set, in stored slide position order.

## Changes

- Added `GET /exports/{exportId}/download` (`application/zip`). It reads only allowlisted filenames under UUID-derived directories, verifies each stored SHA-256 and the manifest hash, and returns a safe `carrusel-<id-prefix>.zip` filename. Missing artifacts return `EXPORT_FILES_MISSING`; integrity or record mismatches return `EXPORT_FILES_CORRUPT`. It does not regenerate content or add a history record.
- ZIP uses the built-in store method with UTF-8 names; no dependency was added. Image entries follow publication order, followed by `caption.txt` and `manifest.json`.
- Export creation now reads persisted artifacts back and compares their hashes before inserting a successful export record.
- Added direct download buttons to the export success state and reopened export detail. The file hashes/path table remains available under technical details; the export list gets a direct history shortcut.

## API contract

`GET /api/v1/exports/{exportId}/download` returns ZIP bytes (`application/zip`) with `Content-Disposition: attachment`. Errors: 400 invalid identifier, 403/421 local request protections, 404 unknown export or missing persisted file, 409 corrupt/mismatched artifact record. No backend approval contract changed; final approval remains server-enforced.

## Verification

- TypeScript typecheck: passed.
- ESLint on changed code: passed.
- Unit tests: ZIP structure/CRC checks (2 passed); export detail and list UI tests (25 passed); file-store security tests are included in the targeted integration run.
- Targeted export integration tests: passed (11 cases), including ZIP response, repeated download without history mutation, missing artifact response, and existing approval guards/order checks.
- Contract suite: passed (790 tests).
- Production build: passed.
- `git diff --check`: passed.
- E2E/browser/a11y/visual suites were not run per PD-UI-21.

## Manual use

Run `npm run dev` from the repository root. On the project’s exports page, select **Exportar carrusel** for a carousel with valid final approval; after success use **Descargar carrusel**. To retrieve an older archive without regenerating, open **Ver historial**, open the export, and use **Descargar carrusel** there. Technical file names, hashes, and the relative storage directory are under the detail disclosure. The application creates local downloadable assets and does not publish to social networks.

Known limitation: the UI can offer a new export only for a carousel in the active draft; existing exports remain downloadable from history. The server caps the total files read for one archive at 256 MiB.

## Product Owner acceptance

On 2026-10-30, the Product Owner confirmed manual acceptance: carousel export and ZIP download worked, all expected PNG images were included, and the caption and manifest were present and openable. Acceptance reused the successful verification above; no additional E2E tests were run. UI-05B remains out of scope.
