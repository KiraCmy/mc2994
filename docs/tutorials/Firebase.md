# Firebase 101

A simple guide for people who have never used Firebase.

You should be comfortable with a bit of **JavaScript** and (ideally) a **React + Vite** app. You do not need a backend or database background. If a word is new, there is a glossary below.

---

## What is Firebase?

**Firebase** is a backend platform from Google. It gives your frontend app cloud services so you can ship without building your own server first:

- **Auth** — sign up / log in (email, Google, anonymous, …)
- **Firestore** — cloud database that syncs in real time
- **Storage** — upload images and files
- **Hosting** — put your built website on the internet
- **Cloud Functions** — small server code when you outgrow “frontend only”

This tutorial focuses on the pieces you will use most in a class project: **project setup → Auth → Firestore → rules → (optional) Hosting**.

---

## What problem does this solve?

A React app alone has **no memory across users** and **no shared data**. Refresh the tab and everything in `useState` is gone. Two classmates cannot see the same list unless you invent a server and a database.

Firebase is a ready-made backend:

| Without Firebase | With Firebase |
| --- | --- |
| You write a server + DB | Google hosts Auth + DB for you |
| You invent login yourself | Auth providers are built in |
| Refresh loses data | Data lives in the cloud |
| Hard to share state between users | Firestore syncs to clients |

Typical uses: shared boards, galleries, multiplayer-ish tools, saving user projects, simple apps that need accounts.

---

## Words you will see a lot

Read this once. Come back when a word feels fuzzy.

- **Project:** One Firebase “app home” in the console. Holds Auth, Firestore, Hosting, etc.
- **Firebase console:** Web dashboard at [https://console.firebase.google.com](https://console.firebase.google.com).
- **SDK:** The JavaScript library (`firebase`) your code imports.
- **Config object:** Keys (`apiKey`, `projectId`, …) that tell the SDK which project to talk to. Safe to put in frontend code; **security comes from rules**, not from hiding the config.
- **Auth:** Who is signed in (`user.uid`).
- **Firestore:** Document database. Data lives in **collections** → **documents** → **fields**.
- **Document:** One JSON-like record (e.g. one post, one save file).
- **Collection:** A folder of documents (e.g. `posts`, `users`).
- **Realtime listener:** Code that re-runs when cloud data changes (`onSnapshot`).
- **Security rules:** Server-side checks that decide who can read/write. Your real lock.
- **Emulator:** Local fake Firebase for testing without touching production data.

---

## 1. Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Add project** (or **Create a project**).
3. Name it (e.g. `noise-lab`). Disable Google Analytics if you do not need it.
4. Open the project when it finishes.

### Register a web app

1. On the project overview, click the **Web** icon (`</>`).
2. Nickname the app (e.g. `web`).
3. You can skip Firebase Hosting for now.
4. Copy the `firebaseConfig` object Firebase shows you. You will paste it into code.

It looks like this (values will be yours):

```js
const firebaseConfig = {
  apiKey: '…',
  authDomain: '….firebaseapp.com',
  projectId: '…',
  storageBucket: '….appspot.com',
  messagingSenderId: '…',
  appId: '…',
}
```

---

## 2. Add Firebase to a Vite + React app

In your project folder:

```bash
npm install firebase
```

Create a small module so you init Firebase once. Example: `src/firebase.js`

```js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: '…',
  authDomain: '….firebaseapp.com',
  projectId: '…',
  storageBucket: '….appspot.com',
  messagingSenderId: '…',
  appId: '…',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

Import `auth` and `db` anywhere you need them. Do **not** call `initializeApp` in every component.

**Tip:** For coursework, pasting config in `firebase.js` is fine. For public repos, prefer Vite env vars (`import.meta.env.VITE_FIREBASE_API_KEY`, etc.) so you can rotate keys without editing source — still protect data with **rules**.

---

## 3. Authentication (sign in)

### Turn Auth on in the console

1. Left sidebar → **Build** → **Authentication**.
2. **Get started**.
3. Open **Sign-in method**.
4. Enable at least one provider:
   - **Email/Password** — simple for class demos
   - **Google** — one-click login
   - **Anonymous** — guest users (good for prototypes)

### Email sign-up / sign-in in code

```js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from './firebase'

// Sign up
await createUserWithEmailAndPassword(auth, email, password)

// Sign in
await signInWithEmailAndPassword(auth, email, password)

// Sign out
await signOut(auth)

// Stay in sync with who is logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('signed in', user.uid, user.email)
  } else {
    console.log('signed out')
  }
})
```

In React, keep the current user in state:

```js
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

export function useAuthUser() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setReady(true)
    })
  }, [])

  return { user, ready }
}
```

`user.uid` is the stable id you will store on documents (“this post belongs to …”).

---

## 4. Firestore (save and load data)

### Create the database

1. Console → **Build** → **Firestore Database**.
2. **Create database**.
3. Start in **test mode** only for a short local demo (open read/write for a limited time). For anything shared or graded long-term, switch to **production mode** and write real rules (next section).
4. Pick a region close to you; you usually cannot change it later.

### Mental model

```text
Firestore
└── collection "posts"
    ├── doc "abc123"  { title, body, uid, createdAt }
    └── doc "def456"  { title, body, uid, createdAt }
```

Documents are dictionaries. Collections are lists of documents. Document ids can be auto-generated.

### Write a document

```js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase'

await addDoc(collection(db, 'posts'), {
  title: 'Hello',
  body: 'My first post',
  uid: auth.currentUser.uid,
  createdAt: serverTimestamp(),
})
```

### Read once

```js
import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

const snap = await getDocs(collection(db, 'posts'))
snap.forEach((doc) => {
  console.log(doc.id, doc.data())
})
```

### Listen in realtime (usual for UIs)

```js
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'

const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'))

const unsub = onSnapshot(q, (snap) => {
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  setPosts(posts) // React state
})

// later: unsub() in useEffect cleanup
```

### Update / delete

```js
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

await updateDoc(doc(db, 'posts', postId), { title: 'Updated' })
await deleteDoc(doc(db, 'posts', postId))
```

---

## 5. Security rules (do not skip)

The Firebase config in your frontend is **public**. Anyone can open DevTools and call the API. **Rules** are what stop strangers from wiping your database.

Console → Firestore → **Rules**. Example starter for “signed-in users can read everything; only the owner can write their posts”:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid;
      allow update, delete: if request.auth != null
                    && resource.data.uid == request.auth.uid;
    }
  }
}
```

Ideas to remember:

| Rule idea | Meaning |
| --- | --- |
| `request.auth != null` | Must be signed in |
| `request.auth.uid` | Current user id |
| `resource.data` | Existing document |
| `request.resource.data` | Incoming write payload |

**Test mode** (`allow read, write: if true`) is only for a quick sandbox. Lock it down before you share a link or push to a public repo.

---

## 6. Optional: Hosting (put the site online)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

- Public directory for Vite: `dist`
- Single-page app: **Yes** (rewrites to `index.html`)

Then:

```bash
npm run build
firebase deploy
```

Firebase prints a URL like `https://your-project.web.app`.

---

## 7. Minimal “save my thing” checklist

Use this as a lab path:

1. Create Firebase project + web app; copy config.
2. `npm install firebase`; create `src/firebase.js`.
3. Enable **Email/Password** (or Google) Auth.
4. Build a tiny login form; track user with `onAuthStateChanged`.
5. Create Firestore; add one collection (e.g. `projects`).
6. On Save: `addDoc` with `uid` + payload.
7. On load: `onSnapshot` query (optionally `where('uid', '==', user.uid)`).
8. Write **rules** so only owners can edit their docs.
9. (Optional) `npm run build` + Hosting deploy.

---

## Common mistakes

| Symptom | Likely cause |
| --- | --- |
| `Firebase: Error (auth/…)` | Wrong email/password, or provider not enabled in console |
| `Missing or insufficient permissions` | Firestore rules blocked the read/write |
| Data never updates in UI | Forgot `onSnapshot`, or forgot to `setState` |
| “Works for me, empty for classmate” | Different Firebase projects / configs |
| Huge bills scare | Unlikely on free Spark for tiny class apps; still avoid unbounded public write rules |
| Duplicate apps / weird Auth | Called `initializeApp` more than once |

---

## Free tier note

Firebase **Spark (free)** plan is enough for most coursework: Auth, Firestore, Hosting with quotas. Stay on Spark unless a teacher asks you to enable Blaze (billing). Watch for open rules that let bots spam writes.

---

## What to try next

1. Sign up + sign out in your React app; show the user’s email in the header.
2. Save a document on button click; list all docs with `onSnapshot`.
3. Scope the list to `where('uid', '==', user.uid)`.
4. Replace test-mode rules with owner-only write rules; confirm a second account cannot delete your docs.
5. Deploy with Hosting and open the link on your phone.

When those five work, you understand Firebase for class projects: **a cloud backend you configure in a console, call from the browser, and lock with rules**.
