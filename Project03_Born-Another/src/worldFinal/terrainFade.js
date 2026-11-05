/**
 * World Final — terrain fades into the page background by alpha.
 *
 * The canvas is transparent (same as every Exp04 scene), so the Exp04 CSS
 * gradient behind it is the atmosphere. Instead of mixing distant fragments
 * toward a fog color (which can never match a multi-stop CSS gradient), the
 * fog chunk is replaced so FogExp2 drives alpha, and the plane's outer band
 * fades radially so no square edge shows.
 */
import { WORLD_FINAL_EDGE_FADE } from './config.js'

const VERT_DECL = 'varying vec2 vTerrainXZ;'
const FRAG_DECL = 'varying vec2 vTerrainXZ;\nuniform vec2 uTerrainEdgeFade;'

const FADE_FRAGMENT = /* glsl */ `
float terrainVisibility = 1.0 - smoothstep(uTerrainEdgeFade.x, uTerrainEdgeFade.y, length(vTerrainXZ));
#if defined( USE_FOG ) && defined( FOG_EXP2 )
  terrainVisibility *= exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
#endif
gl_FragColor.a *= terrainVisibility;
`

/**
 * Returns an onBeforeCompile handler for MeshStandard / MeshBasic materials.
 * @param {{ value: import('three').Vector2 }} edgeUniform
 */
export function createTerrainFadeCompiler(edgeUniform) {
  return function terrainFadeCompile(shader) {
    shader.uniforms.uTerrainEdgeFade = edgeUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvTerrainXZ = (modelMatrix * vec4(transformed, 1.0)).xz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <fog_fragment>', FADE_FRAGMENT)
  }
}

export function edgeFadeRadii(basinRadius) {
  return [basinRadius * WORLD_FINAL_EDGE_FADE.start, basinRadius * WORLD_FINAL_EDGE_FADE.end]
}
