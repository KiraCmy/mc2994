import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * World Final material upgrade, step 1 + 5:
 *  - an environment map made from the world's own water (not a studio HDR),
 *    on the lives' materials only:
 *    lilac fog above, the bright rippled surface overhead and to the upper
 *    right, the violet dunes below, a warm and a cool lobe so the thin film
 *    and clearcoat have something to catch. Lives reflect it: clearcoat gets
 *    streaks, iridescence moves with the angle, crystals get reflections.
 *  - AgX tone mapping (softer highlights, no grey wash), as on Concept.
 *
 * Switchable for comparison: Shift+M toggles it (remembered in this
 * browser), so the old look can be checked side by side.
 */

export const MATERIAL_KEY = 'born-another.material.v1'

export function materialUpgradeOn() {
  try {
    return window.localStorage.getItem(MATERIAL_KEY) !== 'classic'
  } catch {
    return true
  }
}

const envVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/* Values above 1 are light (the target is half-float). */
const envFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uFloor;
  uniform vec3 uSurface;
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform vec3 uSunDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.85, h));
    col = mix(col, uFloor, smoothstep(0.02, -0.45, h));
    /* The water surface: a broad bright patch overhead, brightest toward
       where the light falls from. */
    float sun = max(dot(d, uSunDir), 0.0);
    col += uSurface * (pow(sun, 6.0) * 1.6 + pow(sun, 40.0) * 3.0);
    col += uSurface * 0.35 * smoothstep(0.55, 0.95, h);
    /* Soft coloured lobes: give the film and clearcoat colour to pick up. */
    col += uWarm * pow(max(dot(d, normalize(vec3(-0.8, 0.15, 0.4))), 0.0), 3.0) * 0.55;
    col += uCool * pow(max(dot(d, normalize(vec3(0.7, 0.05, -0.6))), 0.0), 3.0) * 0.45;
    gl_FragColor = vec4(col, 1.0);
  }
`

/** The underwater environment as a PMREM texture (call .dispose() on the target). */
export function buildUnderwaterEnvironment(renderer) {
  const scene = new THREE.Scene()
  const geo = new THREE.SphereGeometry(10, 64, 32)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: envVertex,
    fragmentShader: envFragment,
    uniforms: {
      uTop: { value: new THREE.Color('#bdbacd') },
      uHorizon: { value: new THREE.Color('#8f8ca4') },
      uFloor: { value: new THREE.Color('#5a4e72') },
      uSurface: { value: new THREE.Color('#f6f2ff') },
      uWarm: { value: new THREE.Color('#f2b8cf') },
      uCool: { value: new THREE.Color('#a9d8e6') },
      uSunDir: { value: new THREE.Vector3(0.45, 0.85, 0.3).normalize() },
    },
  })
  scene.add(new THREE.Mesh(geo, mat))
  /* Two long soft strips of light: the streaks a wet, glossy skin shows. */
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 2.4), side: THREE.DoubleSide })
  const stripGeo = new THREE.PlaneGeometry(1.2, 7)
  const a = new THREE.Mesh(stripGeo, strip)
  a.position.set(5.5, 5, 2)
  a.lookAt(0, 0, 0)
  const b = new THREE.Mesh(stripGeo, strip)
  b.position.set(-6, 2.5, -3)
  b.lookAt(0, 0, 0)
  b.scale.set(0.6, 0.8, 1)
  scene.add(a, b)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(scene, 0.03)
  pmrem.dispose()
  geo.dispose()
  mat.dispose()
  stripGeo.dispose()
  strip.dispose()
  return target
}

/** Materials that reflect the water: lives (skin, petals, their crystals) and
 *  remains mark themselves with `userData.reflectsWater = true`. The terrain
 *  and the habitat's crystal fields are left as they are. */
function forEachLifeMaterial(scene, fn) {
  scene.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    for (const m of mats) if (m.userData?.reflectsWater) fn(m)
  })
}

function applyEnv(m, texture, strength) {
  if (m.userData.baseEnvIntensity === undefined) m.userData.baseEnvIntensity = m.envMapIntensity ?? 1
  if (m.envMap !== texture) {
    m.envMap = texture
    m.needsUpdate = true
  }
  m.envMapIntensity = texture ? m.userData.baseEnvIntensity * strength : m.userData.baseEnvIntensity
}

/**
 * Applies the upgrade while enabled (Shift+M switches): the water's
 * environment on the lives' materials only (new lives are picked up as they
 * appear), and AgX tone mapping; restores everything when switched off.
 */
export default function HabitatEnvironment({ intensity = 0.75, exposure = 1.04 }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const [enabled, setEnabled] = useState(materialUpgradeOn)

  /* Shift+M: new look ↔ classic, remembered in this browser. */
  useEffect(() => {
    const onKey = (e) => {
      if (!e.shiftKey || (e.key !== 'M' && e.key !== 'm')) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      setEnabled((on) => {
        const next = !on
        try {
          window.localStorage.setItem(MATERIAL_KEY, next ? 'upgraded' : 'classic')
        } catch {
          /* Storage unavailable: the switch still works for this visit. */
        }
        console.info(`[Born Another] material: ${next ? 'upgraded (environment + AgX)' : 'classic'}`)
        return next
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    const prev = { toneMapping: gl.toneMapping, exposure: gl.toneMappingExposure }
    const target = buildUnderwaterEnvironment(gl)
    const texture = target.texture
    gl.toneMapping = THREE.AgXToneMapping
    gl.toneMappingExposure = exposure
    const sweep = () => forEachLifeMaterial(scene, (m) => applyEnv(m, texture, intensity))
    sweep()
    /* Lives are born and replaced: catch their new materials. */
    const id = window.setInterval(sweep, 500)
    return () => {
      window.clearInterval(id)
      forEachLifeMaterial(scene, (m) => applyEnv(m, null, intensity))
      gl.toneMapping = prev.toneMapping
      gl.toneMappingExposure = prev.exposure
      target.dispose()
    }
  }, [enabled, intensity, exposure, gl, scene])

  return null
}
