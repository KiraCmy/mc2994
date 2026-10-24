# Web Page Design Method

Practical notes for building and refining pages in **BORN ANOTHER** (`Project03_Born-Another`). Add new sections here as workflows are documented.

---

## Concept page images: insert assets and control frame size

A short guide for adding photographs to the Concept page and controlling how they sit inside editorial media frames.

Applies to: Concept tab (`src/concept/`).

### Where size is defined

Image **slots** (placeholders and filled photos share the same boxes) are sized in CSS, not in JSX.

**File:** `Project03_Born-Another/src/concept/concept.css`

| What you want to change | Main selectors |
| --- | --- |
| Overall collage height (Section 02) | `.concept-collage--02` → `min-height` |
| Collage layout (tall left + two stacked right) | `.concept-collage--02` → `grid-template-columns` / `grid-template-rows` |
| Tall single frames (Sections 03, 05, 06) | `.concept-frame--tall` → `min-height`; `.concept-frame--tall .concept-media` → `aspect-ratio` |
| Wide collage (Section 04) | `.concept-collage--04` → `min-height` and grid columns |
| Text vs media column widths | `.concept-panel` → `grid-template-columns` |

Base media box:

```css
.concept-media {
  width: 100%;
  height: 100%;
  /* fills its parent grid / frame */
}

.concept-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;      /* fill frame, keep aspect ratio, crop overflow */
  object-position: center; /* default crop focus */
}
```

`ConceptPage.jsx` only mounts slots and classes; it does not set pixel sizes.

### How to insert an image

**Step A — Put the file in the app assets folder**

Copy the photo into:

`Project03_Born-Another/src/assets/`

Example names:

- `concept-02-fossil.jpg`
- `concept-02-fossil2.jpg`
- `concept-02-fossil3.jpg`

Files that live only under `docs/assets/image/` are **not** automatically available to the Vite app. Copy (or move) them into `src/assets/` first.

**Step B — Import in the Concept page**

**File:** `Project03_Born-Another/src/concept/ConceptPage.jsx`

```js
import concept02Fossil from '../assets/concept-02-fossil.jpg'
```

**Step C — Pass `src` into `MediaSlot`**

```jsx
<MediaSlot
  label="Ammonite / fossil form"
  src={concept02Fossil}
  className="concept-collage__a concept-media--fossil"
/>
```

`MediaSlot` behavior:

- With `src` → renders `<img alt={label} />`
- Without `src` → shows the gray labeled placeholder

Repeat for each slot (Sections 02–06). Leave `src` off until the asset exists.

### Optional crop fine-tuning (`object-position`)

After the image appears, adjust **which part of the photo stays visible** inside the fixed frame.

Still in `concept.css`, target a specific slot class:

```css
.concept-collage--02 .concept-media--fossil img {
  object-position: 50% 46%; /* horizontal% vertical% */
}
```

| Value | Effect |
| --- | --- |
| `50% 50%` | Center (default) |
| `50% 40%` | Bias upward |
| `50% 60%` | Bias downward |
| `30% 50%` | Bias left |
| `70% 50%` | Bias right |

Keep `object-fit: cover` so images are not stretched. Do not change the editorial grid unless you intentionally want larger or smaller frames (see **Where size is defined** above).

### Checklist for a new Concept photo

1. Add the file under `src/assets/`.
2. `import` it in `ConceptPage.jsx`.
3. Set `src={...}` on the matching `MediaSlot`.
4. (Optional) Add an `object-position` rule in `concept.css`.
5. Save and hard-refresh the browser if the old asset is cached.

### Related files (summary)

| File | Role |
| --- | --- |
| `src/assets/*` | Image binaries the bundler can import |
| `src/concept/ConceptPage.jsx` | Imports + `MediaSlot` `src` wiring |
| `src/concept/concept.css` | Frame size, grid, `object-fit` / `object-position` |

Do not change the global Header or Section 01 Hero when only adding story imagery (Sections 02–06).
