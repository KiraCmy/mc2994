/**
 * L-System mode — hierarchical veins on the organism membrane.
 * A long primary carries distributed secondaries, which carry tertiaries.
 */
export const INITIAL_LSYSTEM = {
  /** Hierarchy depth: 1 = primaries, 2 = +secondaries, 3+ = +terminals. */
  depth: 3,
  /** How far a child eventually curves away from its parent (degrees). */
  angle: 30,
  /** How far the primary vein travels across the membrane. */
  length: 0.85,
  /** Spacing of laterals along the primary (higher = sparser). */
  branchRotation: 40,
  /** Path wiggle (seeded). */
  randomness: 0.32,
  /** Half-width of the primary vein at its root. */
  baseThickness: 0.016,
  /** 0 = almost no taper, 1 = width falls to a point at the tip. */
  taperStrength: 0.4,
  /** Child root width relative to the parent width at the branch point. */
  childThicknessRatio: 0.55,
  /** Show branch knots + surface normals for alignment debug. */
  showDebug: false,
}

export const LSYSTEM_DEPTH_MIN = 1
export const LSYSTEM_DEPTH_MAX = 5
export const LSYSTEM_ANGLE_MIN = 5
export const LSYSTEM_ANGLE_MAX = 48
export const LSYSTEM_LENGTH_MIN = 0.15
export const LSYSTEM_LENGTH_MAX = 1.1
export const LSYSTEM_BRANCH_ROTATION_MIN = 0
export const LSYSTEM_BRANCH_ROTATION_MAX = 180
export const LSYSTEM_RANDOMNESS_MIN = 0
export const LSYSTEM_RANDOMNESS_MAX = 1
export const LSYSTEM_BASE_THICKNESS_MIN = 0.002
export const LSYSTEM_BASE_THICKNESS_MAX = 0.03
export const LSYSTEM_TAPER_MIN = 0
export const LSYSTEM_TAPER_MAX = 1
export const LSYSTEM_CHILD_RATIO_MIN = 0.12
export const LSYSTEM_CHILD_RATIO_MAX = 0.85

/** Kept for free-space turtle helpers / capture scripts. */
export const LSYSTEM_AXIOM = 'F'
export const LSYSTEM_RULES = {
  F: 'F[+F][-F]F',
}

/** Radial vein units spread over the surface (each = one hub + its primaries). */
export const LSYSTEM_ORIGIN_COUNT = 10
/** Primary veins radiating from each hub (seeded ±1). */
export const LSYSTEM_RAYS_PER_SITE = 6
/** Rest-arc gap at which a growing tip stops on reaching another branch. */
export const LSYSTEM_CONTACT_CLEARANCE = 0.022
/** Separation between hubs on the unit sphere. */
export const LSYSTEM_SEED_SEPARATION = 0.9
/** Maps Length slider → primary rest-sphere arc. */
export const LSYSTEM_SURFACE_LENGTH_SCALE = 0.88
/** Tiny lift along the body facet normal so veins sit on the membrane. */
export const LSYSTEM_SURFACE_OFFSET = 0.0035
/** Must equal the Specimen body sphereGeometry width/height segments. */
export const LSYSTEM_BODY_SEGMENTS = 128
/** Child length relative to parent (free-space turtle). */
export const LSYSTEM_LENGTH_SCALE = 0.62
/** Rest-arc micro-step while tracing filaments. */
export const LSYSTEM_MICRO_STEP = 0.016
/** Catmull-Rom tension before densify. */
export const LSYSTEM_CURVE_TENSION = 0.5
/** Subdivisions per rest segment when smoothing. */
export const LSYSTEM_CURVE_DIVISIONS = 2
/** Max rest-arc between ribbon samples (keeps ribbons on surface lumps). */
export const LSYSTEM_DISPLAY_REST_STEP = 0.012
/** Smallest drawn half-width; thinner veins fade instead of aliasing away. */
export const LSYSTEM_MIN_HALF_WIDTH = 0.0011
/** Growth-front delay per hierarchy level (fraction of max hub distance). */
export const LSYSTEM_GROWTH_LAG = 0.16
/** Vein color. */
export const LSYSTEM_VEIN_COLOR = '#f3f6fa'

export const LSYSTEM_ROOT_RADIUS = 0.058
export const LSYSTEM_RADIUS_SCALE = 0.68
export const LSYSTEM_SURFACE_RADIUS_SCALE = 0.38
