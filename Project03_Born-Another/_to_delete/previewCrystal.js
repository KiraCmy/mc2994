import * as THREE from 'three'
import { createEnvironmentScene } from '../src/playground/finalHabitat/habitatShaders.js'
import { createBodyCrystalMaterial, createBluntPrismGeometry, createBlockGeometry, createPlateCrystalGeometry, PRISM_HEIGHT } from '../src/playground/finalHabitat/crystalShapes.js'
export function prev() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 400
  const R = new THREE.WebGLRenderer({ canvas: c, antialias: true }); R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 0.82; R.outputColorSpace = THREE.SRGBColorSpace
  const errs = []; R.debug.onShaderError = (gl, prog, vs, fs) => errs.push((gl.getShaderInfoLog(fs) || '').slice(0, 600))
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#a7a0b6')
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(createEnvironmentScene(), 0.04).texture
  const skin = new THREE.Mesh(new THREE.SphereGeometry(6, 64, 32), new THREE.MeshPhysicalMaterial({ color: '#e9c4d4', roughness: 0.3, iridescence: 0.6 })); skin.position.y = -6; scene.add(skin)
  const geos = { prisms: createBluntPrismGeometry(), plates: createPlateCrystalGeometry(), blocks: createBlockGeometry() }
  let x = -3
  for (const habit of ['prisms', 'plates', 'blocks']) {
    const mat = createBodyCrystalMaterial(habit)
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(geos[habit], mat)
      const h = habit === 'blocks' ? 0.5 + k * 0.1 : 0.8 + k * 0.25
      const w = habit === 'prisms' ? 0.3 : habit === 'plates' ? 0.7 : 0.55
      m.scale.set(w, h / PRISM_HEIGHT, w)
      m.position.set(x + (k - 1.5) * 0.45, -0.1, (k % 2) * 0.3)
      m.rotation.set((k - 1.5) * 0.18, k * 0.9, (k % 2 - 0.5) * 0.3)
      scene.add(m)
    }
    x += 3
  }
  scene.add(new THREE.HemisphereLight('#e8e4ff', '#6d6680', 1.0)); const L = new THREE.DirectionalLight('#fff2e6', 2.0); L.position.set(-3, 5, 2); scene.add(L)
  const cam = new THREE.PerspectiveCamera(40, 900 / 400, 0.05, 100); cam.position.set(0, 1.6, 6.5); cam.lookAt(0, 0.4, 0)
  R.render(scene, cam)
  let img = document.getElementById('__emberPreview')
  if (!img) { img = document.createElement('img'); img.id = '__emberPreview'; img.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:400px;z-index:99999'; document.body.appendChild(img) }
  img.src = c.toDataURL(); R.dispose(); return errs.length ? errs : 'ok'
}
