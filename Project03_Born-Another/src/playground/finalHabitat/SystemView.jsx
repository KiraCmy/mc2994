import { useState } from 'react'

/**
 * System View for the habitat. DOM only: it does not own a canvas.
 * Anatomy draws on the life that is already selected. Live numbers are
 * read from refs the world already keeps.
 */
const ANATOMY = [
  {
    id: 'geometry',
    label: 'Geometry',
    note: 'Wireframe of this life’s membrane — the same mesh, not a copy.',
  },
  {
    id: 'deform',
    label: 'Deformation',
    note: 'Blue lines: direction × restRadius from this evaluation — the calibrated rest, before species morph and radial deformation. White lines: that same call’s position after radial deformation, then history marks.',
  },
]

function num(v, digits = 2) {
  return Number.isFinite(v) ? v.toFixed(digits) : '—'
}

function readFocus(focusId, life, worldRef, heroSpecies) {
  if (!focusId) return null
  if (focusId === 'hero') {
    return {
      id: 'hero',
      seed: life?.seed,
      age: life?.age,
      ended: Boolean(life?.dead),
      species: heroSpecies,
      level: null,
    }
  }
  const info = worldRef.current?.kinInfo.get(focusId)
  const body = worldRef.current?.bodies.get(focusId)
  if (!info && !body) return { id: focusId }
  return {
    id: focusId,
    seed: info?.seed,
    age: info?.age,
    ended: Boolean(info?.ended),
    species: body?.species,
    level: info?.level,
    stage: info?.stage,
  }
}

export default function SystemView({
  open,
  onToggle,
  anatomy,
  onAnatomy,
  focusId,
  life,
  heroSpecies,
  worldRef,
  envRef,
  crystalRef,
  probeRef,
  reply,
  langInfluence,
}) {
  /* The page already re-renders with the crystallization readout. Reading
     refs here rides that tick; this state only exists so the first open
     paints before the next readout. */
  const [, setTick] = useState(0)
  const focus = open ? readFocus(focusId, life, worldRef, heroSpecies) : null
  const env = envRef.current
  const crystal = crystalRef.current
  const probe = probeRef.current
  const level = focus?.id === 'hero' || !focus ? crystal?.level : focus.level
  const words = langInfluence
    ? Math.abs(langInfluence.temperature) + Math.abs(langInfluence.moisture) + Math.abs(langInfluence.turbulence) >= 0.01
    : false

  return (
    <>
      <button
        type="button"
        className={`exp07-system-toggle${open ? ' is-open' : ''}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        System
      </button>
      {open ? (
        <aside className="exp07-system" aria-label="System view">
          <section>
            <p className="exp07-system__label">Procedural anatomy</p>
            <p className="exp07-system__note">
              {focus ? `On ${focus.species ?? 'this life'} · ${focus.id}` : 'Select a life. Only that body is drawn.'}
            </p>
            <div className="exp07-system__modes" role="radiogroup" aria-label="Anatomy">
              {ANATOMY.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={anatomy === mode.id}
                  className={anatomy === mode.id ? 'is-on' : ''}
                  disabled={!focus}
                  onClick={() => onAnatomy(anatomy === mode.id ? null : mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="exp07-system__note">
              {ANATOMY.find((mode) => mode.id === anatomy)?.note
                ?? 'One view at a time. Off leaves the world as it is. Shader and growth views are not in this step.'}
            </p>
          </section>

          <section>
            <p className="exp07-system__label">Live debug</p>
            <dl className="exp07-system__rows">
              <Row k="Frame rate" v={probe ? `${num(probe.fps, 0)} fps` : '…'} tag="procedural" />
              <Row k="Draw calls" v={probe ? String(probe.calls) : '…'} tag="procedural" />
              <Row k="Triangles" v={probe ? String(probe.triangles) : '…'} tag="procedural" />
              <Row k="Seed" v={focus?.seed ?? '—'} tag="procedural" />
              <Row k="Species" v={focus?.species ?? '—'} tag="procedural" />
              <Row k="Age" v={num(focus?.age)} tag="procedural" />
              <Row k="Stage" v={focus?.stage ?? (focus?.ended ? 'ended' : '—')} tag="procedural" />
              <Row k="Crystal" v={num(level)} tag="procedural" />
              <Row k="Temperature" v={num(env?.temperature)} tag={words ? 'ai' : 'procedural'} />
              <Row k="Moisture" v={num(env?.moisture)} tag={words ? 'ai' : 'procedural'} />
              <Row k="Turbulence" v={num(env?.turbulence)} tag={words ? 'ai' : 'procedural'} />
              {reply?.text ? <Row k="Last words" v={reply.text} tag="ai" /> : null}
            </dl>
            <button type="button" className="exp07-system__refresh" onClick={() => setTick((n) => n + 1)}>
              Read now
            </button>
          </section>
        </aside>
      ) : null}
    </>
  )
}

function Row({ k, v, tag }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>
        <span>{v}</span>
        <em className={`is-${tag}`}>{tag}</em>
      </dd>
    </>
  )
}
