/**
 * World Final — owns the shared water current and advances it once per
 * frame (before any consumer reads it). Consumers call useWaterCurrent()
 * and read the mutable state inside their own useFrame; nothing here
 * triggers React renders.
 */
import { createContext, useContext, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { advanceCurrent, createCurrentField, createCurrentState } from './currentField.js'

const WaterCurrentContext = createContext(null)

/** Negative priority: runs before default (0) frame callbacks, never takes over rendering. */
const ADVANCE_PRIORITY = -1

export function WaterCurrent({ config, children }) {
  const current = useMemo(
    () => ({ field: createCurrentField(), state: createCurrentState() }),
    [],
  )

  useFrame((_, delta) => {
    advanceCurrent(current.state, delta, config)
  }, ADVANCE_PRIORITY)

  return <WaterCurrentContext.Provider value={current}>{children}</WaterCurrentContext.Provider>
}

export function useWaterCurrent() {
  const current = useContext(WaterCurrentContext)
  if (!current) throw new Error('useWaterCurrent must be used inside <WaterCurrent>')
  return current
}
