# Design

Baseline for the panel UI of bookmarklets under `src/`. It is a guideline, not a spec: each bookmarklet keeps its own CSS string and may deviate where its purpose calls for it (for example a different palette or layout). The index page is out of scope; see CLAUDE.md.

The look is macOS-style frosted glass that follows the system light/dark setting. This document is the source of truth: when a bookmarklet differs from it, either the bookmarklet has a reason to or the document is updated.

## Keep

These protect the host page and the user's expectations, so deviate only with a reason.

- **Isolation**: mount the panel in a Shadow DOM (`attachShadow({ mode: "open" })`) on a host element with id `bookmarklet-<name>`, and start the stylesheet with `:host { all: initial; }`. Page CSS must not leak in, and panel CSS must not leak out.
- **Placement**: `position: fixed` at the top right (`top: 12px; right: 12px`) with `z-index: 2147483647`. Size is `min(<width>, calc(100vw - 24px))` and `max-height: calc(100vh - 24px)` so it fits small viewports.
- **Single instance**: running the bookmarklet while its panel exists never creates a second one. Closing a panel removes its host; a panel that holds work in progress may fold instead and be revealed by the next run.
- **Light and dark**: define every color as a custom property and override them under `prefers-color-scheme: dark`. Never hardcode a color in a rule.
- **No external resources**: system fonts and inline SVG icons only.

## Default look

Change these freely when the bookmarklet needs a different feel.

- **Surface**: translucent `--glass` background with `backdrop-filter: blur(40px) saturate(180%)`, radius 18px, and a hairline ring plus a soft drop shadow. A bookmarklet that puts long text on the panel may use a lighter blur and a more opaque inner surface so the page behind never hurts readability.
- **Type**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` at 13px/1.3, with `-webkit-font-smoothing: antialiased`. Titles are 15px/600, secondary text uses `--fg-sub`, and data uses `ui-monospace, "SF Mono", Menlo, monospace`.
- **Color tokens**: the names below recur across panels. Add bookmarklet-specific ones (`--weak`, `--card`, `--surface`) as needed.

  | Token | Role |
  | ----- | ---- |
  | `--fg` / `--fg-sub` | Primary and secondary text |
  | `--fg-inv` | Text on a `--fg` background (selected segment, primary button) |
  | `--glass` | Panel surface |
  | `--line` | Hairlines and the panel ring |
  | `--fill` / `--fill-hover` / `--fill-strong` | Control background, inset surface (card, textarea), control hover and pressed |
  | `--ring` | Focus ring |

  Accent color is not used: emphasis comes from inverting `--fg` and `--fg-inv`. Red (`--weak`) is reserved for warnings and errors.
- **Shape and size**: controls are 32px tall; buttons use radius 10px, icon buttons are 32px circles, and inset surfaces (cards, textareas) use radius 12px. Spacing steps are 8px and 12px, and panel edge padding is 12px.
- **Controls**:
  - Text input and textarea: `--fill-hover` background, 0.5px inset ring.
  - Button: `--fill` background, `--fill-strong` on hover, opacity .6 on press.
  - Primary action: `--fg` background with `--fg-inv` text.
  - Toggle and segmented control: selected state is `--fg` with `--fg-inv`.
  - Focus: `box-shadow: 0 0 0 3px var(--ring)` on `:focus-visible`, never a bare outline.
- **Motion**: 0.1–0.2s transitions on background, opacity and transform. Feedback for an action (such as a copied row) is a short flash of `--fg` mixed into the background.
- **Selection**: a bookmarklet that acts on the page selection falls back to something useful when nothing is selected, and text derived from the selection stays editable in the panel.
