/**
 * Exp03 Study 01 — optical crystal (reference: glass + strip speculars).
 *
 * No onBeforeCompile (previous injects vanished crystals in WebGL).
 * Look comes from: near-white glass albedo, attenuation hue, iridescence,
 * clearcoat, and a crystal-only high-contrast studio envMap.
 */
import * as THREE from 'three'

const EXP03_OPTICAL_SLOTS = [
  {
    /* warm pink quartz */
    attenuation: new THREE.Color('#f0a0c4'),
    specular: new THREE.Color('#ffffff'),
    iridescenceRange: [240, 560],
  },
  {
    /* rose / peach */
    attenuation: new THREE.Color('#e890b8'),
    specular: new THREE.Color('#fff6fa'),
    iridescenceRange: [180, 480],
  },
  {
    /* icy cyan */
    attenuation: new THREE.Color('#7ec8e4'),
    specular: new THREE.Color('#f0fbff'),
    iridescenceRange: [80, 320],
  },
  {
    /* amethyst violet */
    attenuation: new THREE.Color('#b078d8'),
    specular: new THREE.Color('#f6f0ff'),
    iridescenceRange: [320, 680],
  },
  {
    /* pale lavender */
    attenuation: new THREE.Color('#c8aee0'),
    specular: new THREE.Color('#faf6ff'),
    iridescenceRange: [200, 500],
  },
]

export const EXP03_CRYSTAL_TINTS = EXP03_OPTICAL_SLOTS.map((slot) =>
  slot.attenuation.clone().lerp(new THREE.Color('#f7f4f8'), 0.7),
)

function tintSlot(tint01 = 0) {
  const t = Math.min(1, Math.max(0, Number(tint01) || 0))
  return Math.min(
    EXP03_OPTICAL_SLOTS.length - 1,
    Math.floor(t * EXP03_OPTICAL_SLOTS.length),
  )
}

export function exp03CrystalTint(tint01 = 0) {
  return EXP03_CRYSTAL_TINTS[tintSlot(tint01)].clone()
}

/**
 * @param {'crystal' | 'tissue' | 'transition' | 'apron'} layer
 * @param {'primary' | 'secondary' | 'tertiary' | 'micro'} [role]
 * @param {THREE.Texture | null} [envMap]
 */
export function createExp03CrystalMaterial({
  tint = 0.2,
  opacity = 1,
  apron = false,
  layer = null,
  role = 'primary',
  envMap = null,
} = {}) {
  const slotIndex = tintSlot(tint)
  const slot = EXP03_OPTICAL_SLOTS[slotIndex]
  const o = Math.min(1, Math.max(0, opacity))
  const kind = layer || (apron ? 'apron' : 'crystal')

  if (kind === 'apron' || kind === 'tissue') {
    return new THREE.MeshPhysicalMaterial({
      color: slot.attenuation.clone().lerp(new THREE.Color('#f6f1f4'), 0.55),
      transmission: 0.5 * o,
      thickness: 0.25,
      ior: 1.35,
      roughness: 0.38,
      metalness: 0,
      iridescence: 0.2 * o,
      iridescenceIOR: 1.25,
      iridescenceThicknessRange: [100, 300],
      clearcoat: 0.1,
      clearcoatRoughness: 0.45,
      specularIntensity: 0.28,
      envMapIntensity: 0.45,
      transparent: true,
      opacity: Math.min(0.62, 0.3 + o * 0.26),
      depthWrite: false,
      side: THREE.DoubleSide,
      flatShading: false,
      toneMapped: false,
    })
  }

  if (kind === 'transition') {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f2eef2'),
      transmission: 0.6 * o,
      thickness: 0.55,
      ior: 1.42,
      roughness: 0.12,
      metalness: 0,
      iridescence: 0.35 * o,
      iridescenceIOR: 1.28,
      iridescenceThicknessRange: [120, 400],
      clearcoat: 0.45,
      clearcoatRoughness: 0.16,
      specularIntensity: 0.75,
      envMap: envMap || null,
      envMapIntensity: 1.2,
      transparent: true,
      opacity: Math.min(0.85, 0.55 + o * 0.3),
      depthWrite: false,
      side: THREE.DoubleSide,
      flatShading: false,
      toneMapped: false,
    })
  }

  const isMicro = role === 'micro'
  const isPrimary = role === 'primary'

  /*
   * Optical glass toward the reference:
   * - near-white albedo (no painted pastel faces)
   * - transmission for see-through depth
   * - attenuation for pink / cyan / violet volume color
   * - very low roughness + clearcoat for hard strip speculars
   * - iridescence for angle-dependent film
   */
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f7f5f8'),
    transmission: (isMicro ? 0.74 : 0.88) * o,
    thickness: isMicro ? 0.9 : isPrimary ? 2.4 : 1.55,
    ior: 1.58,
    roughness: isMicro ? 0.05 : 0.018,
    metalness: 0,
    iridescence: (isMicro ? 0.55 : 0.72) * o,
    iridescenceIOR: 1.36,
    iridescenceThicknessRange: [...slot.iridescenceRange],
    clearcoat: 1.0,
    clearcoatRoughness: 0.012,
    specularIntensity: 1.0,
    specularColor: slot.specular.clone(),
    envMap: envMap || null,
    envMapIntensity: isMicro ? 2.1 : 3.0,
    attenuationColor: slot.attenuation.clone(),
    attenuationDistance: isMicro ? 0.18 : isPrimary ? 0.3 : 0.24,
    transparent: true,
    opacity: 1,
    depthWrite: true,
    side: THREE.FrontSide,
    flatShading: false,
    toneMapped: false,
  })

  material.userData.exp03OpticalSlot = slotIndex
  material.userData.exp03Role = role
  return material
}

export function bindExp03CrystalEnvMap(material, envMap) {
  if (!material || material.type !== 'MeshPhysicalMaterial') return
  material.envMap = envMap || null
  material.needsUpdate = true
}

export function updateExp03CrystalMaterial(material, { tint, opacity, envMap }) {
  if (!material) return
  if (envMap !== undefined) bindExp03CrystalEnvMap(material, envMap)
  if (tint != null) {
    const slot = EXP03_OPTICAL_SLOTS[tintSlot(tint)]
    material.color.set('#f7f5f8')
    if (material.specularColor) material.specularColor.copy(slot.specular)
    if (material.attenuationColor) {
      material.attenuationColor.copy(slot.attenuation)
    }
    if (material.iridescenceThicknessRange) {
      material.iridescenceThicknessRange = [...slot.iridescenceRange]
    }
  }
  if (opacity != null) {
    const o = Math.min(1, Math.max(0, opacity))
    const isMicro = material.userData.exp03Role === 'micro'
    material.transmission = (isMicro ? 0.74 : 0.88) * o
    material.iridescence = (isMicro ? 0.55 : 0.72) * o
    material.opacity = 1
    material.visible = o > 0.02
  }
}

/* -------------------------------------------------------------------------- */
/* Exp03 Study 01 — layered optical glass (reference: pastel quartz cluster)  */
/* -------------------------------------------------------------------------- */
/*
 * Why layered instead of `transmission`:
 * the Exp05 membrane is a *transparent* ShaderMaterial, and three.js
 * transmission only refracts the opaque pass. Transmissive crystals therefore
 * could not "see" the pink membrane behind them and read as dark, flat plastic.
 *
 * Each crystal is drawn three times from one mesh (geometry groups):
 *   0. inner  — back faces, tinted, low alpha → internal facet lines / depth
 *   1. body   — front faces, pale tint (vertex gradient root→tip), alpha
 *               blended over the membrane, iridescent clearcoat, pastel env
 *   2. glint  — front faces, unlit additive mirror reflection of the
 *               high-contrast studio strips → hard white / cyan / pink streaks
 * All stock three.js materials (no onBeforeCompile).
 */

const EXP03_GLASS_SLOTS = [
  {
    /* pink quartz */
    tip: new THREE.Color('#f7b3d2'),
    inner: new THREE.Color('#e98fbd'),
    iridescenceRange: [260, 620],
  },
  {
    /* rose / blush */
    tip: new THREE.Color('#f5c2dc'),
    inner: new THREE.Color('#e7a3c8'),
    iridescenceRange: [200, 520],
  },
  {
    /* icy cyan */
    tip: new THREE.Color('#bfe9f5'),
    inner: new THREE.Color('#8ad3ea'),
    iridescenceRange: [120, 380],
  },
  {
    /* amethyst violet — the deeper "core" crystal */
    tip: new THREE.Color('#b796ee'),
    inner: new THREE.Color('#8f68dc'),
    iridescenceRange: [320, 700],
  },
  {
    /* pale lavender */
    tip: new THREE.Color('#d9c8f4'),
    inner: new THREE.Color('#bba3e8'),
    iridescenceRange: [220, 560],
  },
]

const GLASS_ROOT = new THREE.Color('#fbf8fc')

const EXP03_GLASS_ROLE = {
  primary: { bodyOpacity: 0.44, innerOpacity: 0.4, tintStrength: 1, glint: 0.32 },
  secondary: { bodyOpacity: 0.42, innerOpacity: 0.36, tintStrength: 0.92, glint: 0.3 },
  tertiary: { bodyOpacity: 0.4, innerOpacity: 0.32, tintStrength: 0.85, glint: 0.28 },
  micro: { bodyOpacity: 0.38, innerOpacity: 0.26, tintStrength: 0.7, glint: 0.26 },
}

function glassRole(role) {
  return EXP03_GLASS_ROLE[role] || EXP03_GLASS_ROLE.primary
}

function smooth01(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Adds a root→tip colour gradient (vertex colours) and the three render
 * groups used by createExp03CrystalLayeredMaterials. Mutates and returns
 * the geometry. Safe to call once per geometry.
 * @param {THREE.BufferGeometry} geometry unit crystal, +Y = growth axis
 */
export function prepareExp03CrystalGeometry(
  geometry,
  { tint = 0.2, role = 'primary' } = {},
) {
  if (!geometry?.attributes?.position) return geometry
  const slot = EXP03_GLASS_SLOTS[tintSlot(tint)]
  const strength = glassRole(role).tintStrength
  const position = geometry.attributes.position
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const minY = geometry.boundingBox.min.y
  const span = Math.max(1e-6, geometry.boundingBox.max.y - minY)

  const colors = new Float32Array(position.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < position.count; i += 1) {
    const t = (position.getY(i) - minY) / span
    /* Clear, slightly frosted root → saturated pastel tip. */
    const k = smooth01(0.05, 0.95, t) * strength + 0.18 * strength
    c.copy(GLASS_ROOT).lerp(slot.tip, Math.min(1, k))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const count = geometry.index ? geometry.index.count : position.count
  geometry.clearGroups()
  geometry.addGroup(0, count, 0)
  geometry.addGroup(0, count, 1)
  geometry.addGroup(0, count, 2)
  geometry.userData.exp03Layered = true
  return geometry
}

/**
 * @param {object} opts
 * @param {number} [opts.tint] 0..1 colour slot selector
 * @param {'primary'|'secondary'|'tertiary'|'micro'} [opts.role]
 * @param {THREE.Texture|null} [opts.glintEnvMap] studio strips as a CubeTexture (glint)
 * @param {THREE.Texture|null} [opts.bodyEnvMap] bright pastel room, PMREM (body / inner)
 * @returns {THREE.Material[]} [inner, body, glint]
 */
export function createExp03CrystalLayeredMaterials({
  tint = 0.2,
  role = 'primary',
  glintEnvMap = null,
  bodyEnvMap = null,
} = {}) {
  const slotIndex = tintSlot(tint)
  const slot = EXP03_GLASS_SLOTS[slotIndex]
  const cfg = glassRole(role)

  const inner = new THREE.MeshStandardMaterial({
    color: slot.inner.clone(),
    vertexColors: true,
    emissive: slot.inner.clone().multiplyScalar(0.22),
    roughness: 0.2,
    metalness: 0,
    envMap: bodyEnvMap || null,
    envMapIntensity: 0.9,
    transparent: true,
    opacity: cfg.innerOpacity,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
  })

  const body = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    vertexColors: true,
    emissive: slot.tip.clone().multiplyScalar(0.14),
    roughness: 0.035,
    metalness: 0,
    ior: 1.55,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: role === 'micro' ? 0.55 : 0.75,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [...slot.iridescenceRange],
    sheen: 0.35,
    sheenRoughness: 0.4,
    sheenColor: slot.tip.clone(),
    envMap: bodyEnvMap || null,
    envMapIntensity: 1.15,
    transparent: true,
    opacity: cfg.bodyOpacity,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  })

  /*
   * Unlit additive mirror: only the studio strips show up (no light-driven
   * white facets). Works with a plain CubeTexture (see
   * createCrystalStudioCubeEnvMap); PMREM textures are ignored by Basic.
   */
  const glint = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#000000'),
    envMap: glintEnvMap || null,
    combine: THREE.AddOperation,
    reflectivity: cfg.glint,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  })

  for (const m of [inner, body, glint]) {
    m.userData.exp03OpticalSlot = slotIndex
    m.userData.exp03Role = role
  }
  inner.userData.exp03Layer = 'inner'
  body.userData.exp03Layer = 'body'
  glint.userData.exp03Layer = 'glint'
  return [inner, body, glint]
}

/** Re-bind env maps on a layered material set (or a single material). */
export function bindExp03CrystalLayeredEnvMaps(
  materials,
  { glintEnvMap, bodyEnvMap } = {},
) {
  const list = Array.isArray(materials) ? materials : [materials]
  for (const m of list) {
    if (!m) continue
    const layer = m.userData?.exp03Layer
    if (!layer) continue
    const next = layer === 'glint' ? glintEnvMap : bodyEnvMap
    if (next === undefined) continue
    m.envMap = next || null
    m.needsUpdate = true
  }
}
