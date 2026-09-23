import { useEffect, useRef, useState } from 'react'
import { listNoiseConfigs, saveNoiseConfig } from '../services/noiseConfigs.js'

export default function NoiseConfigPanel({ user, state, onLoad }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [configs, setConfigs] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const refresh = async () => {
    if (!user) return
    setBusy(true)
    setMessage('')
    try {
      setConfigs(await listNoiseConfigs(user))
    } catch (error) {
      console.error('[Firestore] Failed to list Noise Lab configs', error)
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!user) return
    setBusy(true)
    setMessage('')
    try {
      await saveNoiseConfig(user, name, state)
      setName('')
      setConfigs(await listNoiseConfigs(user))
      setMessage('Configuration saved.')
    } catch (error) {
      console.error('[Firestore] Failed to save Noise Lab config', error)
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen && user) refresh()
  }

  return (
    <div ref={rootRef} className="config-panel">
      <button
        type="button"
        className="config-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        PRESETS
      </button>

      {open ? (
        <div className="config-popover" role="dialog" aria-label="Saved Noise Lab configurations">
          <p className="config-kicker">NOISE LAB PRESETS</p>

          {!user ? (
            <p className="config-message">Sign in to save and load configurations.</p>
          ) : (
            <>
              <label className="config-field">
                <span>NAME</span>
                <input
                  value={name}
                  placeholder="Untitled configuration"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              <button
                type="button"
                className="config-button is-primary"
                disabled={busy}
                onClick={save}
              >
                SAVE CURRENT
              </button>

              <div className="config-load-row">
                <select
                  defaultValue=""
                  disabled={busy || configs.length === 0}
                  onChange={(event) => {
                    const config = configs.find((item) => item.id === event.target.value)
                    if (config) {
                      onLoad(config)
                      setMessage(`Loaded “${config.name}”.`)
                      setOpen(false)
                    }
                  }}
                >
                  <option value="" disabled>
                    {configs.length ? 'Load a preset…' : 'No saved presets'}
                  </option>
                  {configs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="config-button"
                  disabled={busy}
                  onClick={refresh}
                >
                  REFRESH
                </button>
              </div>

              {message ? <p className="config-message" role="status">{message}</p> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
