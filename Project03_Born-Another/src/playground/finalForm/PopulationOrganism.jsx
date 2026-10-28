/**
 * Experiment 04 Population — one Exp05 organism (body + petals + particles)
 * rendered in its own local frame. The parent group owns world placement;
 * every layer reads THIS organism's AGE (useAgeClock = false) so bodies at
 * different life stages can share one canvas.
 */
import { memo, useMemo } from 'react'
import ExploreLifeScatter from './ExploreLifeScatter.jsx'
import ExploreWorldBody from './ExploreWorldBody.jsx'
import ExploreWorldParticles from './ExploreWorldParticles.jsx'
import { mapLifeToExploreVisual } from './exploreLifeAdapter.js'
import { EXP05_MATERIAL_MODES } from './exp05LabParams.js'
import { EXP05_ENV_TEMPERATURE_NEUTRAL } from './exp05EnvironmentCoupling.js'

function PopulationOrganism({
  life,
  morphologyType,
  lobeAmplitude = 1,
  sculpturalStrength = 0,
  /** 0..1 lab particle density for this body (level of detail). */
  particleDensity = 0.08,
  petalDensity,
  petalScale,
  particleMotion,
  materialMode = EXP05_MATERIAL_MODES.PEARLESCENT,
  /** Life-like localDeformations injected by neighbour contact (optional). */
  contactLife = null,
  /** Shared medium Temperature (Playground membrane expand / contract). */
  temperature = EXP05_ENV_TEMPERATURE_NEUTRAL,
}) {
  const visualLab = useMemo(
    () => ({ particleDensity, petalDensity, petalScale, particleMotion }),
    [particleDensity, petalDensity, petalScale, particleMotion],
  )
  const visual = useMemo(
    () => mapLifeToExploreVisual(life, visualLab),
    [life, visualLab],
  )
  /* Membrane / petals / particles all seat on the same (contact-deformed) life. */
  const seatLife = contactLife || life
  const { age, isDead, surface, individuality, development, particle, petalPlan } =
    visual
  const layersLive = !isDead && age < 0.995
  const showPetals = layersLive && (petalPlan?.petalCount ?? 0) > 0

  if (!life) return null

  return (
    <group>
      <ExploreWorldBody
        life={seatLife}
        surface={surface}
        individuality={individuality}
        development={development}
        isDead={isDead}
        bodyDepthWrite={!showPetals}
        morphStrength={1}
        deformationStrength={1}
        lobeAmplitude={lobeAmplitude}
        morphologyType={morphologyType}
        materialMode={materialMode}
        temperature={temperature}
        sculpturalStrength={sculpturalStrength}
        useAgeClock={false}
      />
      {layersLive ? (
        <ExploreLifeScatter
          life={seatLife}
          petalPlan={petalPlan}
          morphStrength={1}
          deformationStrength={1}
          lobeAmplitude={lobeAmplitude}
          morphologyType={morphologyType}
          temperature={temperature}
          sculpturalStrength={sculpturalStrength}
          surfaceSeed={individuality.seed}
          noiseScale={individuality.noiseScale}
          age={development.age}
          speed={development.speed}
          pulseSpeed={development.pulseSpeed}
          displacement={development.displacement}
          noiseAmount={development.noiseAmount}
          decayStart={0.8}
          decayScale={1.25}
          colorA={surface.colorA}
          colorB={surface.colorB}
          rimColor={surface.rimColor}
          useAgeClock={false}
        />
      ) : null}
      {layersLive ? (
        <ExploreWorldParticles
          life={seatLife}
          count={particle.count}
          seed={particle.seed}
          surfaceSeed={individuality.seed}
          morphStrength={1}
          deformationStrength={1}
          lobeAmplitude={lobeAmplitude}
          morphologyType={morphologyType}
          temperature={temperature}
          sculpturalStrength={sculpturalStrength}
          fieldThickness={particle.fieldThickness}
          pulseStrength={particle.pulseStrength}
          tintCool="#f4f7fb"
          tintWarm="#eef2f7"
          tintSoft="#ffffff"
        />
      ) : null}
    </group>
  )
}

export default memo(PopulationOrganism)
