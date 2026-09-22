import { useEffect, useState } from 'react'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase.js'

export function useAuthUser() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      setAuthError(error.message)
    })

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
    })
  }, [])

  return { user, authReady, authError }
}
