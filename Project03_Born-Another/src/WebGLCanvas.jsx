import { Component, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'

function probeWebGL() {
  if (typeof document === 'undefined') {
    return { ok: false, reason: 'No document' }
  }
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl', {
        failIfMajorPerformanceCaveat: false,
      })
    if (!gl) {
      return {
        ok: false,
        reason:
          'Chrome could not create a WebGL context (GPU may be disabled or crashed).',
      }
    }
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '')
      : ''
    if (/disabled/i.test(renderer)) {
      return {
        ok: false,
        reason:
          'WebGL reports GL_RENDERER = Disabled. Restart Chrome or re-enable hardware acceleration.',
      }
    }
    const lose = gl.getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return { ok: true, reason: '' }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function WebGLUnavailable({ reason, onRetry }) {
  return (
    <div
      className="webgl-fallback"
      role="alert"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        display: 'grid',
        placeContent: 'center',
        gap: '0.85rem',
        padding: '2rem',
        textAlign: 'center',
        color: '#e8eef2',
        background:
          'radial-gradient(ellipse at center, #1a2428 0%, #050708 70%)',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <strong style={{ fontSize: '1.05rem', letterSpacing: '0.04em' }}>
        3D view unavailable
      </strong>
      <p
        style={{
          maxWidth: '34rem',
          margin: 0,
          lineHeight: 1.45,
          opacity: 0.85,
          fontSize: '0.92rem',
        }}
      >
        {reason ||
          'WebGL failed to start. Concept and System still work; Studies and World need GPU access.'}
      </p>
      <ol
        style={{
          maxWidth: '34rem',
          margin: '0 auto',
          paddingLeft: '1.2rem',
          textAlign: 'left',
          lineHeight: 1.5,
          opacity: 0.8,
          fontSize: '0.86rem',
        }}
      >
        <li>Fully quit Chrome and reopen (not only this tab).</li>
        <li>
          Open <code>chrome://gpu</code> and confirm WebGL is not disabled.
        </li>
        <li>
          Settings → System → turn on “Use graphics acceleration when
          available”, then relaunch Chrome.
        </li>
      </ol>
      <button
        type="button"
        onClick={onRetry}
        style={{
          justifySelf: 'center',
          marginTop: '0.35rem',
          padding: '0.55rem 1.1rem',
          border: '1px solid rgba(232,238,242,0.35)',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontSize: '0.72rem',
        }}
      >
        Retry WebGL
      </button>
    </div>
  )
}

class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <WebGLUnavailable
          reason={error.message || String(error)}
          onRetry={() => {
            this.setState({ error: null })
            this.props.onRetry?.()
          }}
        />
      )
    }
    return this.props.children
  }
}

/**
 * Canvas wrapper that fails soft when Chrome has disabled WebGL
 * (common after a GPU process crash on Windows).
 */
export default function WebGLCanvas({ children, ...canvasProps }) {
  const [nonce, setNonce] = useState(0)
  const probe = useMemo(() => probeWebGL(), [nonce])

  if (!probe.ok) {
    return (
      <WebGLUnavailable
        reason={probe.reason}
        onRetry={() => setNonce((n) => n + 1)}
      />
    )
  }

  return (
    <CanvasErrorBoundary onRetry={() => setNonce((n) => n + 1)}>
      <Canvas
        key={nonce}
        {...canvasProps}
        gl={{
          antialias: true,
          failIfMajorPerformanceCaveat: false,
          powerPreference: 'default',
          ...(canvasProps.gl || {}),
        }}
      >
        {children}
      </Canvas>
    </CanvasErrorBoundary>
  )
}
