import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { build } from "esbuild";

const files = (await readdir("src")).filter((f) => f.endsWith(".ts"));

await rm("dist", { recursive: true, force: true });
await mkdir("dist");

for (const file of files) {
  const name = basename(file, ".ts");
  const { outputFiles } = await build({
    entryPoints: [`src/${file}`],
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
