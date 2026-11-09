import SiteHud from '../SiteHud.jsx'
import { useAutoHideHeader } from '../useAutoHideHeader.js'
import Experiment07 from '../playground/Experiment07.jsx'
import '../playground/playground.css'

/**
 * World Final is the habitat: three lives in one water, named when they end.
 * The site header stays so the rest of the site is reachable.
 */
export default function WorldFinalPage({ header }) {
  const { hidden, scrolled, scrollerRef } = useAutoHideHeader()

  return (
    <div className="playground-page playground-page--exp05 playground-page--exp07">
      <SiteHud
        className="playground-page__hud"
        hidden={hidden}
        scrolled={scrolled}
      >
        {header}
      </SiteHud>

      <main className="playground-page__content" ref={scrollerRef}>
        <Experiment07
          title="World Final"
          description="Three lives share one water. Approach one, and when it ends, the remains are named."
          opening
        />
      </main>
    </div>
  )
}
