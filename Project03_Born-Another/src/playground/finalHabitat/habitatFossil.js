/**
 * Exp07 end of life: the body withers, crystallizes and coils into a husk
 * that follows the same construction rule as the Exp03 Spiral (a helical
 * radial field around an axis) carried one step further — a planispiral,
 * ribbed, keeled shell. Then the habitat fades and the husk is identified.
 *
 * Pure (no three.js / React).
 */

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}
export function smooth(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** AGE at which withering / final crystallization starts; at 1 the life ends.
 *  Early enough that the change can ease in, not snap on in the last moments. */
export const WITHER_START = 0.7

/** 0 → 1 as the body withers toward death. */
export function witherAmount(age) {
  return smooth(WITHER_START, 1, age)
}

/**
 * Phases after death (seconds since the life ended):
 *  coil   — the husk finishes coiling (0 → 1)
 *  sink   — it settles lower in the water
 *  dusk   — the rest of the habitat fades / darkens
 *  reveal — the identification card appears
 */
export function deathPhases(t) {
  if (!(t >= 0)) return { coil: 0, sink: 0, dusk: 0, reveal: 0 }
  return {
    coil: smooth(0, 3.2, t),
    sink: smooth(0.5, 6, t),
    dusk: smooth(1.5, 6.5, t),
    reveal: smooth(5.5, 7.5, t),
  }
}

/** Coil amount for the body: begins in the last days of life, completes after. */
export function coilAmount(age, t) {
  const before = smooth(0.9, 1, age) * 0.55
  if (!(t >= 0)) return before
  return 0.55 + 0.45 * deathPhases(t).coil
}

/**
 * Ammonite husk radius along a unit direction (local frame, coil axis = z).
 * Same contract as the morphology radius fields (direction → rest radius),
 * normalised so the mean radius is ≈ 1:
 *  - disc compressed along the coil axis (whorls side by side, like Exp03's
 *    helix wound flat),
 *  - logarithmic whorl growth around the axis with a step at the aperture,
 *  - umbilicus hollows on both faces, a seam where the last whorl overlaps,
 *  - radial ribs, strongest toward the venter (outer rim), and a soft keel.
 */
export function ammoniteRadius(x, y, z) {
  const len = Math.hypot(x, y, z) || 1
  const dx = x / len, dy = y / len, dz = z / len
  const rho = Math.sqrt(Math.max(0, 1 - dz * dz))
  const theta = Math.atan2(dy, dx)
  const s = (theta / (Math.PI * 2) + 0.5) % 1 /* 0..1 around the coil */
  /* Logarithmic growth: the outer whorl doubles in height over one turn, so
     the silhouette steps in at the aperture like a coiled horn. */
  const growth = Math.exp(0.69 * (s - 1))
  const flat = 0.4 + 0.12 * growth
  let r = 1 / Math.sqrt(rho * rho + (dz * dz) / (flat * flat))
  r *= 0.62 + 0.42 * growth
  const az = Math.abs(dz)
  r *= 1 - 0.32 * smooth(0.82, 0.99, az) /* umbilicus */
  /* Where the last whorl wraps the previous one: two spiral seams on the face. */
  const projected = r * rho
  const seam = (at, w) => Math.exp(-(((projected - at) / w) ** 2))
  const face = smooth(0.25, 0.75, az)
  r *= 1 - face * (0.11 * seam(0.52 * growth, 0.06) + 0.07 * seam(0.27 * growth, 0.045))
  /* Sinuous ribs across the flank (bending forward toward the venter), soft
     at the rim so the silhouette stays a smooth keeled spiral. */
  const flank = smooth(0.35, 0.75, rho) * (1 - smooth(0.94, 1, rho))
  const ribs = Math.sin(theta * 28 + projected * 7 - Math.sin(theta * 2) * 0.5)
  r *= 1 + 0.035 * ribs * flank + 0.025 * rho ** 10 /* ribs + keel */
  return r / 0.75
}

/**
 * Identification card content. Facts: Wikipedia "Ammonoidea" (origin in the
 * Emsian, Early Devonian, ~410–408 Ma; last species at the K–Pg boundary,
 * 66 Ma; acidification after the Chicxulub impact likely fatal to their small
 * planktonic hatchlings; nautiloids laid eggs on the sea floor and survived).
 */
/**
 * A real fossil photograph from Wikimedia Commons (freely licensed), loaded by
 * the viewer's browser through Special:FilePath at a modest width.
 */
export function commonsPhoto(file, caption, author, license, width = 1100) {
  const name = encodeURIComponent(file)
  return Object.freeze({
    src: `https://commons.wikimedia.org/wiki/Special:FilePath/${name}?width=${width}`,
    page: `https://commons.wikimedia.org/wiki/File:${name}`,
    caption,
    credit: `${author} · ${license} · Wikimedia Commons`,
  })
}

export const FOSSIL_AMMONITE = Object.freeze({
  id: 'ammonite',
  name: 'Ammonite',
  latin: 'Ammonoidea',
  epithet: '“Horn of Ammon”',
  appeared: 'Appeared ~409 million years ago · Early Devonian',
  vanished: 'Vanished 66 million years ago · end of the Cretaceous',
  span: 'Lived for about 343 million years',
  cause:
    'The Chicxulub impact likely acidified the upper ocean, where ammonite hatchlings drifted as plankton. Nautiloids, laying their eggs on the sea floor, survived.',
  facts: ['Over 10,000 species described', 'From 1 cm to about 2 m across', 'Mostly in the upper 250 m of open seas'],
  photo: commonsPhoto(
    'Dactylioceras_commune_Ammonite_Fossil_from_Yorkshire_England.jpg',
    'Dactylioceras commune, Lower Jurassic, Yorkshire',
    'James St. John',
    'CC BY 2.0',
  ),
  echo: 'Its shell grew as a logarithmic spiral of sealed chambers, the coiling rule this body followed as it crystallized.',
})

/** Flattened quilt — the Exp03 / Exp05 segmented oval. */
export const FOSSIL_DICKINSONIA = Object.freeze({
  id: 'dickinsonia',
  name: 'Dickinsonia',
  latin: 'Dickinsonia',
  epithet: '“the quilted oval”',
  appeared: 'Appeared ~567 million years ago · Ediacaran',
  vanished: 'Vanished ~550 million years ago · end of the Ediacaran',
  span: 'Lived for about 17 million years',
  cause:
    'It lived on microbial mats. At the opening of the Cambrian, burrowing animals broke those mats apart, and Dickinsonia disappeared with them.',
  facts: ['A flat oval, from millimetres to over a metre', 'A midline and dozens of rib-like modules', 'No mouth or gut has been found'],
  photo: commonsPhoto(
    'Dickinsonia_costata-Edicara_(Australia)-Muséum_Toulouse.png',
    'Dickinsonia costata, Ediacara, South Australia (Muséum de Toulouse)',
    'Ruthven',
    'CC0',
  ),
  echo: 'Its body was a flattened oval of repeated ribs — the quilt this form kept as it crystallized.',
})

/** Segmented shield — axial lobe and pleural segments. */
export const FOSSIL_TRILOBITE = Object.freeze({
  id: 'trilobite',
  name: 'Trilobite',
  latin: 'Trilobita',
  epithet: '“three lobes”',
  appeared: 'Appeared ~521 million years ago · Early Cambrian',
  vanished: 'Vanished ~252 million years ago · end of the Permian',
  span: 'Lived for about 270 million years',
  cause:
    'Already dwindling, the last trilobites died in the end-Permian extinction, when Siberian Traps volcanism warmed the seas and drained them of oxygen.',
  facts: ['More than 20,000 species described', 'A calcite shield of head, thorax and tail', 'Most lived on the sea floor and molted to grow'],
  photo: commonsPhoto(
    'ElrathiakingiUtahWheelerCambrian.jpg',
    'Elrathia kingii, Wheeler Shale, Cambrian, Utah',
    'Mark A. Wilson',
    'Public domain',
  ),
  echo: 'Its shield was a row of segments around a raised central lobe — the body this form kept as it hardened.',
})

export const FOSSILS = Object.freeze({
  ammonite: FOSSIL_AMMONITE,
  dickinsonia: FOSSIL_DICKINSONIA,
  trilobite: FOSSIL_TRILOBITE,
})

/** Living silhouette for each World Final body. Only the spiral coils into
 *  an ammonite; the others keep the form they grew. */
export const BODY_MORPH = Object.freeze({
  hero: 'spiral',
  o1: 'segmented',
  o2: 'trilobite',
})

/** Which remains a World Final body becomes when the viewer stays with it. */
export const BODY_FOSSIL = Object.freeze({
  hero: 'ammonite',
  o1: 'dickinsonia',
  o2: 'trilobite',
})

/** Remains by species (any life, any generation). */
export const FOSSIL_BY_SPECIES = Object.freeze({
  spiral: FOSSIL_AMMONITE,
  segmented: FOSSIL_DICKINSONIA,
  trilobite: FOSSIL_TRILOBITE,
})

export function fossilForSpecies(species) {
  return FOSSIL_BY_SPECIES[species] ?? FOSSIL_AMMONITE
}

export function fossilForBody(id) {
  return FOSSILS[BODY_FOSSIL[id]] ?? FOSSIL_AMMONITE
}
