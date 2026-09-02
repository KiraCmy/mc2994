# Style Guide — mc2994

Technical instrument UI. Dense, dark, precise. Inspired by patcher environments (TouchDesigner, Max/MSP): parameter strips, readouts, and signal paths over chrome.

---

## Principles

1. **Instrument, not product site.** The UI is a control surface for a scene, not marketing layout.
2. **Density over air.** Prefer tight gaps and small type. Whitespace is structural, not decorative.
3. **One accent.** All interactive emphasis uses a single highlight color. Everything else is neutral grey.
4. **Readouts first.** Labels, values, and units should feel like telemetry — tabular, uppercase where short, never ornamental.
5. **Edges over fill.** Prefer 1px borders and flat panels to soft shadows, blurs, and cards.
6. **Scene is the hero.** UI floats lightly over the canvas; it must not compete with the 3D / generative surface.

---

## Color

### Base (neutrals)

| Token | Hex | Use |
| --- | --- | --- |
| `--bg-void` | `#0a0b0d` | App / scene deepest background |
| `--bg-panel` | `#12141a` | Panels, bars, docks |
| `--bg-elevated` | `#1a1d24` | Nested groups, hover wells |
| `--border` | `#2a2e38` | Default 1px edges |
| `--border-subtle` | `#1e222b` | Dividers, inactive |
| `--text` | `#c8ccd4` | Primary labels |
| `--text-muted` | `#6b7280` | Secondary, units, hints |
| `--text-dim` | `#4b5160` | Disabled, placeholders |

### Accent (single highlight)

| Token | Hex | Use |
| --- | --- | --- |
| `--accent` | `#e8a317` | Focus, active, selected, value emphasis |
| `--accent-dim` | `#8a6410` | Accent at rest / tracks |
| `--accent-glow` | `rgba(232, 163, 23, 0.18)` | Optional soft focus ring only |

**Rules**

- Do not introduce a second accent (no blue + amber, no rainbow chrome).
- Hue controls that *are* the creative parameter may show a spectrum track; the *UI chrome* around them stays neutral + amber.
- Selection, keyboard focus, active toggles, and live numeric values use `--accent`.
- Avoid purple, neon glow stacks, and multi-color status strips unless they encode real signal states.

### Semantic (sparingly)

| Token | Hex | Use |
| --- | --- | --- |
| `--ok` | `#3d9a6a` | Connected / cooking OK (rare) |
| `--warn` | `#c47a1a` | Same family as accent; prefer accent when possible |
| `--err` | `#c44a4a` | Errors only |

---

## Typography

### Fonts

| Role | Stack | Notes |
| --- | --- | --- |
| UI / labels | `"IBM Plex Mono", "JetBrains Mono", "SF Mono", ui-monospace, monospace` | Patcher default |
| Optional display | Same mono, or `"IBM Plex Sans", system-ui` at same small sizes | Never large marketing serifs |

Avoid Inter, Roboto, Arial as brand voice. Mono is the graphic identity.

### Scale (keep small)

| Token | Size | Line | Use |
| --- | --- | --- | --- |
| `--type-micro` | `9px` | 1.2 | Badges, axis ticks, wire labels |
| `--type-caption` | `10px` | 1.3 | Panel titles, section headers |
| `--type-body` | `11px` | 1.35 | Control labels |
| `--type-value` | `11px` | 1.2 | Numeric readouts (tabular nums) |
| `--type-title` | `13px` | 1.2 | App name / operator title max |

**Rules**

- Default UI text is **11px or smaller**. Titles should not exceed **13px**.
- Letter-spacing: `0.06em`–`0.14em` on short uppercase labels (`SPIKES`, `HUE`, `OUT`).
- Values use `font-variant-numeric: tabular-nums`.
- Prefer `UPPERCASE` for 1–2 word control labels; sentence case for longer help text only.
- Font weight: `400` default, `500`–`600` for active values only. No heavy display weights.

---

## Layout & density

| Token | Value | Use |
| --- | --- | --- |
| `--space-1` | `2px` | Hairline internal |
| `--space-2` | `4px` | Label ↔ control |
| `--space-3` | `6px` | Within a control group |
| `--space-4` | `8px` | Between groups |
| `--space-5` | `12px` | Panel padding |
| `--space-6` | `16px` | Screen edge inset |

**Rules**

- Panels hug content; avoid large empty regions inside chrome.
- Control bars: horizontal strips along edges (bottom / side), not floating marketing cards.
- One job per region: header = identity; bar = parameters; canvas = output.
- Mobile: keep type sizes; wrap groups; do not enlarge fonts to “feel friendlier.”

---

## Surfaces & chrome

### Panels

- Background: flat `--bg-panel` (optional slight transparency over the scene: `rgba(18, 20, 26, 0.88)`).
- Border: `1px solid --border`.
- Radius: `2px`–`4px` max. Prefer square / near-square. No pills (`border-radius: 999px`).
- Shadow: none, or a single hard offset (`0 1px 0 rgba(0,0,0,0.4)`). No soft multi-layer drop shadows.
- Backdrop blur: optional and subtle (`≤ 8px`); do not rely on frosted glass as the look.

### Dividers

- 1px `--border-subtle` rules between parameter groups.
- Mimic TD parameter rows / Max inspector lists: label left, control mid, value right.

### No cards by default

- Do not wrap every control in a bordered “card.”
- Borders enclose *functional* docks only (control bar, inspector, node list).

---

## Controls

### Labels & values

```
[ SPIKES .................... 14 ]
[ =========●==================== ]
```

- Label: muted or primary text, uppercase micro/caption.
- Value: right-aligned, `--accent` when editing / live; `--text` at rest.
- Units inline (`14`, `200°`, `0.75`) — no decorative badges.

### Sliders / ranges

- Track height: `2px`–`3px`.
- Track fill (progress): `--accent` or `--accent-dim`.
- Thumb: `8px`–`10px` square or short rectangle (not large circular candy thumbs).
- Hue/spectrum tracks are allowed as *parameter content*; chrome around them stays neutral.

### Buttons / toggles

- Flat, 1px border, small padding (`4px 8px`).
- Active: border + text (or fill) `--accent`.
- Inactive: `--border` + `--text-muted`.
- No rounded-full pills; no icon+glow stacks.

### Swatches / modes

- Small squares or short labeled toggles, not chip clouds.
- Active state = accent border, not shadow rings.

### Focus

- `:focus-visible` → `outline: 1px solid var(--accent); outline-offset: 1px;`
- No thick blue browser glow; neutralize with the accent.

---

## Motion

Use motion as status and hierarchy, not decoration.

| Motion | Duration | Easing | Use |
| --- | --- | --- | --- |
| Panel appear | `120–180ms` | `ease-out` | Dock mount |
| Value tick | `80–120ms` | `linear` / snap | Numeric change |
| Accent flash | `100–200ms` | pulse once | Parameter cooked / applied |

**Rules**

- Prefer snappy over floaty. No long fades or bouncing.
- Continuous motion belongs in the **scene**, not in chrome (unless a live meter / waveform).
- Avoid ambient glow pulses on idle UI.

---

## Iconography & ornament

- Prefer text labels over icons. If icons exist: 12–14px, 1px stroke, monochrome.
- No emoji in the UI chrome.
- Grid / crosshair / scanline overlays are acceptable only if they aid the scene; keep opacity low (`≤ 0.08`).
- Node/patch metaphors (ports, cables) only when the product actually exposes graph editing.

---

## Do / Don’t

| Do | Don’t |
| --- | --- |
| Small mono type, dark void, amber accent | Large sans headlines, cream/light themes |
| Hairline borders, dense parameter rows | Soft cards, pill clusters, stat strips |
| Tabular numeric readouts | Decorative badges on the canvas |
| One accent for all interaction | Multiple brand colors in chrome |
| UI as thin overlay on the scene | Dashboard layouts competing with the scene |

---

## CSS variable starter

```css
:root {
  --bg-void: #0a0b0d;
  --bg-panel: #12141a;
  --bg-elevated: #1a1d24;
  --border: #2a2e38;
  --border-subtle: #1e222b;
  --text: #c8ccd4;
  --text-muted: #6b7280;
  --text-dim: #4b5160;
  --accent: #e8a317;
  --accent-dim: #8a6410;
  --accent-glow: rgba(232, 163, 23, 0.18);

  --font-ui: "IBM Plex Mono", "JetBrains Mono", "SF Mono", ui-monospace, monospace;
  --type-micro: 9px;
  --type-caption: 10px;
  --type-body: 11px;
  --type-value: 11px;
  --type-title: 13px;

  --radius: 2px;
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 12px;
  --space-6: 16px;
}
```

---

## References (feel, not copy)

- **TouchDesigner** — dark operator parameters, small caps labels, orange cooking accent, dense panes around a viewport.
- **Max / MSP** — patcher grey, compact object boxes, inspector lists, selection highlight as the sole bright cue.
- Goal: a **live instrument panel**, not a consumer SaaS dashboard.
