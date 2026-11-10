/**
 * Lifts a life out of its water in a square snapshot (the crop is centred on
 * the body, which fills roughly the middle two thirds): the background colour
 * is the median of the crop's border; pixels far from it, and the middle of
 * the crop, stay; the rest fades to transparent, with a soft round falloff
 * and a feathered edge. Works in place on RGBA pixel data (pure; no DOM).
 */
export function cutOutPixels(data, size, { border = 6 } = {}) {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  let n = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x >= border && y >= border && x < size - border && y < size - border) continue
      const i = (y * size + x) * 4
      hist[0][data[i]]++
      hist[1][data[i + 1]]++
      hist[2][data[i + 2]]++
      n++
    }
  }
  const median = (h) => {
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += h[v]
      if (acc >= n / 2) return v
    }
    return 255
  }
  const bg = hist.map(median)
  const alpha = new Float32Array(size * size)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) / 255
      const r = Math.hypot(x - c, y - c) / size
      const colour = smooth(0.13, 0.27, d)
      const inner = 1 - smooth(0.22, 0.33, r)
      alpha[y * size + x] = Math.max(colour, inner) * (1 - smooth(0.38, 0.47, r))
    }
  }
  /* Feather: one 3×3 box blur. */
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0
      let k = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue
          s += alpha[yy * size + xx]
          k++
        }
      }
      data[(y * size + x) * 4 + 3] = Math.round((s / k) * 255)
    }
  }
  return { background: bg }
}

function smooth(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
