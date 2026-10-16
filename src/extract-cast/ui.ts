const HOST_ID = "bookmarklet-extract-cast";

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  :focus { outline: none; }
  .panel {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483647;
    display: flex; flex-direction: column; width: min(480px, 100vw);
    background: rgba(255, 255, 255, .78); color: #2b2d2f; box-shadow: 0 0 12px rgba(0, 0, 0, .4);
    backdrop-filter: blur(6px);
    font: 14px/1.4 system-ui, sans-serif;
    transition: transform .2s ease, opacity .2s ease;
  }
  .panel.folded {
    transform: translateX(24px); opacity: 0; visibility: hidden; pointer-events: none;
    transition: transform .2s ease, opacity .2s ease, visibility 0s .2s;
  }
  .bar { display: flex; gap: 6px; padding: 6px; background: rgba(235, 237, 238, .7); }
  .bar .fields { display: flex; flex: 1; gap: 2px; min-width: 0; }
  .bar .title { flex: 1; min-width: 0; }
  .bar .year { width: 4em; }
  input, textarea {
    border: 1px solid #c5c6c7; border-radius: 6px; background: #fff;
    font: inherit; color: inherit;
  }
  input { min-height: 32px; padding: 0 8px; }
  textarea {
    flex: 1; margin: 0; padding: 8px; resize: none; border-width: 0; background: transparent;
    font: 13px/1.6 ui-monospace, "SF Mono", Menlo, monospace;
  }
  button {
    display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;
    padding: 0; border: 1px solid #c5c6c7; border-radius: 6px; background: #fff;
    color: inherit; font: inherit; cursor: pointer;
  }
  svg {
    width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;
    stroke-linecap: round; stroke-linejoin: round;
  }
  button.primary { border-color: #2b8fc4; background: #2b8fc4; color: #fff; }
  .tab {
    position: fixed; top: 6px; right: 6px; z-index: 2147483647;
    border-color: transparent; background: rgba(43, 45, 47, .35); color: #fff;
    opacity: 0; visibility: hidden; transition: opacity .2s ease, visibility 0s .2s, background .15s;
  }
  .tab:hover { background: rgba(43, 45, 47, .6); }
  .tab.visible { opacity: 1; visibility: visible; transition: opacity .2s ease .1s, background .15s; }
  [hidden] { display: none !important; }
`;

const ICON_BUILD =
  '<svg viewBox="0 0 24 24"><path d="M9 4C7 4 6 5 6 7v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 2 1 3 3 3M15 4c2 0 3 1 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 2-1 3-3 3"/></svg>';
const ICON_EDIT =
  '<svg viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19z"/></svg>';

const ICON_HIDE = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
const ICON_SHOW = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';

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

/** Brings back a panel hidden by an earlier run; returns false when there is none. */
export function revealPanel(): boolean {
  const host = document.getElementById(HOST_ID);
  host?.dispatchEvent(new Event("reveal"));
  return host !== null;
}

/**
 * Shows a new panel. `onBuild` turns the edited text into the JSON string shown
 * (and copied) when the user presses Build. Call `revealPanel` first: an existing panel
 * is not replaced here.
 */
export function showPanel(options: {
  title: string;
  text: string;
  onBuild: (fields: { title: string; year: string; text: string }) => string;
}): void {
  const host = el("div", { id: HOST_ID });
  const root = host.attachShadow({ mode: "open" });

  const title = el("input", {
    className: "title",
    value: options.title,
    placeholder: "Title",
  });
  const year = el("input", {
    className: "year",
    placeholder: "Year",
    maxLength: 4,
  });
  const edit = el("textarea", { value: options.text, spellcheck: false });
  const result = el("textarea", { readOnly: true, hidden: true });
  const build = el("button", {
    className: "primary",
    title: "Build",
    innerHTML: ICON_BUILD,
  });
  const back = el("button", {
    title: "Edit",
    innerHTML: ICON_EDIT,
    hidden: true,
  });

  const show = (building: boolean) => {
    edit.hidden = building;
    build.hidden = building;
    result.hidden = !building;
    back.hidden = !building;
  };

  build.onclick = () => {
    result.value = options.onBuild({
      title: title.value,
      year: year.value,
      text: edit.value,
    });
    show(true);
    result.select();
    // Clipboard access can be denied by the page; the selected text still works with Ctrl+C.
    navigator.clipboard?.writeText(result.value).catch(() => {});
  };
  back.onclick = () => show(false);
  result.onclick = () => result.select();

  const panel = el(
    "div",
    { className: "panel" },
    el(
      "div",
      { className: "bar" },
      build,
      back,
      el("div", { className: "fields" }, title, year),
      el("button", {
        title: "Hide",
        innerHTML: ICON_HIDE,
        onclick: () => fold(true),
      }),
    ),
    edit,
    result,
  );
  const tab = el("button", {
    className: "tab",
    title: "Show",
    innerHTML: ICON_SHOW,
    onclick: () => fold(false),
  });

  // Hiding only changes visibility, so the page can be edited while the edits are kept.
  const fold = (folded: boolean) => {
    panel.classList.toggle("folded", folded);
    tab.classList.toggle("visible", folded);
  };
  host.addEventListener("reveal", () => fold(false));
  panel.onkeydown = (event) => {
    if (event.key === "Escape") fold(true);
  };

  root.append(el("style", { textContent: STYLE }), panel, tab);
  document.body.append(host);
}
