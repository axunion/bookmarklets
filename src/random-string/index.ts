// Shows a small panel of random passwords, passphrases or URL tokens; click a row to copy it.
import { el } from "../dom.ts";
import {
  clamp,
  generatePassword,
  generateToken,
  passwordBits,
  tokenBits,
} from "./generate.ts";
import { generatePassphrase, passphraseBits } from "./passphrase.ts";

const HOST_ID = "bookmarklet-random-string";
const ROWS = 8;
// Strength labels; the meter is full at METER_BITS.
const WEAK_BITS = 64;
const STRONG_BITS = 100;
const METER_BITS = 128;

type Mode = "password" | "passphrase" | "url";
type Flags = Record<string, boolean>;

interface ModeSpec {
  label: string;
  hint: string;
  unit: string;
  min: number;
  max: number;
  initial: number;
  options: { key: string; label: string; note: string; checked: boolean }[];
  plan(size: number, flags: Flags): { make(): string; bits: number };
}

const MODES: Record<Mode, ModeSpec> = {
  password: {
    label: "Password",
    hint: "Letters and digits only, so it works on almost any site.",
    unit: "Characters",
    min: 12,
    max: 99,
    initial: 20,
    options: [
      {
        key: "symbols",
        label: "Add symbols",
        note: "Only - and _ ; leave off for old systems",
        checked: false,
      },
      {
        key: "noAmbiguous",
        label: "Avoid look-alikes",
        note: "Skips 0 O 1 l I",
        checked: false,
      },
    ],
    plan: (size, flags) => {
      const options = {
        symbols: flags.symbols === true,
        noAmbiguous: flags.noAmbiguous === true,
      };
      return {
        make: () => generatePassword(size, options),
        bits: passwordBits(size, options),
      };
    },
  },
  passphrase: {
    label: "Passphrase",
    hint: "Random words joined by hyphens. Easy to type and remember.",
    unit: "Words",
    min: 4,
    max: 12,
    initial: 7,
    options: [
      {
        key: "capitalize",
        label: "Capitalize words",
        note: "For sites that require upper case",
        checked: false,
      },
      {
        key: "digit",
        label: "Add a digit",
        note: "For sites that require a number",
        checked: false,
      },
    ],
    plan: (size, flags) => {
      const options = {
        capitalize: flags.capitalize === true,
        digit: flags.digit === true,
      };
      return {
        make: () => generatePassphrase(size, options),
        bits: passphraseBits(size, options),
      };
    },
  },
  url: {
    label: "URL",
    hint: "Lowercase letters and digits, safe in URLs, host names and file names.",
    unit: "Characters",
    min: 16,
    max: 63,
    initial: 26,
    options: [
      {
        key: "upper",
        label: "Allow upper case",
        note: "Paths only; host names ignore case",
        checked: false,
      },
    ],
    plan: (size, flags) => {
      const upper = flags.upper === true;
      return {
        make: () => generateToken(size, upper),
        bits: tokenBits(size, upper),
      };
    },
  },
};

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel {
    color-scheme: light dark;
    --fg: light-dark(#1d1d1f, #f5f5f7); --fg-sub: light-dark(rgba(60, 60, 67, .6), rgba(235, 235, 245, .6)); --fg-inv: light-dark(#fff, #1d1d1f);
    --glass: light-dark(rgba(246, 246, 246, .72), rgba(44, 44, 46, .72)); --line: light-dark(rgba(0, 0, 0, .1), rgba(255, 255, 255, .14));
    --fill: light-dark(rgba(120, 120, 128, .16), rgba(120, 120, 128, .36)); --fill-hover: light-dark(rgba(120, 120, 128, .12), rgba(120, 120, 128, .24)); --fill-strong: light-dark(rgba(120, 120, 128, .26), rgba(120, 120, 128, .5));
    --ring: light-dark(rgba(0, 0, 0, .25), rgba(255, 255, 255, .35)); --weak: light-dark(#d70015, #ff453a);
    position: fixed; top: 12px; right: 12px; z-index: 2147483647;
    width: min(480px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--glass); color: var(--fg); border-radius: 18px;
    -webkit-backdrop-filter: blur(40px) saturate(180%); backdrop-filter: blur(40px) saturate(180%);
    box-shadow: 0 0 0 .5px var(--line), 0 12px 40px rgba(0, 0, 0, .28), 0 2px 6px rgba(0, 0, 0, .12);
    font: 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  :host([data-theme="light"]) .panel { color-scheme: light; }
  :host([data-theme="dark"]) .panel { color-scheme: dark; }
  button {
    height: 32px; margin: 0; padding: 0 14px; border: 0; border-radius: 10px;
    background: var(--fill); color: var(--fg); font: inherit; font-weight: 500;
    cursor: pointer; transition: background .15s, opacity .15s;
  }
  button:hover { background: var(--fill-strong); }
  button:active { opacity: .6; }
  button:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--ring); }
  button.round { width: 32px; padding: 0; border-radius: 50%; color: var(--fg-sub); }

  .top { display: flex; flex: none; gap: 8px; padding: 12px 12px 0; }
  .modes { display: flex; flex: 1; gap: 2px; padding: 2px; border-radius: 12px; background: var(--fill); }
  .modes label { flex: 1; min-width: 0; cursor: pointer; }
  .modes input { display: none; }
  .modes span {
    display: block; height: 32px; border-radius: 10px; color: var(--fg-sub);
    line-height: 32px; text-align: center; font-weight: 500; user-select: none;
    transition: background .15s, color .15s;
  }
  .modes input:checked + span { background: var(--fg); color: var(--fg-inv); }
  .hint { flex: none; margin: 0; padding: 10px 16px 8px; color: var(--fg-sub); }

  .card {
    flex: none; margin: 0 12px; border-radius: 12px; background: var(--fill-hover);
    box-shadow: inset 0 0 0 .5px var(--line);
  }
  .card > * + *, .options > * { border-top: .5px solid var(--line); }
  .options { display: contents; }
  .setting {
    display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 8px 12px;
  }
  label.setting { cursor: pointer; }
  .text { flex: 1; min-width: 0; }
  .text b { display: block; font-weight: 500; }
  .text small { display: block; margin-top: 1px; color: var(--fg-sub); font-size: 12px; }

  .stepper { display: flex; align-items: center; gap: 4px; }
  .stepper button { width: 32px; padding: 0; border-radius: 50%; font-size: 18px; line-height: 1; }
  .length {
    width: 56px; height: 32px; padding: 0; margin: 0; appearance: textfield; border: 0; border-radius: 10px;
    background: transparent; color: inherit; font: inherit; font-size: 15px; font-weight: 600; text-align: center;
  }
  .length::-webkit-inner-spin-button { appearance: none; margin: 0; }
  .length:focus { outline: 0; box-shadow: 0 0 0 3px var(--ring); }

  .setting input[type="checkbox"] { position: absolute; opacity: 0; pointer-events: none; }
  .switch {
    position: relative; flex: none; width: 42px; height: 26px; border-radius: 13px;
    background: var(--fill-strong); transition: background .2s;
  }
  .switch::after {
    content: ""; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .2s;
  }
  input:checked + .switch { background: var(--fg); }
  input:checked + .switch::after { transform: translateX(16px); }
  input:focus-visible + .switch { box-shadow: 0 0 0 3px var(--ring); }

  .strength { display: flex; align-items: center; gap: 12px; padding: 12px; }
  .strength .name { flex: none; font-weight: 500; }
  .meter { flex: 1; height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden; }
  .meter div { height: 100%; border-radius: 3px; background: var(--fg); transition: width .2s; }
  .strength output { flex: none; min-width: 108px; text-align: right; font-variant-numeric: tabular-nums; }
  .strength.weak .meter div { background: var(--weak); }
  .strength.weak output { color: var(--weak); }

  .results { display: flex; flex: none; align-items: center; justify-content: space-between; padding: 12px 16px 2px; color: var(--fg-sub); }
  .results button { height: 28px; padding: 0 12px; }
  .rows { margin: 0; padding: 6px 6px 8px; list-style: none; overflow-y: auto; }
  .row {
    display: block; width: 100%; height: auto; padding: 8px 12px; border-radius: 10px;
    background: transparent; color: inherit; text-align: center; font-weight: 400;
    overflow-wrap: anywhere; font: 90%/1.3 ui-monospace, "SF Mono", Menlo, monospace;
    transition: background .1s;
  }
  .row:hover { opacity: 1; background: var(--fill); }
  .row:active { opacity: 1; background: var(--fill-strong); }
  .row.copied { animation: copied .3s ease-out; }
  @keyframes copied {
    0%, 35% { background: color-mix(in srgb, var(--fg) 35%, transparent); }
  }
`;

// Running again while the panel is open closes it.
const existing = document.getElementById(HOST_ID);
if (existing) {
  existing.remove();
} else {
  const host = el("div", { id: HOST_ID });
  const root = host.attachShadow({ mode: "open" });
  const theme = document.documentElement.dataset.theme;
  if (theme) host.dataset.theme = theme;

  const modes = Object.keys(MODES) as Mode[];
  let mode: Mode = "password";
  // Each mode remembers its own size and option flags across switches.
  const sizes = Object.fromEntries(
    modes.map((m) => [m, MODES[m].initial]),
  ) as Record<Mode, number>;
  const flags: Flags = {};
  for (const m of modes) {
    for (const { key, checked } of MODES[m].options) flags[key] = checked;
  }

  const hint = el("p", { className: "hint" });
  const unit = el("b");
  const length = el("input", {
    className: "length",
    type: "number",
    oninput: render,
    onchange: commit,
  });
  const options = el("div", { className: "options" });
  const meterFill = el("div");
  const level = el("output");
  const strength = el(
    "div",
    { className: "strength" },
    el("span", { className: "name" }, "Strength"),
    el("div", { className: "meter" }, meterFill),
    level,
  );
  const rows = el("ul", { className: "rows" });

  function sizeOf() {
    const { min, max } = MODES[mode];
    return clamp(length.valueAsNumber, min, max);
  }

  function bump(delta: number) {
    const { min, max } = MODES[mode];
    length.value = String(clamp(sizeOf() + delta, min, max));
    render();
  }

  function select(next: Mode) {
    sizes[mode] = sizeOf();
    mode = next;
    sync();
    render();
  }

  // Rebuilds everything that depends on the current mode.
  function sync() {
    const spec = MODES[mode];
    hint.textContent = spec.hint;
    unit.textContent = spec.unit;
    length.min = String(spec.min);
    length.max = String(spec.max);
    length.value = String(sizes[mode]);
    length.title = `${spec.min}-${spec.max}`;
    options.replaceChildren(
      ...spec.options.map(({ key, label, note }) => {
        const input = el("input", {
          type: "checkbox",
          checked: flags[key],
          onchange: () => {
            flags[key] = input.checked;
            render();
          },
        });
        return el(
          "label",
          { className: "setting" },
          el(
            "span",
            { className: "text" },
            el("b", {}, label),
            el("small", {}, note),
          ),
          input,
          el("span", { className: "switch" }),
        );
      }),
    );
  }

  function render() {
    const spec = MODES[mode];
    const { make, bits } = spec.plan(sizeOf(), flags);
    const weak = bits < WEAK_BITS;
    const name = weak ? "Weak" : bits < STRONG_BITS ? "Good" : "Strong";
    level.textContent = `${Math.floor(bits)} bit · ${name}`;
    meterFill.style.width = `${Math.min(100, (bits / METER_BITS) * 100)}%`;
    strength.classList.toggle("weak", weak);
    rows.replaceChildren(
      ...Array.from({ length: ROWS }, () => {
        const text = make();
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

  // Shows the size actually used; not done on input so the field can be emptied while typing.
  function commit() {
    length.value = String(sizeOf());
    render();
  }

  const panel = el(
    "div",
    { className: "panel" },
    el(
      "div",
      { className: "top" },
      el(
        "div",
        { className: "modes" },
        ...modes.map((m) =>
          el(
            "label",
            {},
            el("input", {
              type: "radio",
              name: "mode",
              checked: m === mode,
              onchange: () => select(m),
            }),
            el("span", {}, MODES[m].label),
          ),
        ),
      ),
      el("button", {
        className: "round",
        title: "Close",
        textContent: "✕",
        onclick: () => host.remove(),
      }),
    ),
    hint,
    el(
      "div",
      { className: "card" },
      el(
        "div",
        { className: "setting" },
        el("span", { className: "text" }, unit),
        el(
          "div",
          { className: "stepper" },
          el("button", {
            textContent: "−",
            title: "Decrease",
            onclick: () => bump(-1),
          }),
          length,
          el("button", {
            textContent: "+",
            title: "Increase",
            onclick: () => bump(1),
          }),
        ),
      ),
      options,
      strength,
    ),
    el(
      "div",
      { className: "results" },
      "Click a row to copy",
      el("button", { textContent: "↻ Regenerate", onclick: render }),
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
  sync();
  render();
}
