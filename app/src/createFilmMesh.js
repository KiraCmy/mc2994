import * as THREE from 'three'

const ATTRACTORS = (() => {
  const directions = []
  const count = 14
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i
    directions.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).normalize())
  }
  return directions
})()

function createWebGeometry(subdivision) {
  const detail = Math.max(0, Math.min(5, Math.round(subdivision)))
  const geometry = new THREE.IcosahedronGeometry(1, detail)
  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i).normalize()

    let maxAlign = -1
    for (let d = 0; d < ATTRACTORS.length; d += 1) {
      maxAlign = Math.max(maxAlign, vertex.dot(ATTRACTORS[d]))
    }

    const peak = Math.pow(Math.max(0, maxAlign), 10)
    const radius = 0.82 + peak * 0.48
    vertex.multiplyScalar(radius)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

export function createFilmMesh(subdivision = 2) {
  const group = new THREE.Group()

  const filmMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8ccd4'),
    emissive: new THREE.Color('#1a1d24'),
    emissiveIntensity: 0.35,
    metalness: 0.05,
    roughness: 0.22,
    transmission: 0.68,
    thickness: 0.4,
    ior: 1.22,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  const webMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color('#e8a317'),
    transparent: true,
    opacity: 0.55,
  })

  let filmMesh = null
  let webLines = null
  let geometry = null
  let wireGeometry = null

  const rebuild = (level) => {
    if (filmMesh) {
      group.remove(filmMesh)
      filmMesh = null
    }
    if (webLines) {
      group.remove(webLines)
      webLines = null
    }
    if (geometry) {
      geometry.dispose()
      geometry = null
    }
    if (wireGeometry) {
      wireGeometry.dispose()
      wireGeometry = null
    }

    geometry = createWebGeometry(level)
    filmMesh = new THREE.Mesh(geometry, filmMaterial)
    filmMesh.renderOrder = 1
    group.add(filmMesh)

    wireGeometry = new THREE.WireframeGeometry(geometry)
    webLines = new THREE.LineSegments(wireGeometry, webMaterial)
    webLines.renderOrder = 2
    group.add(webLines)
  }

  rebuild(subdivision)

  return {
    mesh: group,
    setSubdivision(level) {
      rebuild(level)
    },
    dispose() {
      if (geometry) {
        geometry.dispose()
      }
      if (wireGeometry) {
        wireGeometry.dispose()
      }
      filmMaterial.dispose()
      webMaterial.dispose()
    },
  }
}
