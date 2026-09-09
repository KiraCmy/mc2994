# Noise Lab

Curl-noise instrument: shared 2D map drives a 3D world. Tabbed views on one address. UI follows `STYLE-GUIDE.md`.

## Run

```bash
cd Project02
npm install
npm run dev
```

Open the printed `localhost` URL, then switch tabs:

- `#/2d` — 2D curl noise map + equation
- `#/3d` — 3D world; toggle / drag the floating 2D map

Noise / resolution / shaping settings are shared across tabs. Hover any control label for a tip.

## Controls

| Group | Params | Where |
| --- | --- | --- |
| NOISE | SCALE, OCTAVES, STRENGTH, EVOLVE | both tabs |
| GRID | RES | both tabs |
| GRID | HEIGHT, SIZE | 3D tab |
| SHAPING | OP + amount | both tabs |

## Pipeline

1. FBM simplex potential → shaping op
2. Finite-difference curl → 2D map (magnitude + flow ticks)
3. Same map bilinear-sampled onto 3D plane vertices (height + lateral curl)
