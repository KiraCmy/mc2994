import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase.js'

const googleProvider = new GoogleAuthProvider()

export default function AuthPanel({ user, authReady, authError }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  const run = async (action) => {
    setPending(true)
    setMessage('')
    try {
      await action()
      setOpen(false)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setPending(false)
    }
  }

  const accountLabel = user?.displayName || user?.email || 'ACCOUNT'

  return (
    <div className="auth-panel">
      <button
        type="button"
        className={`auth-trigger${user ? ' is-signed-in' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!authReady}
        onClick={() => setOpen((value) => !value)}
      >
        {authReady ? accountLabel : 'ACCOUNT…'}
      </button>

      {open ? (
        <div className="auth-popover" role="dialog" aria-label="Noise Lab account">
          <p className="auth-kicker">NOISE LAB ACCOUNT</p>

          {user ? (
            <>
              <p className="auth-user">{user.displayName || 'SIGNED IN'}</p>
              <p className="auth-meta">{user.email}</p>
              <button
                type="button"
                className="auth-button"
                disabled={pending}
                onClick={() => run(() => signOut(auth))}
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <>
              <label className="auth-field">
                <span>EMAIL</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="auth-field">
                <span>PASSWORD</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <div className="auth-email-actions">
                <button
                  type="button"
                  className="auth-button is-primary"
                  disabled={pending || !email || password.length < 6}
                  onClick={() =>
                    run(() => signInWithEmailAndPassword(auth, email, password))
                  }
                >
                  SIGN IN
                </button>
                <button
                  type="button"
                  className="auth-button"
                  disabled={pending || !email || password.length < 6}
                  onClick={() =>
                    run(() => createUserWithEmailAndPassword(auth, email, password))
                  }
                >
                  CREATE ACCOUNT
                </button>
              </div>

              <div className="auth-divider"><span>OR</span></div>

              <button
                type="button"
                className="auth-button auth-google"
                disabled={pending}
                onClick={() => run(() => signInWithRedirect(auth, googleProvider))}
              >
                CONTINUE WITH GOOGLE
              </button>
            </>
          )}

          {message || authError ? (
            <p className="auth-message" role="alert">{message || authError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
