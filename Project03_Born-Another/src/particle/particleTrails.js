import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  particleTrailCopyFragmentShader,
  particleTrailCopyVertexShader,
} from '../surfaceShader.js'

/** Points per trail: the live head plus PARTICLE_TRAIL_SAMPLES - 1 history slots. */
export const PARTICLE_TRAIL_SAMPLES = 10
const TRAIL_SLOTS = PARTICLE_TRAIL_SAMPLES - 1

/**
 * Ring buffer of recent particle states, laid out side by side in one float
 * atlas (slot k occupies columns [k * size, (k + 1) * size)). Like the
 * simulation targets, it is created and disposed by the same effect.
 */
export function useParticleTrailHistory(gl, stateSize, rests, enabled = true) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!enabled) {
      ref.current = null
      return undefined
    }
    if (!gl.extensions.has('EXT_color_buffer_float')) return undefined
    const target = new THREE.WebGLRenderTarget(stateSize * TRAIL_SLOTS, stateSize, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    })
    const copyMaterial = new THREE.ShaderMaterial({
      vertexShader: particleTrailCopyVertexShader,
      fragmentShader: particleTrailCopyFragmentShader,
      uniforms: { uSource: { value: null } },
      depthTest: false,
      depthWrite: false,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMaterial)
    quad.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(quad)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    ref.current = {
      target,
      slots: TRAIL_SLOTS,
      head: 0,
      primed: false,
      sinceSnapshot: 0,
      /** Copies `source` into the next ring slot (or every slot when unprimed). */
      record(source) {
        const prevTarget = gl.getRenderTarget()
        const prevAutoClear = gl.autoClear
        gl.autoClear = false
        copyMaterial.uniforms.uSource.value = source
        const writeSlot = (slot) => {
          target.viewport.set(slot * stateSize, 0, stateSize, stateSize)
          target.scissor.set(slot * stateSize, 0, stateSize, stateSize)
          target.scissorTest = true
          gl.setRenderTarget(target)
          gl.render(scene, camera)
        }
        if (!this.primed) {
          for (let slot = 0; slot < TRAIL_SLOTS; slot += 1) writeSlot(slot)
          this.head = 0
          this.primed = true
        } else {
          this.head = (this.head + 1) % TRAIL_SLOTS
          writeSlot(this.head)
        }
        gl.setRenderTarget(prevTarget)
        gl.autoClear = prevAutoClear
      },
    }

    return () => {
      target.dispose()
      copyMaterial.dispose()
      quad.geometry.dispose()
      ref.current = null
    }
  }, [enabled, gl, stateSize, rests])

  return ref
}

/**
 * One ribbon per particle: PARTICLE_TRAIL_SAMPLES × 2 vertices (left / right),
 * instanced with the particle's state-texture lookup and field height.
 */
export function createTrailGeometry(count, stateSize, heights, variants) {
  const samples = PARTICLE_TRAIL_SAMPLES
  const geometry = new THREE.InstancedBufferGeometry()
  const vertexCount = samples * 2
  const sample = new Float32Array(vertexCount)
  const side = new Float32Array(vertexCount)
  for (let k = 0; k < samples; k += 1) {
    sample[k * 2] = k
    sample[k * 2 + 1] = k
    side[k * 2] = -1
    side[k * 2 + 1] = 1
  }
  const index = []
  for (let k = 0; k < samples - 1; k += 1) {
    const a = k * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  geometry.setIndex(index)
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3))
  geometry.setAttribute('aSample', new THREE.BufferAttribute(sample, 1))
  geometry.setAttribute('aSide', new THREE.BufferAttribute(side, 1))

  const stateUvs = new Float32Array(count * 2)
  for (let i = 0; i < count; i += 1) {
    stateUvs[i * 2] = ((i % stateSize) + 0.5) / stateSize
    stateUvs[i * 2 + 1] = (Math.floor(i / stateSize) + 0.5) / stateSize
  }
  geometry.setAttribute('aStateUv', new THREE.InstancedBufferAttribute(stateUvs, 2))
  geometry.setAttribute('aHeight', new THREE.InstancedBufferAttribute(heights.slice(), 1))
  geometry.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variants.slice(), 4))
  geometry.instanceCount = count
  return geometry
}
