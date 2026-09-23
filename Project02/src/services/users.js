import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

export async function ensureUserProfile(user) {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      email: user.email,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  )
}
