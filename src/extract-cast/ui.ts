import { el } from "../dom.ts";

const HOST_ID = "bookmarklet-extract-cast";

// The toolbar is frosted glass; the text areas sit on a more opaque inner surface
// and use full-contrast text so the page behind never hurts readability.
const STYLE = `
  :host {
    all: initial;
    color-scheme: light dark;
    --fg: light-dark(#1d1d1f, #f5f5f7); --fg-sub: light-dark(rgba(60, 60, 67, .6), rgba(235, 235, 245, .6)); --fg-inv: light-dark(#fff, #1d1d1f);
    --glass: light-dark(rgba(246, 246, 246, .8), rgba(44, 44, 46, .8)); --line: light-dark(rgba(0, 0, 0, .1), rgba(255, 255, 255, .14)); --surface: light-dark(rgba(255, 255, 255, .65), rgba(60, 60, 64, .7));
    --fill: light-dark(rgba(120, 120, 128, .16), rgba(120, 120, 128, .36)); --field: light-dark(rgba(120, 120, 128, .12), rgba(120, 120, 128, .24)); --fill-strong: light-dark(rgba(120, 120, 128, .26), rgba(120, 120, 128, .5));
    --ring: light-dark(rgba(0, 0, 0, .25), rgba(255, 255, 255, .35)); --text: light-dark(#000, #fff);
  }
  :host([data-theme="light"]) { color-scheme: light; }
  :host([data-theme="dark"]) { color-scheme: dark; }
  * { box-sizing: border-box; }
  .panel {
    position: fixed; top: 12px; right: 12px; bottom: 12px; z-index: 2147483647;
    display: flex; flex-direction: column; overflow: hidden; width: min(560px, calc(100vw - 24px));
    color: var(--fg); border-radius: 18px;
    -webkit-backdrop-filter: blur(16px) saturate(180%); backdrop-filter: blur(16px) saturate(180%);
    box-shadow: 0 0 0 .5px var(--line), 0 12px 40px rgba(0, 0, 0, .28), 0 2px 6px rgba(0, 0, 0, .12);
    font: 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    transition: transform .2s ease, opacity .2s ease;
  }
  .panel.folded {
    transform: translateX(24px); opacity: 0; visibility: hidden; pointer-events: none;
    transition: transform .2s ease, opacity .2s ease, visibility 0s .2s;
  }

  button {
    height: 32px; margin: 0; padding: 0 16px; border: 0; border-radius: 10px;
    background: var(--fill); color: var(--fg); font: inherit; font-weight: 500;
    cursor: pointer; transition: background .15s, opacity .15s;
  }
  button:hover { background: var(--fill-strong); }
  button:active { opacity: .6; }
  button:focus-visible, input:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--ring); }
  button.action { flex: none; width: 64px; padding: 0; }
  button.primary { background: var(--fg); color: var(--fg-inv); }
  button.primary:hover { background: var(--fg); opacity: .85; }
  button.primary:active { opacity: .7; }
  button.round { display: flex; align-items: center; justify-content: center; width: 32px; padding: 0; border-radius: 50%; color: var(--fg-sub); }
  svg {
    width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.4;
    stroke-linecap: round; stroke-linejoin: round;
  }

  .bar { display: flex; flex: none; align-items: center; gap: 8px; padding: 10px; background: var(--glass); }
  .bar input {
    min-width: 0; height: 32px; margin: 0; padding: 0 10px; border: 0; border-radius: 10px;
    background: var(--field); color: inherit; font: inherit; font-size: 14px;
    box-shadow: inset 0 0 0 .5px var(--line);
  }
  .bar input::placeholder { color: var(--fg-sub); }
  .bar .title { flex: 1; }
  .bar .year { width: 4.5em; text-align: center; }

  .sheet {
    display: flex; flex: 1; min-height: 0; overflow: hidden;
    border-top: .5px solid var(--line); background: var(--surface);
  }
  textarea {
    flex: 1; margin: 0; padding: 12px; resize: none; border: 0; outline: 0; background: transparent;
    color: var(--text); font: 500 13px/1.6 ui-monospace, "SF Mono", Menlo, monospace;
    caret-color: var(--text);
  }
  ::selection { background: color-mix(in srgb, var(--fg) 25%, transparent); }

  button.tab {
    position: fixed; top: 12px; right: 12px; z-index: 2147483647; width: 36px; height: 36px;
    background: var(--glass); color: var(--fg);
    -webkit-backdrop-filter: blur(16px) saturate(180%); backdrop-filter: blur(16px) saturate(180%);
    box-shadow: 0 0 0 .5px var(--line), 0 4px 16px rgba(0, 0, 0, .22);
    opacity: 0; visibility: hidden; transition: opacity .2s ease, visibility 0s .2s;
  }
  button.tab:hover { background: var(--glass); box-shadow: 0 0 0 .5px var(--line), 0 6px 20px rgba(0, 0, 0, .3); }
  button.tab.visible { opacity: 1; visibility: visible; transition: opacity .2s ease .1s; }
  [hidden] { display: none !important; }
`;

const ICON_HIDE = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
const ICON_SHOW = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';

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
  const theme = document.documentElement.dataset.theme;
  if (theme) host.dataset.theme = theme;

  const title = el("input", {
    className: "title",
    value: options.title,
    placeholder: "Title",
  });
  const year = el("input", {
    className: "year",
    placeholder: "Year",
    maxLength: 4,
    inputMode: "numeric",
  });
  const edit = el("textarea", { value: options.text, spellcheck: false });
  const result = el("textarea", { readOnly: true, hidden: true });
  const build = el("button", {
    className: "action primary",
    textContent: "Build",
  });
  const back = el("button", {
    className: "action",
    textContent: "Edit",
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
      title,
      year,
      el("button", {
        className: "round",
        title: "Hide",
        innerHTML: ICON_HIDE,
        onclick: () => fold(true),
      }),
    ),
    el("div", { className: "sheet" }, edit, result),
  );
  const tab = el("button", {
    className: "round tab",
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
  // Keep typing from reaching the page's own shortcuts.
  for (const type of ["keyup", "keypress"]) {
    panel.addEventListener(type, (event) => event.stopPropagation());
  }
  panel.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") fold(true);
  };

  root.append(el("style", { textContent: STYLE }), panel, tab);
  document.body.append(host);
}
