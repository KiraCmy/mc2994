import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Single requestAnimationFrame loop for all simulation modes.
 * Start / Pause / Reset — only one rAF chain at a time.
 * Optional onTick(dtSeconds) runs each frame while running (e.g. evolve Evolve).
 */
export function useSimulationLoop(options = {}) {
  const { onTick } = options
  const [status, setStatus] = useState('idle') // idle | running | paused
  const [simTime, setSimTime] = useState(0)
  const [stepCount, setStepCount] = useState(0)

  const rafIdRef = useRef(null)
  const lastTimeRef = useRef(null)
  const statusRef = useRef('idle')
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  const cancelLoop = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  const tick = useCallback((now) => {
    if (statusRef.current !== 'running') return

    if (lastTimeRef.current == null) {
      lastTimeRef.current = now
    } else {
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      setSimTime((t) => t + dt)
      setStepCount((c) => c + 1)
      onTickRef.current?.(dt)
    }

    rafIdRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(() => {
    if (statusRef.current === 'running') return

    statusRef.current = 'running'
    setStatus('running')
    lastTimeRef.current = null
    cancelLoop()
    rafIdRef.current = requestAnimationFrame(tick)
  }, [cancelLoop, tick])

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return

    statusRef.current = 'paused'
    setStatus('paused')
    cancelLoop()
    lastTimeRef.current = null
  }, [cancelLoop])

  const reset = useCallback(() => {
    statusRef.current = 'idle'
    setStatus('idle')
    cancelLoop()
    lastTimeRef.current = null
    setSimTime(0)
    setStepCount(0)
  }, [cancelLoop])

  useEffect(() => () => cancelLoop(), [cancelLoop])

  return {
    status,
    simTime,
    stepCount,
    start,
    pause,
    reset,
    isRunning: status === 'running',
    isPaused: status === 'paused',
  }
}
