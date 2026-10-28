/**
 * Exp05 Study 01 — visualise neighbour competition.
 * One arc per (victim → drainer) pair: moisture visibly flows from the
 * starved cluster into the neighbour that is draining it. Width, opacity and
 * dash speed scale with the amount drained.
 */
import { useMemo, useRef } from 'react'
import { QuadraticBezierLine } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Pairs drained less than this are not drawn (avoid hairline clutter). */
const MIN_VISIBLE_DRAIN = 0.015

function FlowArc({ start, end, normal, amount }) {
  const ref = useRef(null)
  const { mid, length } = useMemo(() => {
    const a = new THREE.Vector3(...start)
    const b = new THREE.Vector3(...end)
    const n = new THREE.Vector3(...normal).normalize()
    const len = a.distanceTo(b)
    const m = a
      .clone()
      .add(b)
      .multiplyScalar(0.5)
      .addScaledVector(n, 0.12 + len * 0.35)
    return { mid: m.toArray(), length: len }
  }, [start, end, normal])

  const strength = Math.min(1, amount / 0.25)
  const speed = 0.25 + strength * 0.9

  useFrame((_, delta) => {
    const material = ref.current?.material
    if (!material) return
    /* Dashes travel start → end (victim → drainer). */
    material.dashOffset -= Math.min(0.1, delta) * speed
  })

  return (
    <QuadraticBezierLine
      ref={ref}
      start={start}
      end={end}
      mid={mid}
      segments={28}
      color="#8fdcff"
      lineWidth={1.2 + strength * 4.2}
      dashed
      dashSize={Math.max(0.03, length * 0.08)}
      gapSize={Math.max(0.025, length * 0.06)}
      transparent
      opacity={0.28 + strength * 0.62}
      depthWrite={false}
      toneMapped={false}
      renderOrder={6}
    />
  )
}

/**
 * @param {{
 *   seats: Map<string, { position: THREE.Vector3, normal: THREE.Vector3 }>,
 *   competitionState: Record<string, { sources: Record<string, number> }>,
 *   visible?: boolean,
 * }} props
 */
export default function CompetitionFlows({
  seats,
  seatVersion = 0,
  competitionState,
  visible = true,
}) {
  /*
   * Stable per-pair geometry (only rebuilt when seats move), so 12 Hz
   * competition updates change width / opacity without re-tessellating.
   */
  const pairGeometry = useMemo(() => {
    /** @type {Map<string, { start: number[], end: number[], normal: number[] }>} */
    const map = new Map()
    if (!seats) return map
    for (const [a, sa] of seats) {
      for (const [b, sb] of seats) {
        if (a === b || !sa?.position || !sb?.position) continue
        map.set(`${a}>${b}`, {
          start: sa.position.toArray(),
          end: sb.position.toArray(),
          normal: sa.normal.clone().add(sb.normal).normalize().toArray(),
        })
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats, seatVersion])

  const arcs = useMemo(() => {
    if (!visible || !competitionState) return []
    const out = []
    for (const [victimId, state] of Object.entries(competitionState)) {
      for (const [drainerId, amount] of Object.entries(state?.sources || {})) {
        if (!(amount >= MIN_VISIBLE_DRAIN)) continue
        const key = `${victimId}>${drainerId}`
        const geometry = pairGeometry.get(key)
        if (!geometry) continue
        out.push({
          key,
          ...geometry,
          /* Quantise so tiny per-tick changes do not re-render the line. */
          amount: Math.round(amount * 50) / 50,
        })
      }
    }
    return out
  }, [pairGeometry, competitionState, visible])

  return (
    <group name="exp05-competition-flows">
      {arcs.map((arc) => (
        <FlowArc
          key={arc.key}
          start={arc.start}
          end={arc.end}
          normal={arc.normal}
          amount={arc.amount}
        />
      ))}
    </group>
  )
}
