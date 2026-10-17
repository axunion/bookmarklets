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
    --fg: #1d1d1f; --fg-sub: rgba(60, 60, 67, .6); --fg-inv: #fff;
    --glass: rgba(246, 246, 246, .72); --line: rgba(0, 0, 0, .1);
    --fill: rgba(120, 120, 128, .16); --fill-hover: rgba(120, 120, 128, .12); --fill-strong: rgba(120, 120, 128, .26);
    --ring: rgba(0, 0, 0, .25);
    position: fixed; top: 12px; right: 12px; z-index: 2147483647;
    width: min(480px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--glass); color: var(--fg); border-radius: 18px;
    -webkit-backdrop-filter: blur(40px) saturate(180%); backdrop-filter: blur(40px) saturate(180%);
    box-shadow: 0 0 0 .5px var(--line), 0 12px 40px rgba(0, 0, 0, .28), 0 2px 6px rgba(0, 0, 0, .12);
    font: 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  @media (prefers-color-scheme: dark) {
    .panel {
      --fg: #f5f5f7; --fg-sub: rgba(235, 235, 245, .6); --fg-inv: #1d1d1f;
      --glass: rgba(44, 44, 46, .72); --line: rgba(255, 255, 255, .14);
      --fill: rgba(120, 120, 128, .36); --fill-hover: rgba(120, 120, 128, .24); --fill-strong: rgba(120, 120, 128, .5);
      --ring: rgba(255, 255, 255, .35);
    }
  }
  .bar {
    display: flex; flex: none; gap: 6px; padding: 10px;
    border-bottom: .5px solid var(--line);
  }
  label.chip { flex: 1; min-width: 0; cursor: pointer; }
  label.chip input { display: none; }
  label.chip span {
    display: block; height: 32px; padding: 0 4px; border-radius: 10px;
    background: var(--fill); color: var(--fg-sub); line-height: 32px; text-align: center;
    white-space: nowrap; user-select: none; transition: background .15s, color .15s;
  }
  label.chip input:checked + span { background: var(--fg); color: var(--fg-inv); }
  .length {
    width: 52px; height: 32px; padding: 0; margin: 0; appearance: textfield; border: 0; border-radius: 10px;
    background: var(--fill); color: inherit; font: inherit; text-align: center;
  }
  .length::-webkit-inner-spin-button { appearance: none; margin: 0; }
  .length:focus { outline: 0; box-shadow: 0 0 0 3px var(--ring); }
  button {
    height: 32px; margin: 0; padding: 0 14px; border: 0; border-radius: 10px;
    background: var(--fg); color: var(--fg-inv); font: inherit; font-weight: 500;
    cursor: pointer; transition: opacity .15s, background .15s;
  }
  button:hover { opacity: .8; }
  button:active { opacity: .6; }
  button:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--ring); }
  button.close {
    width: 32px; padding: 0; border-radius: 50%;
    background: var(--fill); color: var(--fg-sub);
  }
  button.close:hover { opacity: 1; background: var(--fill-hover); color: var(--fg); }
  .rows { margin: 0; padding: 6px; list-style: none; overflow-y: auto; }
  .row {
    display: block; width: 100%; padding: 8px 12px; border-radius: 10px;
    background: transparent; color: inherit; text-align: center;
    word-break: break-all; font: 90%/1.3 ui-monospace, "SF Mono", Menlo, monospace;
    transition: background .1s;
  }
  .row:hover { opacity: 1; background: var(--fill); }
  .row:active { opacity: 1; background: var(--fill-strong); }
  .row.copied { animation: copied .3s ease-out; }
  @keyframes copied {
    0%, 35% { background: color-mix(in srgb, var(--fg) 35%, transparent); }
  }
  .empty { padding: 12px; text-align: center; color: var(--fg-sub); }
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
  const checks = keys.map((key) => ({
    key,
    input: el("input", {
      type: "checkbox",
      checked: key !== "+-_@?",
      onchange: render,
    }),
  }));
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
    const alphabet = buildAlphabet(
      checks.filter(({ input }) => input.checked).map(({ key }) => key),
    );
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
        row.onanimationend = () => row.classList.remove("copied");
        row.onclick = () => {
          // Clipboard access can be denied by the page; failing silently leaves the row uncopied.
          navigator.clipboard
            ?.writeText(text)
            .then(() => {
              // Reflow between remove and add so a repeated click replays the animation.
              row.classList.remove("copied");
              void row.offsetWidth;
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
      ...checks.map(({ key, input }) =>
        el("label", { className: "chip" }, input, el("span", {}, key)),
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
