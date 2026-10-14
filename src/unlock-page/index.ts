// Pages block these actions with inline `on<event>` handlers, handlers assigned
// as element properties, listeners that call preventDefault(), or CSS. Undo all
// four. Listeners registered on window before this runs cannot be stopped.
// keydown and mousedown are left alone: stopping them breaks the page itself.
const EVENTS = [
  "contextmenu",
  "copy",
  "cut",
  "paste",
  "selectstart",
  "dragstart",
];

const targets = [window, document, ...document.querySelectorAll("*")];
for (const target of targets) {
  for (const event of EVENTS) {
    Reflect.set(target, `on${event}`, null);
  }
}

for (const event of EVENTS) {
  window.addEventListener(event, (e) => e.stopImmediatePropagation(), true);
}

const style = document.createElement("style");
style.textContent =
  "*, *::before, *::after { -webkit-user-select: text !important; user-select: text !important; -webkit-touch-callout: default !important; }";
document.head.appendChild(style);
