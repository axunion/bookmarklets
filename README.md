# bookmarklets

A collection of bookmarklets. Each one is a TypeScript directory, built into a `javascript:` URL that can be saved as a browser bookmark.

## Layout

```
src/<name>/index.ts  # one bookmarklet per directory, kebab-case name; extra modules live beside index.ts
scripts/build.js     # bundles and minifies every src/<name>/index.ts with esbuild
dist/index.html      # generated page listing every bookmarklet as a draggable link (not committed)
```

Pushing to `main` builds and deploys `dist/` to GitHub Pages (repository Settings → Pages → Source: GitHub Actions).

## Development

```sh
pnpm install
pnpm build       # src/*/index.ts -> dist/index.html
pnpm check       # Biome lint + format check, then tsc --noEmit for sources and tests (esbuild does not check types)
pnpm test        # unit tests (node:test) for DOM-free modules, e.g. src/extract-cast/parse.ts
pnpm fix         # apply Biome fixes
```

To add a bookmarklet, create `src/<name>/index.ts`, run `pnpm build`, and add a row to the list below. Each file is bundled as an IIFE, so top-level code runs when the bookmark is clicked and nothing leaks into the page scope.

## Usage

Open the published page and drag a link to the browser's bookmarks bar, then click the bookmark on the target page.

## Bookmarklets

| Name | Description |
| ---- | ----------- |
| extract-cast | Extracts voice actors and characters from an anime page into an editable table and copies them as JSON |
| random-string | Shows a panel of random passwords, BIP39 passphrases or URL-safe tokens with an entropy estimate; click a row to copy it |
| unlock-page | Lifts page restrictions on right-click, copy, cut, paste, text selection and drag |
