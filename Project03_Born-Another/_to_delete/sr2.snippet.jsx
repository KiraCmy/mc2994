function SurfaceReturn({ world = null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const gl = useThree((s) => s.gl)
  const rise = useRef(null)
  const shown = useRef(false)
  const hintRef = useRef(null)
  const startRef = useRef(() => {})
  const dir = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  /* A plain DOM hint beside the canvas (no extra React root to unmount). */
  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return undefined
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'exp07-ascend'
    btn.tabIndex = -1
    btn.setAttribute('aria-hidden', 'true')
    btn.innerHTML = '<span class="exp07-ascend__arrow" aria-hidden="true"></span>Back to the surface'
    btn.addEventListener('click', () => startRef.current())
    host.appendChild(btn)
    hintRef.current = btn
    return () => {
      btn.remove()
      hintRef.current = null
    }
  }, [gl])

  const setShown = (v) => {
    shown.current = v
    const el = hintRef.current
    if (!el) return
    el.classList.toggle('is-shown', v)
    el.tabIndex = v ? 0 : -1
    el.setAttribute('aria-hidden', v ? 'false' : 'true')
  }

  startRef.current = () => {
    if (rise.current) return
    const { hole } = UNDERWORLD
    const end = surfacePose()
    const below = new THREE.Vector3(hole.x, underworldFloor(hole.x, hole.z) + 2.2, hole.z)
    const above = new THREE.Vector3(hole.x, habitatSurfaceHeight(hole.x, hole.z) + 4.5, hole.z)
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setShown(false)
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
    const want = !busy && underground(camera.position) && dir.y > (shown.current ? LOOK_UP_OFF : LOOK_UP)
    if (want !== shown.current) setShown(want)
  })

  useEffect(() => () => {
    if (rise.current && controls) controls.enabled = true
  }, [controls])

  return null
}
