# Bundled slide fonts (provisional, OD-07, U-02)

The slide renderer (`apps/server/src/modules/rendering`) uses only these files: Satori lays out and outlines the
text with them, `opentype.js` measures with them, and resvg gets them as its only `fontFiles` (system fonts are never
loaded, T10-F09). They fill the provisional font roles of `config/brand.json` until the Product Owner supplies the
brand fonts (OD-07, R-418, U-12). Each file's SHA-256 is pinned in `apps/server/src/modules/rendering/fonts.ts`, so
the renderer refuses a changed file.

| File | Role in `config/brand.json` | Family, weight | Font version | Licence | SHA-256 |
|------|-----------------------------|----------------|--------------|---------|---------|
| `Montserrat-ExtraBold.ttf` | heading | Montserrat 800 | Version 9.000 | SIL OFL 1.1 (`OFL-Montserrat.txt`) | `5cf0a23133ccce35f9e115b8dbbf90434201827bc2465d12f9d91bbf02cf9466` |
| `Inter-Regular.ttf` | body | Inter 400 | Version 4.001;git-66647c0bb | SIL OFL 1.1 (`OFL-Inter.txt`) | `a414b48aa577ef2c62ebb135341ddeef33ee26a4f5dc9f787f93c1aab08ebb50` |
| `Inter-Bold.ttf` | numeric | Inter 700 | Version 4.001;git-66647c0bb | SIL OFL 1.1 (`OFL-Inter.txt`) | `fbe825cbfc749317f57a1433d3905aa9d3f388732fd29b8e8a36f34845e3bc3e` |

Source: the npm registry only (no other host), as unmodified copies of the static TrueType files of the Google Fonts
families in these packages:

- `@expo-google-fonts/montserrat` 0.4.2 (`800ExtraBold/Montserrat_800ExtraBold.ttf`, `LICENSE_FONT`), tarball
  integrity `sha512-Xyq7rKJhhZOE1Xk4wKSSVoUeOkFmQEMhtZ3pdFrgYckGZMs115Apmld1AI8Ju+yrl5GzDdfRCCqRr33dvEDYUA==`;
- `@expo-google-fonts/inter` 0.4.2 (`400Regular/Inter_400Regular.ttf`, `700Bold/Inter_700Bold.ttf`, `LICENSE_FONT`),
  tarball integrity `sha512-syfiImMaDmq7cFi0of+waE2M4uSCyd16zgyWxdPOY7fN2VBmSLKEzkfbZgeOjJq61kSqPBNNtXjggiQiSD6gMQ==`.

The packages are not dependencies of the project; only the font files and their licence texts are committed. The
licence texts are the packages' `LICENSE_FONT` files, unchanged. The fonts' embedded copyright notices are "Copyright
2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat)" and "Copyright 2016 The Inter Project
Authors (https://github.com/rsms/inter)"; `fsType` is 0 (installable embedding) in all three files.

The files are plain TrueType (`0x00010000` signature, no WOFF), so neither Satori's WOFF conversion nor any `fflate`
decompression runs on them (OD-33, SOT-4).
