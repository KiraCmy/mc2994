import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { patchMembrane, nucleusVertex, nucleusFragment, createEnvironmentScene } from '../src/playground/finalHabitat/habitatShaders.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createHistory, updateHistory, characterOf, bodyFactors } from '../src/playground/finalHabitat/unfoldForm.js'
export function prev({ ridgeMode = 0, bubbleScale = 3.2, bubble = 0, strata = 0, shrink = 0, side = 0, wave = 0.6, seed = 7, spoken = true, grow = 1, open = 0.7, fold = 0.08, swirl = 0.2, az = 0.3, el = 0.25, dist = 3.2, bg = '#b3aec4' } = {}) {
  const c = document.createElement('canvas'); c.width = 800; c.height = 650
  const R = new THREE.WebGLRenderer({ canvas: c, antialias: true }); R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace
  const errs = []; R.debug.onShaderError = (gl, prog, vs, fs) => errs.push((gl.getShaderInfoLog(vs) || '') + (gl.getShaderInfoLog(fs) || ''))
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg)
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(createEnvironmentScene(), 0.04).texture; R.toneMappingExposure = 0.78
  let g = new THREE.IcosahedronGeometry(1, 40); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g)
  const p = g.attributes.position.array
  const dirs = new Float32Array(p)
  const h = createHistory(seed)
  for (let t = 0; t < 120; t += 0.1) updateHistory(h, { dt: 0.1, env: spoken ? { temperature: t > 30 && t < 70 ? 0.85 : t > 90 ? 0.2 : 0.5, moisture: 0.5, turbulence: t > 50 && t < 60 ? 0.8 : 0 } : { temperature: 0.5, moisture: 0.5, turbulence: 0 }, viewer: [Math.sin(az), el, Math.cos(az)], near: spoken })
  const ch = characterOf(h, seed)
  const fac = bodyFactors(ch, dirs)
  for (let i = 0; i < p.length; i += 3) { const k = (1 + 0.18 * Math.sin(p[i] * 3 + 1) * Math.sin(p[i + 1] * 2.5) + 0.1 * Math.cos(p[i + 2] * 4)) * (1 + fac[i / 3]); p[i] *= k * 1.1; p[i + 1] *= k * 0.9; p[i + 2] *= k }
  g.computeVertexNormals()
  const n = g.attributes.position.count
  for (const [name, size] of [['aTent', 1], ['aFrost', 1], ['aFacetOffset', 3], ['aFacetNormal', 3], ['aCoilOffset', 3], ['aCoilNormal', 3]]) g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * size), size))
  const u = {
    uTime: { value: 3 }, uBreath: { value: 0.02 }, uBodyCentre: { value: new THREE.Vector3() }, uTent: { value: 0 }, uRime: { value: 0 }, uCore: { value: new THREE.Color('#ffd2c0') }, uCoreGlow: { value: 0.13 },
    uFilm: { value: 0.24 }, uFacet: { value: 0 }, uRim: { value: 0.32 }, uRimColor: { value: new THREE.Color('#e2f4ff') },
    uUnit: { value: 1 }, uFold: { value: fold }, uOpen: { value: open }, uOpenDir: { value: new THREE.Vector3(Math.sin(az), el, Math.cos(az)).normalize() },
    uFlow: { value: 1 }, uFlowTime: { value: 4 }, uBubble: { value: bubble }, uRidgeMode: { value: ridgeMode }, uBubbleScale: { value: bubbleScale }, uStrata: { value: strata }, uShrink: { value: shrink }, uSwirl: { value: swirl }, uInnerLight: { value: new THREE.Color('#ffa24a') },
  }
  const mat = new THREE.MeshPhysicalMaterial({ color: '#fbe9f0', roughness: 0.12, transmission: 0.5, thickness: 1.8, ior: 1.32, iridescence: 0.75, iridescenceIOR: 1.35, iridescenceThicknessRange: [100, 1000], attenuationColor: new THREE.Color('#f1aecd'), attenuationDistance: 0.9, specularIntensity: 0.7, clearcoat: 0.3, clearcoatRoughness: 0.12, sheen: 0.25, sheenColor: new THREE.Color('#ffd6ec'), envMapIntensity: 0.95 })
  patchMembrane(mat, u)
  const nu = { uTime: { value: 3 }, uLevel: { value: 0 }, uGold: { value: new THREE.Color('#ffd2ad') }, uPink: { value: new THREE.Color('#f5b3cf') }, uBlue: { value: new THREE.Color('#cfe0ff') }, uFrost: { value: new THREE.Color('#f4f1ff') }, uShell: { value: new THREE.Color('#ecdde8') }, uOpen: { value: open } }
  const nuc = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 8), new THREE.ShaderMaterial({ uniforms: nu, vertexShader: nucleusVertex, fragmentShader: nucleusFragment }))
  scene.add(nuc, new THREE.Mesh(g, mat))
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8d869f', roughness: 0.9 })); floor.position.y = -1.6; scene.add(floor)
  scene.add(new THREE.HemisphereLight('#e8e4ff', '#6d6680', 1.0)); const L = new THREE.DirectionalLight('#fff2e6', 2.0); L.position.set(-3, 5, -2); scene.add(L)
  const pl = new THREE.PointLight('#ffd2c0', 0.9 + 2.2 * open, 4.5, 1.6); scene.add(pl)
  const cam = new THREE.PerspectiveCamera(40, 800 / 650, 0.05, 100); const d = u.uOpenDir.value.clone(); if (side) d.applyAxisAngle(new THREE.Vector3(0, 1, 0), side); cam.position.copy(d).multiplyScalar(dist); cam.lookAt(0, 0, 0)
  R.render(scene, cam)
  let img = document.getElementById('__emberPreview')
  if (!img) { img = document.createElement('img'); img.id = '__emberPreview'; img.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:650px;z-index:99999'; document.body.appendChild(img) }
  img.src = c.toDataURL(); R.dispose(); return errs.length ? errs.map((e) => e.slice(0, 900)) : 'ok'
}
