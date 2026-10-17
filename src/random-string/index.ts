// Shows a small panel of random strings; click a row to copy it.
import {
  buildAlphabet,
  CHARSETS,
  type CharsetKey,
  clampLength,
  generate,
  MAX_LENGTH,
  MIN_LENGTH,
} from "./generate.ts";

const HOST_ID = "bookmarklet-random-string";
const ROWS = 8;
const DEFAULT_LENGTH = 40;

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    position: fixed; top: 12px; right: 12px; z-index: 2147483647;
    width: min(480px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
    display: flex; flex-direction: column; overflow: hidden;
    background: #f5f3f0; color: #4d4c4b; border-radius: 6px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, .3);
    font: 14px/1.2 Helvetica, sans-serif;
  }
  .bar {
    display: flex; flex: none; gap: 4px; padding: 8px;
    border-bottom: 1px solid #cfcdca;
  }
  label.chip { flex: 1; min-width: 0; cursor: pointer; }
  label.chip input { display: none; }
  label.chip span {
    display: block; height: 40px; padding: 0 4px; border: 1px solid #cfcdca; border-radius: 4px;
    background: #cfcdca; color: #808080; line-height: 38px; text-align: center;
    white-space: nowrap; user-select: none;
  }
  label.chip input:checked + span { background: #fff; color: #4d4c4b; }
  .length {
    width: 52px; height: 40px; padding: 0; margin: 0; appearance: textfield; border: 1px solid #cfcdca; border-radius: 4px; background: #fff;
    color: inherit; font: inherit; text-align: center;
  }
  .length::-webkit-inner-spin-button { appearance: none; margin: 0; }
  .length:focus { outline: 0; box-shadow: #317ff5 0 0 4px; }
  button {
    height: 40px; margin: 0; padding: 0 16px; border: 1px solid #4d4c4b; border-radius: 4px;
    background: #4d4c4b; color: #f5f3f0; font: inherit; line-height: 38px;
    cursor: pointer; transition: .15s;
  }
  button:hover { background: transparent; color: #4d4c4b; }
  button.close { width: 40px; padding: 0; border-color: transparent; background: transparent; color: #808080; }
  button.close:hover { color: #4d4c4b; }
  .rows { margin: 0; padding: 0; list-style: none; overflow-y: auto; }
  li:nth-child(odd) { background: #fff; }
  .row {
    display: block; width: 100%; padding: 8px 16px; border: 0; border-radius: 0;
    background: transparent; color: inherit; text-align: center; line-height: 1.2;
    word-break: break-all; font: 90%/1.2 "Courier New", monospace; transition: none;
  }
  .row:hover { background: #e4edfc; color: inherit; }
  .row.copied { background: #317ff5; color: #f5f3f0; }
  .empty { padding: 12px; text-align: center; color: #808080; }
`;

type Child = Node | string;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// Running again while the panel is open closes it.
const existing = document.getElementById(HOST_ID);
if (existing) {
  existing.remove();
} else {
  const host = el("div", { id: HOST_ID });
  const root = host.attachShadow({ mode: "open" });

  const keys = Object.keys(CHARSETS) as CharsetKey[];
  const checks = keys.map((key) =>
    el("input", {
      type: "checkbox",
      checked: key !== "+-_@?",
      onchange: render,
    }),
  );
  const length = el("input", {
    className: "length",
    type: "number",
    min: String(MIN_LENGTH),
    max: String(MAX_LENGTH),
    value: String(DEFAULT_LENGTH),
    title: `${MIN_LENGTH}-${MAX_LENGTH}`,
    oninput: render,
    onchange: commit,
  });
  const rows = el("ul", { className: "rows" });

  function render() {
    const alphabet = buildAlphabet(keys.filter((_, i) => checks[i]?.checked));
    const size = clampLength(length.valueAsNumber);
    if (alphabet === "") {
      rows.replaceChildren(
        el("li", { className: "empty" }, "Select at least one character set"),
      );
      return;
    }
    rows.replaceChildren(
      ...Array.from({ length: ROWS }, () => {
        const text = generate(alphabet, size);
        const row = el("button", { className: "row", textContent: text });
        row.onclick = () => {
          // Clipboard access can be denied by the page; failing silently leaves the row uncopied.
          navigator.clipboard
            ?.writeText(text)
            .then(() => {
              rows.querySelector(".copied")?.classList.remove("copied");
              row.classList.add("copied");
            })
            .catch(() => {});
        };
        return el("li", {}, row);
      }),
    );
  }

  // Shows the length actually used; not done on input so the field can be emptied while typing.
  function commit() {
    length.value = String(clampLength(length.valueAsNumber));
    render();
  }

  const panel = el(
    "div",
    { className: "panel" },
    el(
      "div",
      { className: "bar" },
      ...keys.map((key, i) =>
        el(
          "label",
          { className: "chip" },
          checks[i] as Node,
          el("span", {}, key),
        ),
      ),
      length,
      el("button", { textContent: "Generate", onclick: render }),
      el("button", {
        className: "close",
        title: "Close",
        textContent: "✕",
        onclick: () => host.remove(),
      }),
    ),
    rows,
  );
  // Keep typing and Enter/Escape from reaching the page's own shortcuts.
  for (const type of ["keyup", "keypress"]) {
    panel.addEventListener(type, (event) => event.stopPropagation());
  }
  panel.onkeydown = (event) => {
    event.stopPropagation();
    // Regenerating on Enter from a focused row would detach it before its click fires.
    if (event.key === "Enter" && event.target === length) commit();
    if (event.key === "Escape") host.remove();
  };

  root.append(el("style", { textContent: STYLE }), panel);
  document.body.append(host);
  render();
}
