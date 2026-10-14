// Extracts voice actors and characters from an anime page (Japanese Wikipedia
// layout) into editable text; Build turns the edited text into JSON.
import {
  extractCast,
  findUnresolved,
  formatText,
  parseText,
  type RawEntry,
} from "./parse.ts";
import { showPanel } from "./ui.ts";

const entries: RawEntry[] = [];
for (const dt of document.getElementsByTagName("dt")) {
  const lines: string[] = [];
  for (
    let dd = dt.nextElementSibling;
    dd?.tagName === "DD";
    dd = dd.nextElementSibling
  ) {
    lines.push(dd.textContent ?? "");
  }
  entries.push({ chara: dt.textContent ?? "", lines });
}

// Reference lists quote headlines such as "スムージー(声:○○)", which are not cast entries.
const body = document.getElementById("bodyContent")?.cloneNode(true) as
  | HTMLElement
  | undefined;
body
  ?.querySelectorAll("sup, .reflist, .references, .mw-references-wrap")
  .forEach((node) => {
    node.remove();
  });

showPanel({
  title: document.getElementsByTagName("h1")[0]?.textContent ?? "",
  text: formatText(
    extractCast(entries, body?.textContent ?? ""),
    findUnresolved(entries),
  ),
  onBuild: ({ title, year, text }) =>
    JSON.stringify({
      title: title.trim(),
      year: year.trim(),
      cast: parseText(text),
    }),
});
