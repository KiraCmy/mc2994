import { memo } from 'react'
import backdrop from './archive-backdrop.jpg'

/**
 * The archive's dark scene: the World Final world itself (a still of the
 * habitat with the page's text taken out), darkened and drawn toward the
 * archive's deep blue-violet, with a little mist and a vignette so the
 * collection reads on top. Decorative.
 */
function ArchiveBackdrop() {
  return (
    <div className="arc-backdrop" aria-hidden="true">
      <img className="arc-backdrop__image" src={backdrop} alt="" decoding="async" />
      <span className="arc-backdrop__mist" />
    </div>
  )
}

export default memo(ArchiveBackdrop)
