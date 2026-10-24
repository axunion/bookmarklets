// Shows a panel with library and Kindle+ search links for the book on the current page.
// The title starts as the page's selection (empty when nothing is selected) and can be edited;
// selecting text on the page afterwards replaces it.
import { el } from "../dom.ts";
import { cleanTitle, searchLinks } from "./title.ts";

const HOST_ID = "bookmarklet-book-search";

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    color-scheme: light dark;
    --fg: light-dark(#1d1d1f, #f5f5f7); --fg-sub: light-dark(rgba(60, 60, 67, .6), rgba(235, 235, 245, .6));
    --glass: light-dark(rgba(246, 246, 246, .72), rgba(44, 44, 46, .72)); --line: light-dark(rgba(0, 0, 0, .1), rgba(255, 255, 255, .14));
    --fill: light-dark(rgba(120, 120, 128, .16), rgba(120, 120, 128, .36)); --fill-hover: light-dark(rgba(120, 120, 128, .12), rgba(120, 120, 128, .24)); --fill-strong: light-dark(rgba(120, 120, 128, .26), rgba(120, 120, 128, .5));
    --ring: light-dark(rgba(0, 0, 0, .25), rgba(255, 255, 255, .35)); --card: light-dark(rgba(255, 255, 255, .7), rgba(255, 255, 255, .14));
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
    display: block; width: calc(100% - 24px); height: 64px; margin: 12px 12px 0; padding: 10px 12px;
    border: 0; border-radius: 12px; resize: none; overflow-y: auto; background: var(--fill-hover); color: inherit;
    box-shadow: inset 0 0 0 .5px var(--line); font: inherit; line-height: 1.4;
  }
  textarea:focus { outline: 0; box-shadow: inset 0 0 0 .5px var(--line), 0 0 0 3px var(--ring); }
  .links { display: flex; gap: 8px; margin: 12px; }
  a {
    flex: 1; min-width: 0; padding: 10px 8px; border-radius: 10px; background: var(--card); color: var(--fg);
    box-shadow: 0 0 0 .5px var(--line), 0 1px 2px rgba(0, 0, 0, .1);
    font-size: 13px; font-weight: 500; text-align: center; text-decoration: none; white-space: nowrap;
    transition: background .15s, opacity .15s;
  }
  a:hover { background: var(--fill); }
  a:active { opacity: .6; }
  a:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--ring); }
  a.disabled { background: var(--fill-hover); color: var(--fg-sub); box-shadow: none; pointer-events: none; }
`;

function selectedText(): string {
  return window.getSelection()?.toString().trim() ?? "";
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

  const input = el("textarea", {
    value: cleanTitle(selectedText()),
    placeholder: "Book title",
    spellcheck: false,
    oninput: render,
    onfocus: () => input.select(),
  });
  const links = searchLinks(input.value).map(({ label }) =>
    el("a", { target: "_blank", rel: "noopener", textContent: label }),
  );

  function render() {
    const title = input.value.trim();
    searchLinks(title).forEach(({ url }, i) => {
      // Without an href the link can't be focused or activated by keyboard either.
      if (title) links[i].href = url;
      else links[i].removeAttribute("href");
      links[i].classList.toggle("disabled", !title);
    });
  }

  // Selecting text on the page afterwards retargets the search; selecting inside the panel does not.
  // A rerun removes the host from outside, so the listener unhooks itself then.
  function onSelect() {
    if (!host.isConnected) {
      document.removeEventListener("selectionchange", onSelect);
      return;
    }
    const selected = selectedText();
    if (selected && document.activeElement !== host) {
      input.value = cleanTitle(selected);
      render();
    }
  }
  document.addEventListener("selectionchange", onSelect);

  const panel = el(
    "div",
    { className: "panel" },
    el(
      "div",
      { className: "top" },
      el("b", {}, "Book Search"),
      el("button", {
        title: "Close",
        textContent: "✕",
        onclick: () => host.remove(),
      }),
    ),
    input,
    el("div", { className: "links" }, ...links),
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
