# Style Guide — Noise Lab

Editorial technical UI. Black field, white structure, quiet hierarchy. Inspired by the supplied `Computers and Design` poster: a sparse grid of points, strict alignment, small typography, and modernist composition rather than software chrome.

---

## Core Direction

1. **Poster first, app second.** The interface should feel composed like a print layout, not skinned like a dashboard.
2. **Black as negative space.** Large dark areas are intentional and should give the grid and text room to breathe.
3. **Structure is the visual language.** Thin lines, repeated columns, dot matrices, and aligned text blocks carry the identity.
4. **White is primary.** Most marks are white or near-white on black; color is reserved for one restrained interaction accent.
5. **Hierarchy through scale, not decoration.** Size shifts, spacing, and placement should create emphasis instead of shadows, gradients, or cards.
6. **UI elements should look typeset.** Labels, values, tabs, and annotations should feel placed on a system, not freely floating.

---

## Reference Read

The poster suggests:

- a **black background** with near-white marks
- a **field of thin orthogonal lines**
- **circular nodes** of changing size
- **large, blocky headline typography** anchored to one side
- **small metadata columns** at the bottom
- **asymmetrical balance** with lots of empty space

Noise Lab should borrow that logic, not literally recreate the poster.

---

## Color

### Base palette

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | `#000000` | Page background |
| `--bg-soft` | `#080808` | Hover wells, subtle overlays |
| `--line` | `#5f5f5f` | Structural lines, guides |
| `--line-soft` | `#2d2d2d` | Secondary dividers |
| `--text` | `#f2f2f2` | Primary text |
| `--text-soft` | `#bcbcbc` | Secondary labels |
| `--text-dim` | `#7a7a7a` | Tertiary metadata |
| `--dot` | `#f4f4f4` | Nodes, active plot points |

### Accent

| Token | Hex | Use |
| --- | --- | --- |
| `--accent` | `#d6c36f` | Hover, focus, active tab, active value |
| `--accent-soft` | `#7b7140` | Subtle accent borders / inactive highlighted state |

**Rules**

- The experience should read as **black + white first**.
- Accent is sparse and should appear mostly on interaction states.
- Do not use saturated neon hues as the default brand language.
- Avoid rainbow spectrum UI chrome; if a data visualization needs color, keep the surrounding interface monochrome.

---

## Typography

### Font direction

| Role | Stack | Notes |
| --- | --- | --- |
| UI / small labels | `"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif` | Neutral modernist utility |
| Headline / display | `"Arial Black", "Helvetica Neue", Arial, sans-serif` | Heavy grotesk feel for large title blocks |
| Numeric / code readout | `"IBM Plex Mono", "SF Mono", ui-monospace, monospace` | For equations, values, coordinates |

The poster reference feels less like a mono-only instrument and more like **Swiss/modernist sans with occasional technical readout**.

### Scale

| Token | Size | Use |
| --- | --- | --- |
| `--type-micro` | `9px` | Fine metadata, captions |
| `--type-small` | `10px` | Control labels, tabs |
| `--type-body` | `11px` | Secondary UI copy |
| `--type-value` | `11px` | Numeric readouts |
| `--type-subtitle` | `14px` | Secondary title or author line |
| `--type-display` | `40px` to `64px` | Main page identity block |

**Rules**

- Small UI remains small and dense.
- Large titles are allowed, but only as **one anchored headline block**.
- Use sentence case or title case for long labels; reserve all-caps for tiny UI tags.
- Tight leading on headlines; normal leading on controls.
- Use `font-variant-numeric: tabular-nums` for values.

---

## Composition

### General layout

- Build pages as **composed fields**, not evenly padded app frames.
- Favor **asymmetry**: one main active region, one strong text anchor, one secondary annotation zone.
- Leave deliberate unused space.
- Align major objects to an invisible grid.

### Anchors

- Main map or world occupies a dominant field.
- Title block sits distinctly to one side or corner.
- Supporting info can live in thin strips or stacked metadata zones.
- Bottom-aligned small text or notes are welcome if they support the composition.

### Grid language

- Use visible horizontal / vertical rules when helpful.
- Dots and intersections should feel engineered and plotted.
- Spacing should be systematic, with repeated intervals.

---

## Surfaces

- Prefer **no obvious panels** when possible.
- When containment is needed, use hairline borders only.
- Background fills should stay very close to black.
- Avoid glassmorphism, soft card shadows, and rounded consumer UI containers.
- Border radius should be `0px` to `2px` only.

The reference is flatter and more print-like than the previous TouchDesigner-inspired direction.

---

## Controls

### Labels

- Labels should be small, crisp, and understated.
- Hoverable terms may reveal explanations, but tooltips should look like annotation slips, not speech bubbles.
- Keep labels close to their controls; avoid loose floating captions.

### Sliders

- Tracks: `1px` to `2px`, thin and precise.
- Thumbs: dots or tiny squares; visually tied to the line system.
- Values should align cleanly and not overpower the graphic field.

### Tabs

- Tabs should read like small typeset switches or index markers.
- Active state can invert lightly or use the single accent.
- Avoid large pill tabs or segmented-control styling.

### Floating windows

- Floating windows should resemble pinned overlays or drafting panes.
- Keep them minimal: thin border, black fill, small title line.
- Draggable elements should feel like movable composition layers, not desktop OS windows.

### Tooltips

- Tooltip tone: short, factual, technical.
- Tooltip styling: black or dark charcoal, thin border, small text.
- No large bubbles, arrows, or playful motion.

---

## Graphics

### Lines

- Use thin orthogonal lines as a recurring motif.
- Lines should be grey to soft white, not bright accent color by default.
- Grid lines can fade into the background but remain legible.

### Dots / nodes

- Circular markers are a primary motif.
- Vary scale to encode intensity, amplitude, or significance.
- Dots should feel plotted, not glossy.

### Type as graphic mass

- Large text can function as a visual object.
- Allow oversized title blocks to overlap the composition carefully.
- Big text should stay blunt and bold, not elegant or decorative.

---

## Motion

- Motion should be minimal and deliberate.
- Favor hard swaps, subtle fades, or precise drags.
- Avoid elastic easing, glow pulses, and decorative animation.
- The map/world may animate; the chrome should remain calm.

---

## Voice

The interface voice should feel:

- technical
- composed
- slightly academic
- archival / editorial
- restrained

It should not feel:

- playful
- gamer-like
- futuristic neon
- SaaS-polished
- skeuomorphic

---

## Do / Don’t

| Do | Don’t |
| --- | --- |
| Black field with white grid and dots | Colorful dashboard gradients |
| One bold headline block | Many competing titles |
| Hairline rules and precise spacing | Soft cards and pill buttons |
| Sparse accent for interaction | Accent everywhere |
| Asymmetric editorial composition | Perfectly centered generic layouts |
| Annotation-style tooltips | Cartoon bubbles |

---

## CSS Variable Starter

```css
:root {
  --bg: #000000;
  --bg-soft: #080808;
  --line: #5f5f5f;
  --line-soft: #2d2d2d;
  --text: #f2f2f2;
  --text-soft: #bcbcbc;
  --text-dim: #7a7a7a;
  --dot: #f4f4f4;
  --accent: #d6c36f;
  --accent-soft: #7b7140;

  --font-ui: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --font-display: "Arial Black", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", "SF Mono", ui-monospace, monospace;

  --type-micro: 9px;
  --type-small: 10px;
  --type-body: 11px;
  --type-value: 11px;
  --type-subtitle: 14px;
  --type-display: clamp(40px, 6vw, 64px);

  --radius: 2px;
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 8px;
  --space-4: 12px;
  --space-5: 16px;
  --space-6: 24px;
}
```

---

## Application Notes For Noise Lab

- The **2D map** should be treated as a plotted graphic field.
- The **3D page** should still retain poster-like composition, not become a game viewport.
- The **equation panel** should read like a marginal note or technical caption.
- The **floating 2D map** on the 3D page should feel like a movable print overlay.
- The name **Noise Lab** should be treated as a bold identity block when used at display scale.

---

## References

- User-supplied `Computers and Design` poster: black field, dot matrix, thin rules, bold title block.
- Secondary influence can still come from technical software, but the visual priority is now **editorial modernism with computational graphics**.
