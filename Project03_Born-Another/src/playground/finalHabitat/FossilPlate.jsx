import { memo, useMemo } from 'react'
import AmmonitePlate from './AmmonitePlate.jsx'

/** Dorsal plate of the quilted oval: a midline and ribs that meet it. */
function DickinsoniaPlate() {
  const ribs = useMemo(() => {
    const paths = []
    for (let i = -8; i <= 8; i += 1) {
      if (i === 0) continue
      const y = 198 + i * 13
      const reach = Math.sqrt(Math.max(0, 1 - ((y - 198) / 118) ** 2)) * 146
      const bow = Math.sign(i) * (8 + Math.abs(i) * 1.4)
      paths.push(`M${(200 - reach).toFixed(1)} ${y} Q200 ${(y + bow).toFixed(1)} ${(200 + reach).toFixed(1)} ${y}`)
    }
    return paths
  }, [])
  return (
    <svg className="exp07-plate" viewBox="0 0 400 400" role="img" aria-label="Drawing of Dickinsonia, dorsal view, an oval of ribs meeting a midline">
      <rect width="400" height="400" className="exp07-plate__ground" />
      <ellipse cx="200" cy="198" rx="150" ry="120" className="exp07-plate__outline" />
      {ribs.map((d) => (
        <path key={d} d={d} className="exp07-plate__rib" />
      ))}
      <path d="M200 82 V314" className="exp07-plate__seam" />
      <text x="24" y="22" className="exp07-plate__title">PL. — DICKINSONIA · DORSAL VIEW</text>
    </svg>
  )
}

/** Dorsal plate of a segmented trilobite: cephalon, axial lobe, pleural ribs. */
function TrilobitePlate() {
  const pleura = useMemo(() => {
    const paths = []
    for (let i = 0; i < 8; i += 1) {
      const y = 176 + i * 16
      const half = 96 - i * 6.5
      paths.push(`M${(200 - half).toFixed(1)} ${y} H172`)
      paths.push(`M228 ${y} H${(200 + half).toFixed(1)}`)
    }
    return paths
  }, [])
  return (
    <svg className="exp07-plate" viewBox="0 0 400 400" role="img" aria-label="Drawing of a trilobite, dorsal view, with an axial lobe and pleural segments">
      <rect width="400" height="400" className="exp07-plate__ground" />
      <path
        className="exp07-plate__outline"
        d="M200 86 C286 86 324 138 304 176 L292 292 C274 338 236 356 200 356 C164 356 126 338 108 292 L96 176 C76 138 114 86 200 86 Z"
      />
      <path className="exp07-plate__outline" d="M304 176 L334 214 L286 198" />
      <path className="exp07-plate__outline" d="M96 176 L66 214 L114 198" />
      <path className="exp07-plate__seam" d="M174 102 C166 188 166 286 182 342 L218 342 C234 286 234 188 226 102 Z" />
      {pleura.map((d) => (
        <path key={d} d={d} className="exp07-plate__rib" />
      ))}
      <text x="24" y="22" className="exp07-plate__title">PL. — TRILOBITA · DORSAL VIEW</text>
    </svg>
  )
}

function FossilPlate({ id }) {
  if (id === 'dickinsonia') return <DickinsoniaPlate />
  if (id === 'trilobite') return <TrilobitePlate />
  return <AmmonitePlate />
}

export default memo(FossilPlate)
