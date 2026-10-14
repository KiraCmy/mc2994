import { useEffect, useRef, useState } from 'react'

const TOP_THRESHOLD = 8
const DIRECTION_THRESHOLD = 16

/**
 * Slide the site header away on scroll-down and back on scroll-up.
 * At the top of the scroller the header stays visible. Deltas accumulate so
 * smooth / trackpad scrolls still count, while tiny reversals do not flicker.
 */
export function useAutoHideHeader() {
  const [node, setNode] = useState(null)
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const lastTopRef = useRef(0)
  const hiddenRef = useRef(false)
  const accumRef = useRef(0)

  useEffect(() => {
    if (!node) return undefined

    const applyHidden = (next) => {
      if (hiddenRef.current === next) return
      hiddenRef.current = next
      setHidden(next)
    }

    const onScroll = () => {
      const top = node.scrollTop
      const delta = top - lastTopRef.current
      lastTopRef.current = top

      if (top <= TOP_THRESHOLD) {
        accumRef.current = 0
        setScrolled(false)
        applyHidden(false)
        return
      }

      setScrolled(true)

      if ((accumRef.current > 0 && delta < 0) || (accumRef.current < 0 && delta > 0)) {
        accumRef.current = 0
      }
      accumRef.current += delta

      if (accumRef.current > DIRECTION_THRESHOLD) {
        applyHidden(true)
        accumRef.current = 0
      } else if (accumRef.current < -DIRECTION_THRESHOLD) {
        applyHidden(false)
        accumRef.current = 0
      }
    }

    lastTopRef.current = node.scrollTop
    onScroll()
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [node])

  return { hidden, scrolled, scrollerRef: setNode }
}
