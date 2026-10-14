# Bookmarklets

Each bookmarklet is built into a `javascript:` link on a GitHub Pages index page. See README.md for layout and commands.

## Adding a bookmarklet

- Create `src/<kebab-case-name>/index.ts`; put extra modules beside it. Only `index.ts` is an entry point.
- Add a row to the README bookmarklet list.
- Run `pnpm fix`, `pnpm check` and `pnpm build` before finishing.
- Use no external libraries or network resources (CDNs, remote scripts).

## Rules

- `dist/` is generated and not committed; the Pages workflow builds and deploys it.
- Pin GitHub Actions to commit SHAs (with a version comment) and tools to exact versions.
- Do not add `packageManager` to package.json; pnpm then rewrites the lockfile.
- The index page stays minimal: title and links only, light theme, large tap targets.
