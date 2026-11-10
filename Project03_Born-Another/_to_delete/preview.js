import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as T from '../src/playground/finalHabitat/habitatTerrainBuild.js'
import * as F from '../src/playground/finalHabitat/habitatField.js'
import * as E from '../src/playground/finalHabitat/emberCrystals.js'
export function prev(idx, dist, hgt, az) {
  const c = document.createElement('canvas'); c.width = 800; c.height = 650
  const R = new THREE.WebGLRenderer({ canvas: c, antialias: true }); R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#b3aec4'); scene.fog = new THREE.FogExp2('#b3aec4', 0.015)
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
  const gmat = T.createGroundMaterial(); scene.add(new THREE.Mesh(T.buildGroundGeometry(), gmat))
  const res = E.createEmberResources(gmat); scene.add(res.crystals, res.mound, res.pools)
  const o = E.EMBER_DRUSES[idx]; const gy = F.habitatHeight(o.x, o.z) + o.scale * 0.2
  const cam = new THREE.PerspectiveCamera(42, 800 / 650, 0.05, 300)
  cam.position.set(o.x + Math.cos(az) * o.scale * dist, gy + o.scale * hgt, o.z + Math.sin(az) * o.scale * dist); cam.lookAt(o.x, gy + o.scale * 0.45, o.z)
  scene.add(new THREE.HemisphereLight('#e8e4ff', '#6d6680', 1.0)); const L = new THREE.DirectionalLight('#fff2e6', 2.2); L.position.set(o.x - 20, gy + 30, o.z - 15); scene.add(L)
  R.render(scene, cam)
  let img = document.getElementById('__emberPreview')
  if (!img) { img = document.createElement('img'); img.id = '__emberPreview'; img.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:650px;z-index:99999'; document.body.appendChild(img) }
  img.src = c.toDataURL(); R.dispose(); return 'ok'
}
