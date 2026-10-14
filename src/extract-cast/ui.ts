const HOST_ID = "bookmarklet-extract-cast";

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483647;
    display: flex; flex-direction: column; width: min(480px, 100vw);
    background: #fff; color: #2b2d2f; box-shadow: 0 0 12px rgba(0, 0, 0, .4);
    font: 14px/1.4 system-ui, sans-serif; transition: transform .25s;
  }
  .panel.folded { transform: translateX(105%); }
  .bar { display: flex; gap: 6px; padding: 6px; background: #ebedee; }
  .bar .title { flex: 1; min-width: 0; }
  .bar .year { width: 4em; }
  input, textarea {
    border: 1px solid #c5c6c7; border-radius: 6px; background: #fff;
    font: inherit; color: inherit;
  }
  input { min-height: 32px; padding: 0 8px; }
  textarea {
    flex: 1; margin: 0; padding: 8px; resize: none; border-width: 0;
    font: 13px/1.6 ui-monospace, "SF Mono", Menlo, monospace;
  }
  button {
    min-width: 32px; min-height: 32px; padding: 0 12px; border: 1px solid #c5c6c7;
    border-radius: 6px; background: #fff; color: inherit; font: inherit; cursor: pointer;
  }
  button.primary { border-color: #2b8fc4; background: #2b8fc4; color: #fff; }
  .tab {
    position: fixed; top: 0; right: 0; z-index: 2147483647; width: 28px; height: 72px;
    border-radius: 0 0 0 8px; background: rgba(43, 45, 47, .55); color: #fff;
    display: none; align-items: center; justify-content: center; cursor: pointer; font: 16px system-ui;
  }
  .tab.visible { display: flex; }
  [hidden] { display: none !important; }
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

/**
 * Shows the panel, replacing any panel from an earlier run. `onBuild` turns the
 * edited text into the JSON string shown (and copied) when the user presses Build.
 */
export function showPanel(options: {
  title: string;
  text: string;
  onBuild: (fields: { title: string; year: string; text: string }) => string;
}): void {
  document.getElementById(HOST_ID)?.remove();

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
  const build = el("button", { className: "primary", textContent: "Build" });
  const back = el("button", { textContent: "Edit", hidden: true });

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
        textContent: "×",
        title: "Hide",
        onclick: () => fold(true),
      }),
    ),
    edit,
    result,
  );
  const tab = el("div", { className: "tab", textContent: "‹", title: "Show" });

  // Hiding keeps the edits; hovering or tapping the edge tab brings the panel back.
  const fold = (folded: boolean) => {
    panel.classList.toggle("folded", folded);
    tab.classList.toggle("visible", folded);
  };
  tab.onmouseenter = () => fold(false);
  tab.onclick = () => fold(false);

  root.append(el("style", { textContent: STYLE }), panel, tab);
  document.body.append(host);
}
