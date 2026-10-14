import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const names = (await readdir("src", { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

await rm("dist", { recursive: true, force: true });
await mkdir("dist");

for (const name of names) {
  const { outputFiles } = await build({
    entryPoints: [`src/${name}/index.ts`],
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2020",
    write: false,
  });
  const url = `javascript:${encodeURIComponent(outputFiles[0].text.trim())}`;
  await writeFile(`dist/${name}.txt`, `${url}\n`);
  console.log(`dist/${name}.txt`);
}
