import * as THREE from 'three'

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function normalize(x, y, z) {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/**
 * Dark cyan/pink studio. Each reflection is a wide colored shoulder plus a
 * narrower core, so the same flow reads as a soft band in one place and a
 * tighter streak in another. The base stays dark.
 */
function envRadiance(dir) {
  const y = dir[1]
  const deep = [0.1, 0.22, 0.32]
  const cyan = [0.28, 0.72, 0.86]
  const sky = [0.85, 1.05, 1.12]
  const pink = [0.95, 0.32, 0.42]

  let color = deep.map((channel, index) => mix(channel, cyan[index], smoothstep(-0.35, 0.45, y)))
  color = color.map((channel, index) => mix(channel, sky[index], smoothstep(0.15, 0.9, y)))
  color = color.map((channel, index) => mix(channel, pink[index], smoothstep(0.05, -0.7, y) * 0.8))

  const bands = [
    { axis: normalize(0.15, 0.2, 0.97), offset: 0.08, shoulder: 0.1, core: 0.034, shoulderColor: [0.28, 0.85, 1.1], coreColor: [0.7, 2.0, 2.35] },
    { axis: normalize(-0.45, 0.35, 0.82), offset: -0.18, shoulder: 0.13, core: 0.05, shoulderColor: [1.15, 0.26, 0.4], coreColor: [2.15, 0.5, 0.75] },
    { axis: normalize(0.55, -0.15, 0.82), offset: 0.22, shoulder: 0.075, core: 0.024, shoulderColor: [0.22, 0.8, 1.05], coreColor: [0.4, 1.7, 2.1] },
    { axis: normalize(0.2, 0.72, 0.66), offset: -0.05, shoulder: 0.11, core: 0.055, shoulderColor: [0.85, 0.5, 0.38], coreColor: [1.7, 1.05, 0.8] },
    { axis: normalize(-0.7, 0.15, 0.7), offset: 0.3, shoulder: 0.06, core: 0.02, shoulderColor: [0.55, 0.62, 0.7], coreColor: [1.35, 1.5, 1.7] },
    { axis: normalize(0.82, 0.45, 0.35), offset: 0.1, shoulder: 0.14, core: 0.042, shoulderColor: [0.18, 0.65, 0.8], coreColor: [0.32, 1.35, 1.65] },
    { axis: normalize(-0.2, -0.55, 0.8), offset: -0.12, shoulder: 0.085, core: 0.03, shoulderColor: [1.05, 0.24, 0.34], coreColor: [1.85, 0.42, 0.58] },
  ]

  for (const band of bands) {
    const distance = Math.abs(dot(dir, band.axis) - band.offset)
    const shoulder = Math.exp(-(distance * distance) / (band.shoulder * band.shoulder))
    const core = Math.exp(-(distance * distance) / (band.core * band.core))
    color = color.map(
      (channel, index) =>
        channel + band.shoulderColor[index] * shoulder + band.coreColor[index] * core,
    )
  }

  const front = Math.pow(Math.max(dot(dir, normalize(0.05, 0.12, 1)), 0), 4)
  const key = Math.pow(Math.max(dot(dir, normalize(0.45, 0.72, 0.5)), 0), 18)
  return color.map((channel, index) => channel + front * [0.45, 0.7, 0.8][index] + key * 1.4)
}

function faceDirection(face, u, v) {
  const s = u * 2 - 1
  const t = 1 - v * 2
  switch (face) {
    case 0:
      return normalize(1, t, -s)
    case 1:
      return normalize(-1, t, s)
    case 2:
      return normalize(s, 1, -t)
    case 3:
      return normalize(s, -1, t)
    case 4:
      return normalize(s, t, 1)
    default:
      return normalize(-s, t, -1)
  }
}

function srgbByte(linear) {
  const x = clamp01(linear)
  const encoded = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
  return Math.round(clamp01(encoded) * 255)
}

function sampleEnv(dir, blur) {
  if (blur <= 0) return envRadiance(dir)
  const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const tangent = normalize(
    up[1] * dir[2] - up[2] * dir[1],
    up[2] * dir[0] - up[0] * dir[2],
    up[0] * dir[1] - up[1] * dir[0],
  )
  const bitangent = [
    dir[1] * tangent[2] - dir[2] * tangent[1],
    dir[2] * tangent[0] - dir[0] * tangent[2],
    dir[0] * tangent[1] - dir[1] * tangent[0],
  ]
  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2
    const radius = blur * (0.35 + (i % 4) * 0.22)
    const offset = [
      dir[0] + (Math.cos(angle) * tangent[0] + Math.sin(angle) * bitangent[0]) * radius,
      dir[1] + (Math.cos(angle) * tangent[1] + Math.sin(angle) * bitangent[1]) * radius,
      dir[2] + (Math.cos(angle) * tangent[2] + Math.sin(angle) * bitangent[2]) * radius,
    ]
    const sample = envRadiance(normalize(offset[0], offset[1], offset[2]))
    r += sample[0]
    g += sample[1]
    b += sample[2]
    weight += 1
  }
  return [r / weight, g / weight, b / weight]
}

function makeCube(size, blur) {
  const images = []
  for (let face = 0; face < 6; face += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const image = context.createImageData(size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dir = faceDirection(face, (x + 0.5) / size, (y + 0.5) / size)
        const color = sampleEnv(dir, blur).map((channel) => 1 - Math.exp(-channel * 0.55))
        const index = (y * size + x) * 4
        image.data[index] = srgbByte(color[0])
        image.data[index + 1] = srgbByte(color[1])
        image.data[index + 2] = srgbByte(color[2])
        image.data[index + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
    images.push(canvas)
  }
  const texture = new THREE.CubeTexture(images)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.mapping = THREE.CubeReflectionMapping
  texture.needsUpdate = true
  return texture
}

let envMaps = null

/** Sharp and blurred cubemaps. Built once; only the MATERIAL shader samples them. */
export function getOrganismEnvMaps() {
  if (!envMaps) {
    envMaps = {
      sharp: makeCube(128, 0),
      soft: makeCube(48, 0.28),
    }
  }
  return envMaps
}
