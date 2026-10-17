import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const names = (await readdir("src", { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

await rm("dist", { recursive: true, force: true });
await mkdir("dist");

const links = [];
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
  links.push(`      <li><a href="${url}">${name}</a></li>`);
}

const template = await readFile("scripts/index.template.html", "utf8");
await writeFile(
  "dist/index.html",
  template.replace("{{links}}", links.join("\n")),
);
console.log("dist/index.html");
