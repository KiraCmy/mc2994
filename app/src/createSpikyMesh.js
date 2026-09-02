import * as THREE from 'three'

const SPIKE_BASE = 0.48
const SPIKE_LENGTH = 0.95
const SPIKE_TIP = SPIKE_BASE + SPIKE_LENGTH

function fibonacciDirections(count) {
  const directions = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i
    directions.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).normalize())
  }

  return directions
}

function createFilmGeometry(directions) {
  const geometry = new THREE.IcosahedronGeometry(1, 4)
  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i).normalize()

    let maxAlign = -1
    for (let d = 0; d < directions.length; d += 1) {
      maxAlign = Math.max(maxAlign, vertex.dot(directions[d]))
    }

    // Rise toward each spike tip and sag between them like a stretched film.
    const peak = Math.pow(Math.max(0, maxAlign), 10)
    const radius = 0.82 + peak * (SPIKE_TIP * 0.92 - 0.82)
    vertex.multiplyScalar(radius)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

export function createSpikyMesh(spikeCount = 12) {
  const group = new THREE.Group()

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(0.55, 0.85, 0.62),
    emissive: new THREE.Color().setHSL(0.55, 0.9, 0.28),
    emissiveIntensity: 0.55,
    metalness: 0.12,
    roughness: 0.32,
    clearcoat: 0.55,
    clearcoatRoughness: 0.3,
  })

  const filmMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(0.55, 0.65, 0.72),
    emissive: new THREE.Color().setHSL(0.55, 0.5, 0.2),
    emissiveIntensity: 0.2,
    metalness: 0,
    roughness: 0.18,
    transmission: 0.72,
    thickness: 0.45,
    ior: 1.25,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  const coreGeometry = new THREE.IcosahedronGeometry(0.55, 1)
  const core = new THREE.Mesh(coreGeometry, material)
  core.castShadow = true
  group.add(core)

  const spikeMeshes = []
  let activeSpikeGeometry = null
  let filmMesh = null
  let filmGeometry = null

  const rebuildSpikes = (count) => {
    while (spikeMeshes.length > 0) {
      const spike = spikeMeshes.pop()
      group.remove(spike)
    }
    if (activeSpikeGeometry) {
      activeSpikeGeometry.dispose()
      activeSpikeGeometry = null
    }
    if (filmMesh) {
      group.remove(filmMesh)
      filmMesh = null
    }
    if (filmGeometry) {
      filmGeometry.dispose()
      filmGeometry = null
    }

    const safeCount = Math.max(3, Math.min(64, Math.round(count)))
    activeSpikeGeometry = new THREE.ConeGeometry(0.16, SPIKE_LENGTH, 7)
    activeSpikeGeometry.translate(0, SPIKE_LENGTH / 2, 0)

    const up = new THREE.Vector3(0, 1, 0)
    const directions = fibonacciDirections(safeCount)

    directions.forEach((direction) => {
      const spike = new THREE.Mesh(activeSpikeGeometry, material)
      spike.castShadow = true
      spike.quaternion.setFromUnitVectors(up, direction)
      spike.position.copy(direction).multiplyScalar(SPIKE_BASE)
      group.add(spike)
      spikeMeshes.push(spike)
    })

    filmGeometry = createFilmGeometry(directions)
    filmMesh = new THREE.Mesh(filmGeometry, filmMaterial)
    filmMesh.renderOrder = 1
    group.add(filmMesh)
  }

  rebuildSpikes(spikeCount)

  return {
    mesh: group,
    material,
    setSpikeCount(count) {
      rebuildSpikes(count)
    },
    setHue(hue) {
      material.color.setHSL(hue / 360, 0.85, 0.62)
      material.emissive.setHSL(hue / 360, 0.9, 0.28)
      filmMaterial.color.setHSL(hue / 360, 0.55, 0.74)
      filmMaterial.emissive.setHSL(hue / 360, 0.45, 0.22)
    },
    dispose() {
      coreGeometry.dispose()
      if (activeSpikeGeometry) {
        activeSpikeGeometry.dispose()
      }
      if (filmGeometry) {
        filmGeometry.dispose()
      }
      material.dispose()
      filmMaterial.dispose()
    },
  }
}
