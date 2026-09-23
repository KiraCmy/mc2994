import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase.js'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

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

  const signInWithGoogle = async () => {
    setPending(true)
    setMessage('')
    console.info('[Firebase Auth] Starting Google popup sign-in')

    try {
      const result = await signInWithPopup(auth, googleProvider)
      console.info('[Firebase Auth] Google sign-in succeeded', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        providers: result.user.providerData.map((provider) => provider.providerId),
      })
      setOpen(false)
    } catch (error) {
      console.error('[Firebase Auth] Google sign-in failed', {
        code: error.code,
        message: error.message,
        customData: error.customData,
      })
      setMessage(`${error.code ?? 'auth/unknown'}: ${error.message}`)
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
                onClick={signInWithGoogle}
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
