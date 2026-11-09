import { memo, useMemo } from 'react'
import { buildPlate } from './ammonitePlate.js'

/*
 * A scientific plate of an ammonite, drawn procedurally (no photo licence
 * needed). Geometry lives in ammonitePlate.js.
 */
function Label({ from, to, text, anchor = 'start' }) {
  return (
    <g className="exp07-plate__label">
      <path d={`M${from[0].toFixed(1)} ${from[1].toFixed(1)}L${to[0]} ${to[1]}`} />
      <circle cx={from[0]} cy={from[1]} r="1.6" />
      <text x={to[0] + (anchor === 'start' ? 4 : -4)} y={to[1] + 3} textAnchor={anchor}>
        {text}
      </text>
    </g>
  )
}

function AmmonitePlate({ className = '' }) {
  const p = useMemo(buildPlate, [])
  return (
    <svg className={`exp07-plate ${className}`} viewBox="0 0 400 400" role="img" aria-label="Drawing of an ammonite shell, lateral view, with a section showing its chambers">
      <rect width="400" height="400" className="exp07-plate__ground" />
      <g className="exp07-plate__shell">
        <path d={p.outline} className="exp07-plate__outline" />
        <path d={p.seam} className="exp07-plate__seam" />
        {p.ribs.map((d, i) => (
          <path key={i} d={d} className="exp07-plate__rib" />
        ))}
        <path d={p.aperture} className="exp07-plate__outline" />
      </g>
      <g className="exp07-plate__section">
        <path d={p.secOutline} className="exp07-plate__seam" />
        {p.septa.map((d, i) => (
          <path key={i} d={d} className="exp07-plate__septum" />
        ))}
        <text x="326" y="392" textAnchor="middle">SECTION · CHAMBERS</text>
      </g>
      <Label from={p.umb} to={[28, 300]} text="UMBILICUS" />
      <Label from={p.venter} to={[372, 64]} text="VENTER" anchor="end" />
      <Label from={p.ribAt} to={[28, 48]} text="RIBS" />
      <Label from={p.ap} to={[372, 238]} text="APERTURE" anchor="end" />
      <g className="exp07-plate__scale">
        <path d="M58 374H138" />
        <path d="M58 370V378M98 371V377M138 370V378" />
        <text x="58" y="392">5 CM</text>
      </g>
      <text x="24" y="22" className="exp07-plate__title">PL. VII — AMMONOIDEA · LATERAL VIEW</text>
    </svg>
  )
}

export default memo(AmmonitePlate)
