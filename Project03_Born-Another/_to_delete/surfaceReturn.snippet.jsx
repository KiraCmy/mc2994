
/* ---------------- way back up ---------------- */

const LOOK_UP = 0.3 // sin of the pitch at which "looking up" begins (~17°)
const LOOK_UP_OFF = 0.18 // hysteresis: hide again a little lower
const RISE_SECONDS = 3.2

/** Where you come out: on the sand at the rim, facing the clearing. */
function surfacePose() {
  const { hole } = UNDERWORLD
  const toward = Math.atan2(-hole.z, -hole.x)
  const x = hole.x + Math.cos(toward) * (hole.r + 7)
  const z = hole.z + Math.sin(toward) * (hole.r + 7)
  const tx = hole.x + Math.cos(toward) * (hole.r + 22)
  const tz = hole.z + Math.sin(toward) * (hole.r + 22)
  return {
    position: new THREE.Vector3(x, habitatSurfaceHeight(x, z) + 3.2, z),
    target: new THREE.Vector3(tx, habitatSurfaceHeight(tx, tz) + 2.4, tz),
  }
}

/** Below the sand, inside the cavern's reach. */
function underground(p) {
  return centreDistance(p.x, p.z) < UNDERWORLD.radius && p.y < habitatSurfaceHeight(p.x, p.z) - 0.8
}

/**
 * In the cavern, looking up: a small white hint at the top of the screen.
 * Clicking it carries the camera to the opening, up through it, and out
 * onto the sand at the rim, facing the clearing — no feeling around for
 * the hole in the dark.
 */
function SurfaceReturn({ world = null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const [show, setShow] = useState(false)
  const rise = useRef(null)
  const dir = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  const start = () => {
    if (rise.current) return
    const { hole } = UNDERWORLD
    const end = surfacePose()
    const below = new THREE.Vector3(hole.x, underworldFloor(hole.x, hole.z) + 2.2, hole.z)
    const above = new THREE.Vector3(hole.x, habitatSurfaceHeight(hole.x, hole.z) + 4.5, hole.z)
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setShow(false)
    if (reduce) {
      camera.position.copy(end.position)
      controls?.target?.copy(end.target)
      camera.lookAt(end.target)
      controls?.update?.()
      return
    }
    if (controls) controls.enabled = false
    rise.current = {
      t: 0,
      path: new THREE.CatmullRomCurve3([camera.position.clone(), below, above, end.position], false, 'centripetal'),
      from: (controls?.target ?? camera.position.clone().add(camera.getWorldDirection(dir))).clone(),
      end,
    }
  }

  useFrame((_, delta) => {
    const r = rise.current
    if (r) {
      r.t = Math.min(1, r.t + Math.min(0.05, delta) / RISE_SECONDS)
      const e = r.t * r.t * (3 - 2 * r.t)
      camera.position.copy(r.path.getPointAt(e))
      /* Look along the way (up the shaft), then settle onto the clearing. */
      look.copy(r.path.getPointAt(Math.min(1, e + 0.08)))
      const settle = THREE.MathUtils.smoothstep(e, 0.55, 1)
      look.lerp(r.end.target, settle)
      if (r.t < 0.15) look.lerp(r.from, 1 - r.t / 0.15)
      camera.lookAt(look)
      if (r.t >= 1) {
        controls?.target?.copy(r.end.target)
        camera.lookAt(r.end.target)
        if (controls) controls.enabled = true
        controls?.update?.()
        rise.current = null
      }
      return
    }
    const w = world?.current
    const busy = (w && (w.phase !== 'explore' || w.focusId)) || controls?.enabled === false
    camera.getWorldDirection(dir)
    const want = !busy && underground(camera.position) && dir.y > (show ? LOOK_UP_OFF : LOOK_UP)
    if (want !== show) setShow(want)
  })

  useEffect(() => () => {
    if (rise.current && controls) controls.enabled = true
  }, [controls])

  return (
    <Html fullscreen zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
      <button type="button" className={`exp07-ascend${show ? ' is-shown' : ''}`} onClick={start} tabIndex={show ? 0 : -1} aria-hidden={!show}>
        <span className="exp07-ascend__arrow" aria-hidden="true" />
        Back to the surface
      </button>
    </Html>
  )
}
