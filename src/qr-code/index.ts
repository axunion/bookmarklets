// Shows a panel that turns text into a QR code. The text starts as the page's selection,
// or the page URL when nothing is selected, and can be edited.
import { encodeBytes, MAX_BYTES, type Matrix } from "./qr.ts";

const HOST_ID = "bookmarklet-qr-code";
const SVG_NS = "http://www.w3.org/2000/svg";
// Blank border around the symbol, in modules, as the standard requires for reliable scanning.
const QUIET_ZONE = 4;
// Pixels per module in the saved PNG; keeps every version large enough to scan.
const PNG_SCALE = 10;

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    color-scheme: light dark;
    --fg: light-dark(#1d1d1f, #f5f5f7); --fg-sub: light-dark(rgba(60, 60, 67, .6), rgba(235, 235, 245, .6));
    --glass: light-dark(rgba(246, 246, 246, .72), rgba(44, 44, 46, .72)); --line: light-dark(rgba(0, 0, 0, .1), rgba(255, 255, 255, .14));
    --fill: light-dark(rgba(120, 120, 128, .16), rgba(120, 120, 128, .36)); --fill-hover: light-dark(rgba(120, 120, 128, .12), rgba(120, 120, 128, .24)); --fill-strong: light-dark(rgba(120, 120, 128, .26), rgba(120, 120, 128, .5));
    --ring: light-dark(rgba(0, 0, 0, .25), rgba(255, 255, 255, .35)); --weak: light-dark(#d70015, #ff453a);
    position: fixed; top: 12px; right: 12px; z-index: 2147483647;
    width: min(360px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
    display: flex; flex-direction: column; overflow-y: auto;
    background: var(--glass); color: var(--fg); border-radius: 18px;
    -webkit-backdrop-filter: blur(40px) saturate(180%); backdrop-filter: blur(40px) saturate(180%);
    box-shadow: 0 0 0 .5px var(--line), 0 12px 40px rgba(0, 0, 0, .28), 0 2px 6px rgba(0, 0, 0, .12);
    font: 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  :host([data-theme="light"]) .panel { color-scheme: light; }
  :host([data-theme="dark"]) .panel { color-scheme: dark; }
  button {
    width: 32px; height: 32px; margin: 0; padding: 0; border: 0; border-radius: 50%;
    background: var(--fill); color: var(--fg-sub); font: inherit; font-weight: 500;
    cursor: pointer; transition: background .15s, opacity .15s;
  }
  button:hover { background: var(--fill-strong); }
  button:active { opacity: .6; }
  button:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--ring); }

  .top { display: flex; flex: none; align-items: center; justify-content: space-between; padding: 12px 12px 0 16px; }
  .top b { font-size: 15px; font-weight: 600; }
  textarea {
    display: block; width: calc(100% - 24px); height: 84px; margin: 12px 12px 0; padding: 10px 12px;
    border: 0; border-radius: 12px; resize: none; overflow-y: auto; background: var(--fill-hover); color: inherit;
    box-shadow: inset 0 0 0 .5px var(--line); font: inherit; line-height: 1.4;
  }
  textarea:focus { outline: 0; box-shadow: inset 0 0 0 .5px var(--line), 0 0 0 3px var(--ring); }
  .frame {
    flex: none; width: 240px; height: 240px; margin: 12px auto 0; border-radius: 12px; background: #fff;
    box-shadow: 0 0 0 .5px var(--line); overflow: hidden;
  }
  .frame[hidden] { display: none; }
  .frame svg { display: block; width: 100%; height: 100%; }
  .footer { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 12px 12px 16px; }
  .status { margin: 0; color: var(--fg-sub); font-variant-numeric: tabular-nums; }
  .status.error { color: var(--weak); }
  button.save { display: flex; align-items: center; justify-content: center; border-radius: 10px; color: var(--fg); }
  button.save:disabled { opacity: .4; cursor: default; }
  button.save svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
`;

// Arrow pointing into a tray.
function downloadIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M12 4v11m-4-4 4 4 4-4M5 20h14");
  svg.append(path);
  return svg;
}

function savePng(modules: Matrix) {
  const edge = modules.length + QUIET_ZONE * 2;
  const canvas = el("canvas", {
    width: edge * PNG_SCALE,
    height: edge * PNG_SCALE,
  });
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect(
          (x + QUIET_ZONE) * PNG_SCALE,
          (y + QUIET_ZONE) * PNG_SCALE,
          PNG_SCALE,
          PNG_SCALE,
        );
      }
    });
  });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    el("a", { href: url, download: "qr-code.png" }).click();
    // Revoking right away can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

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
  const theme = document.documentElement.dataset.theme;
  if (theme) host.dataset.theme = theme;

  let selectOnMouseUp = false;
  const selected = window.getSelection()?.toString().trim();
  const input = el("textarea", {
    value: selected || location.href,
    placeholder: "Text or URL",
    spellcheck: false,
    oninput: render,
    onfocus: () => input.select(),
    // A click that gives focus would otherwise drop the select-all on mouseup.
    onmousedown: () => {
      selectOnMouseUp = root.activeElement !== input;
    },
    onmouseup: (event) => {
      if (selectOnMouseUp) event.preventDefault();
      selectOnMouseUp = false;
    },
  });
  const path = document.createElementNS(SVG_NS, "path");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.append(path);
  const frame = el("div", { className: "frame" });
  frame.append(svg);
  const status = el("span", { className: "status" });
  // Disabled unless the text fits, so the click handler can always encode it.
  const save = el("button", {
    className: "save",
    title: "Save as PNG",
    onclick: () => savePng(encodeBytes(new TextEncoder().encode(input.value))),
  });
  save.setAttribute("aria-label", "Save as PNG");
  save.append(downloadIcon());

  function render() {
    const data = new TextEncoder().encode(input.value);
    const fits = data.length > 0 && data.length <= MAX_BYTES;
    frame.hidden = !fits;
    save.disabled = !fits;
    status.classList.toggle("error", data.length > MAX_BYTES);
    if (!fits) {
      status.textContent =
        data.length === 0
          ? "Enter some text"
          : `Too long: ${data.length} of ${MAX_BYTES} bytes`;
      return;
    }
    const modules = encodeBytes(data);
    const size = modules.length;
    const edge = size + QUIET_ZONE * 2;
    svg.setAttribute(
      "viewBox",
      `${-QUIET_ZONE} ${-QUIET_ZONE} ${edge} ${edge}`,
    );
    // One rectangle per horizontal run of dark modules keeps the path short.
    let d = "";
    modules.forEach((row, y) => {
      for (let x = 0; x < size; x++) {
        if (!row[x]) continue;
        const start = x;
        while (row[x + 1]) x++;
        const width = x - start + 1;
        d += `M${start} ${y}h${width}v1h-${width}z`;
      }
    });
    path.setAttribute("d", d);
    status.textContent = `${data.length} bytes · Version ${(size - 17) / 4}`;
  }

  const panel = el(
    "div",
    { className: "panel" },
    el(
      "div",
      { className: "top" },
      el("b", {}, "QR Code"),
      el("button", {
        title: "Close",
        textContent: "✕",
        onclick: () => host.remove(),
      }),
    ),
    input,
    frame,
    el("div", { className: "footer" }, status, save),
  );
  // Keep typing and Escape from reaching the page's own shortcuts.
  for (const type of ["keyup", "keypress"]) {
    panel.addEventListener(type, (event) => event.stopPropagation());
  }
  panel.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") host.remove();
  };

  root.append(el("style", { textContent: STYLE }), panel);
  document.body.append(host);
  render();
}
