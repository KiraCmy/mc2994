import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase.js'
import { ensureUserProfile } from '../services/users.js'

export function useAuthUser() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (nextUser) => {
        console.info('[Firebase Auth] Auth state changed', {
          signedIn: Boolean(nextUser),
          uid: nextUser?.uid ?? null,
          email: nextUser?.email ?? null,
          displayName: nextUser?.displayName ?? null,
          providers: nextUser?.providerData.map((provider) => provider.providerId) ?? [],
        })
        if (nextUser) {
          ensureUserProfile(nextUser).catch((error) => {
            console.error('[Firestore] Failed to save user profile', {
              code: error.code,
              message: error.message,
            })
          })
        }
        setUser(nextUser)
        setAuthError('')
        setAuthReady(true)
      },
      (error) => {
        console.error('[Firebase Auth] Auth state observer failed', {
          code: error.code,
          message: error.message,
        })
        setAuthError(`${error.code ?? 'auth/unknown'}: ${error.message}`)
        setAuthReady(true)
      },
    )
  }, [])

  return { user, authReady, authError }
}
