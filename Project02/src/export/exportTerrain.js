import * as THREE from 'three'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { sampleHeight } from '../noise/generateNoiseMap.js'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** Build the same height-field geometry used by the 3D viewport. */
export function buildTerrainGeometry(noiseMap, displace, gridScale) {
  const res = Math.max(2, noiseMap?.resolution ?? 32)
  const geo = new THREE.PlaneGeometry(gridScale, gridScale, res - 1, res - 1)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const half = gridScale * 0.5

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const u = (x + half) / gridScale
    const v = (z + half) / gridScale
    pos.setY(i, sampleHeight(noiseMap, u, v, displace))
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

export function exportViewportPng(captureFn, filePrefix = 'viewport') {
  if (typeof captureFn !== 'function') return false
  const dataUrl = captureFn()
  if (!dataUrl) return false
  downloadDataUrl(dataUrl, `noise-lab-${filePrefix}-view-${stamp()}.png`)
  return true
}

export function exportHeightMap(noiseMap, filePrefix = 'heightmap') {
  if (!noiseMap) return false
  const res = noiseMap.resolution
  const canvas = document.createElement('canvas')
  canvas.width = res
  canvas.height = res
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const image = ctx.createImageData(res, res)
  const { data } = image
  const field = noiseMap.height ?? noiseMap.mag
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const g = Math.max(0, Math.min(255, Math.round(field[j * res + i] * 255)))
      const idx = ((res - 1 - j) * res + i) * 4
      data[idx] = g
      data[idx + 1] = g
      data[idx + 2] = g
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  downloadDataUrl(canvas.toDataURL('image/png'), `noise-lab-${filePrefix}-heightmap-${stamp()}.png`)
  return true
}

export function exportTerrainObj(noiseMap, displace, gridScale, filePrefix = 'mesh') {
  if (!noiseMap) return false
  const geometry = buildTerrainGeometry(noiseMap, displace, gridScale)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }))
  mesh.name = 'NoiseLabTerrain'
  const exporter = new OBJExporter()
  const text = exporter.parse(mesh)
  geometry.dispose()
  mesh.material.dispose()
  downloadBlob(new Blob([text], { type: 'text/plain' }), `noise-lab-${filePrefix}-mesh-${stamp()}.obj`)
  return true
}

export function exportTerrainGltf(noiseMap, displace, gridScale, filePrefix = 'mesh') {
  if (!noiseMap) return false
  const geometry = buildTerrainGeometry(noiseMap, displace, gridScale)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }))
  mesh.name = 'NoiseLabTerrain'
  const scene = new THREE.Scene()
  scene.add(mesh)

  return new Promise((resolve) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      scene,
      (result) => {
        geometry.dispose()
        mesh.material.dispose()
        if (result instanceof ArrayBuffer) {
          downloadBlob(
            new Blob([result], { type: 'model/gltf-binary' }),
            `noise-lab-${filePrefix}-mesh-${stamp()}.glb`,
          )
        } else {
          downloadBlob(
            new Blob([JSON.stringify(result)], { type: 'model/gltf+json' }),
            `noise-lab-${filePrefix}-mesh-${stamp()}.gltf`,
          )
        }
        resolve(true)
      },
      () => {
        geometry.dispose()
        mesh.material.dispose()
        resolve(false)
      },
      { binary: true },
    )
  })
}
