# bookmarklets

A collection of bookmarklets. Each one is a single TypeScript file, built into a `javascript:` URL that can be saved as a browser bookmark.

## Layout

```
src/<name>.ts     # one bookmarklet per file, kebab-case name
scripts/build.js  # bundles and minifies every src/*.ts with esbuild
dist/<name>.txt   # generated javascript: URL (committed)
```

`dist/` is committed so a bookmarklet can be copied straight from GitHub without building.

## Development

```sh
pnpm install
pnpm build       # src/*.ts -> dist/*.txt
pnpm check       # Biome lint + format check, then tsc --noEmit (esbuild does not check types)
pnpm fix         # apply Biome fixes
```

To add a bookmarklet, create `src/<name>.ts`, run `pnpm build`, and add a row to the list below. Each file is bundled as an IIFE, so top-level code runs when the bookmark is clicked and nothing leaks into the page scope.

## Usage

1. Open `dist/<name>.txt` and copy its contents.
2. Create a new bookmark in the browser and paste the contents into its URL field.
3. Click the bookmark on the target page.

## Bookmarklets

| Name | Description |
| ---- | ----------- |
| _none yet_ | |
