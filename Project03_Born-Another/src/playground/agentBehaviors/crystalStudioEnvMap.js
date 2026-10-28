/**
 * Exp03 — high-contrast studio reflection environment for crystal materials only.
 * Reference look needs bright softbox strips against dark voids so facets read
 * as optical glass under Exp05 NoToneMapping (no bloom / no global HDR).
 * Bound via material.envMap only — Exp05 membrane stays unchanged.
 */
import * as THREE from 'three'

function drawSoftbox(ctx, x, y, w, h, color, blur = 8) {
  ctx.save()
  ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none'
  const gradient = ctx.createLinearGradient(x, y, x + w, y)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(0.12, color)
  gradient.addColorStop(0.88, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(x - blur, y - blur, w + blur * 2, h + blur * 2)
  ctx.restore()
}

/**
 * Equirectangular studio: deep cavity + hard vertical light strips
 * (white / cyan / pink) matching the reference facet reflections.
 */
export function paintCrystalStudioEquirect(size = 1024) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size / 2
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas

  /* Near-black studio — contrast floor for specular strips. */
  ctx.fillStyle = '#06050a'
  ctx.fillRect(0, 0, w, h)
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#12101a')
  bg.addColorStop(0.5, '#08070e')
  bg.addColorStop(1, '#040308')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  /* Soft pink floor bounce — underside facets stay alive, not grey plastic. */
  const floor = ctx.createRadialGradient(
    w * 0.5,
    h * 0.95,
    2,
    w * 0.5,
    h * 0.95,
    h * 0.5,
  )
  floor.addColorStop(0, 'rgba(255, 200, 230, 0.32)')
  floor.addColorStop(0.55, 'rgba(180, 140, 220, 0.08)')
  floor.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = floor
  ctx.fillRect(0, h * 0.5, w, h * 0.5)

  /* Key white softbox — dominant strip reflection on large facets */
  drawSoftbox(
    ctx,
    w * 0.58,
    h * 0.05,
    w * 0.055,
    h * 0.78,
    'rgba(255,255,255,1)',
    4,
  )
  /* Hot needle streak inside the key */
  drawSoftbox(
    ctx,
    w * 0.6,
    h * 0.08,
    w * 0.014,
    h * 0.72,
    'rgba(255,255,255,1)',
    0,
  )
  /* Cool cyan strip */
  drawSoftbox(
    ctx,
    w * 0.16,
    h * 0.1,
    w * 0.036,
    h * 0.68,
    'rgba(150, 236, 255, 0.95)',
    5,
  )
  /* Warm pink / magenta strip */
  drawSoftbox(
    ctx,
    w * 0.8,
    h * 0.12,
    w * 0.032,
    h * 0.6,
    'rgba(255, 170, 214, 0.92)',
    5,
  )
  /* Violet panel fill */
  drawSoftbox(
    ctx,
    w * 0.36,
    h * 0.18,
    w * 0.1,
    h * 0.28,
    'rgba(186, 150, 255, 0.4)',
    16,
  )
  /* Opposite cool rim */
  drawSoftbox(
    ctx,
    w * 0.04,
    h * 0.22,
    w * 0.014,
    h * 0.48,
    'rgba(200, 248, 255, 0.85)',
    1,
  )
  /* Second white strip for multi-facet sparkle when orbiting */
  drawSoftbox(
    ctx,
    w * 0.48,
    h * 0.14,
    w * 0.018,
    h * 0.55,
    'rgba(255,252,255,0.9)',
    2,
  )

  /* Overhead crown */
  const crown = ctx.createRadialGradient(
    w * 0.5,
    h * 0.14,
    2,
    w * 0.5,
    h * 0.14,
    h * 0.38,
  )
  crown.addColorStop(0, 'rgba(248, 236, 255, 0.34)')
  crown.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = crown
  ctx.fillRect(0, 0, w, h * 0.42)

  return canvas
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @returns {{ texture: THREE.Texture, dispose: () => void }}
 */
export function createCrystalStudioEnvMap(renderer, size = 1024) {
  const canvas = paintCrystalStudioEquirect(size)
  const equirect = new THREE.CanvasTexture(canvas)
  equirect.mapping = THREE.EquirectangularReflectionMapping
  equirect.colorSpace = THREE.SRGBColorSpace
  equirect.needsUpdate = true

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const envRT = pmrem.fromEquirectangular(equirect)
  const texture = envRT.texture

  equirect.dispose()
  pmrem.dispose()

  return {
    texture,
    dispose: () => {
      envRT.dispose()
      texture.dispose?.()
    },
  }
}

/**
 * Studio strips as a plain CubeTexture (no PMREM blur) for the unlit additive
 * glint layer — keeps the strip edges hard like the reference speculars.
 * @param {THREE.WebGLRenderer} renderer
 * @returns {{ texture: THREE.CubeTexture, dispose: () => void }}
 */
export function createCrystalStudioCubeEnvMap(renderer, size = 1024) {
  const canvas = paintCrystalStudioEquirect(size)
  const equirect = new THREE.CanvasTexture(canvas)
  equirect.mapping = THREE.EquirectangularReflectionMapping
  equirect.colorSpace = THREE.SRGBColorSpace
  equirect.needsUpdate = true

  const cubeRT = new THREE.WebGLCubeRenderTarget(Math.max(64, size / 2), {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  })
  cubeRT.fromEquirectangularTexture(renderer, equirect)
  equirect.dispose()

  return {
    texture: cubeRT.texture,
    dispose: () => cubeRT.dispose(),
  }
}

/**
 * Exp03 — bright pastel "room" for the crystal glass body / inner layers.
 * Matches the page backdrop (lavender-grey sky) and the pink pearlescent
 * membrane below, with soft white / cyan / pink windows so facets pick up
 * the reference's luminous pastel reflections instead of a black studio.
 */
export function paintCrystalPastelEquirect(size = 1024) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size / 2
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas

  /* Sky → horizon → membrane floor */
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#f4f1fa')
  sky.addColorStop(0.28, '#d9d4ea')
  sky.addColorStop(0.47, '#c4bcd8')
  sky.addColorStop(0.53, '#e9c3d4')
  sky.addColorStop(0.75, '#f3cfdd')
  sky.addColorStop(1, '#f7e2ea')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  /* Soft windows (blurred) — broad pastel facet reflections */
  const windows = [
    [0.56, 0.08, 0.1, 0.36, 'rgba(255,255,255,0.95)', 18],
    [0.14, 0.14, 0.07, 0.3, 'rgba(196,240,255,0.85)', 16],
    [0.8, 0.16, 0.07, 0.28, 'rgba(255,200,228,0.85)', 16],
    [0.34, 0.1, 0.12, 0.2, 'rgba(214,196,255,0.7)', 24],
  ]
  for (const [x, y, ww, hh, color, blur] of windows) {
    drawSoftbox(ctx, w * x, h * y, w * ww, h * hh, color, blur)
  }

  /* Pearlescent sheen band along the membrane horizon */
  const band = ctx.createLinearGradient(0, h * 0.5, w, h * 0.5)
  band.addColorStop(0, 'rgba(190,226,255,0.35)')
  band.addColorStop(0.35, 'rgba(255,214,234,0.4)')
  band.addColorStop(0.7, 'rgba(220,206,255,0.35)')
  band.addColorStop(1, 'rgba(190,226,255,0.35)')
  ctx.fillStyle = band
  ctx.fillRect(0, h * 0.5, w, h * 0.12)

  return canvas
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @returns {{ texture: THREE.Texture, dispose: () => void }}
 */
export function createCrystalPastelEnvMap(renderer, size = 1024) {
  const canvas = paintCrystalPastelEquirect(size)
  const equirect = new THREE.CanvasTexture(canvas)
  equirect.mapping = THREE.EquirectangularReflectionMapping
  equirect.colorSpace = THREE.SRGBColorSpace
  equirect.needsUpdate = true

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const envRT = pmrem.fromEquirectangular(equirect)
  const texture = envRT.texture

  equirect.dispose()
  pmrem.dispose()

  return {
    texture,
    dispose: () => {
      envRT.dispose()
      texture.dispose?.()
    },
  }
}

/**
 * Exp03 crystal studio light rig (offsets relative to the crystal seat).
 * Shared by CrystalAgentsStaticScene so tuning lives next to the env maps.
 */
export const EXP03_CRYSTAL_LIGHT_RIG = Object.freeze({
  ambient: { intensity: 0.14, color: '#ece6f6' },
  directional: [
    /* Soft white key — facet speculars without blowing whole faces out */
    { offset: [3.4, 4.2, 2.8], intensity: 1.05, color: '#ffffff' },
    /* Cool cyan rim */
    { offset: [-3.2, 1.0, 3.4], intensity: 0.6, color: '#a8eefc' },
    /* Warm pink / magenta rim */
    { offset: [2.0, 2.8, -3.2], intensity: 0.55, color: '#ffb6d8' },
    /* Violet fill */
    { offset: [-1.2, 3.6, -1.4], intensity: 0.3, color: '#d4c0ff' },
  ],
  point: [
    { offset: [0.5, 0.9, 0.8], intensity: 0.75, distance: 3.4, color: '#fff8fc' },
    { offset: [-0.6, 0.3, 0.7], intensity: 0.55, distance: 3.0, color: '#b8f0fa' },
  ],
})
