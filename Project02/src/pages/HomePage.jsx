import HomeField from '../components/HomeField.jsx'

export default function HomePage() {
  return (
    <div className="home" role="main" aria-label="Noise Lab homepage">
      <HomeField className="home-field" />

      <div className="home-overlay">
        <header className="home-top">
          <p className="home-kicker">INSTRUMENT / CURL NOISE</p>
          <h1 className="home-title">Noise Lab</h1>
          <p className="home-lede">
            A shared 2D field drives the map, the terrain, and the simulation.
          </p>
          <a className="home-enter" href="#/2d">
            ENTER
          </a>
        </header>
      </div>
    </div>
  )
}
