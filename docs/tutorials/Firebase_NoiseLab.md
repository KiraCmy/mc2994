# Firebase for Noise Lab (Project 2)

This tutorial adds Firebase to the existing `Project02` app without redesigning it.

You will add:

- Email/password Authentication
- A Firestore user profile linked to each login
- Save/load for Noise Lab configurations
- Storage for exported PNG, OBJ, GLTF, or GLB files
- Owner-only security rules
- Firebase Hosting

Work from:

```powershell
cd E:\2026Fall_Cornell\DESIGN4197_PWB\mc2994\Project02
```

---

## Current Project 2 data model

`src/App.jsx` currently owns the settings that should be saved:

```js
{
  scale: 3.2,
  octaves: 3,
  strength: 1.2,
  time: 0.4,
  resolution: 96,
  noiseType: 'simplex',
  shapeOp: 'none',
  shapeAmount: 0,
  displace: 0.85,
  gridScale: 3.2,
  windStrength: 1,
  evolutionSpeed: 0.35,
  vectorDensity: 24,
  particleCount: 500,
  particleSpeed: 1,
  particleSize: 1.6,
  trailLength: 0.65,
  rainAmount: 160,
  erosionRate: 1.55,
}
```

Also save `simulationMode` (`wind`, `particle`, or `erosion`) and `simView` (`2d` or `3d`).

Do **not** save `_noiseMap`, typed arrays, particles, raindrops, or erosion runtime state. They are generated again from the settings.

Recommended cloud structure:

```text
Firestore
└── users/{uid}
    └── configs/{configId}

Storage
└── users/{uid}/exports/{filename}
```

---

## Step 0 — Confirm the existing app works

### Firebase Console

Nothing yet.

### Project files

Do not change anything.

### Commands

```powershell
npm install
npm run dev
```

### Test

Open the Vite URL, visit `#/2d`, `#/3d`, and `#/sim`, and change a few controls. Then run:

```powershell
npm run build
```

Continue only if the current app builds.

---

## Step 1 — Create and connect a Firebase project

### 1. Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Create a project, such as `noise-lab-project2`.
3. On **Project overview**, click the Web icon (`</>`).
4. Register a web app named `Noise Lab Web`.
5. Copy the displayed Firebase configuration.

### 2. Project files

Create:

```text
Project02/
├── .env.local
└── src/
    └── firebase.js
```

`*.local` is already ignored by this project's `.gitignore`.

### 3. Commands and code

```powershell
npm install firebase
```

Put your Console values in `.env.local`:

```dotenv
VITE_FIREBASE_API_KEY=your-value
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-value
VITE_FIREBASE_APP_ID=your-value
```

Create `src/firebase.js`:

```js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

Restart Vite after creating `.env.local`.

### 4. Test

Temporarily import `auth` in the browser console is inconvenient, so use the build as the connection smoke test:

```powershell
npm run build
```

The build should finish with no missing Firebase configuration or import errors.

> Firebase web configuration is not a server password. Security comes from Auth and Rules. Never put Admin SDK credentials in a Vite app.

---

## Step 2 — Add email/password Authentication

### 1. Firebase Console

1. Open **Securoty → Authentication**.
2. Click **Get started**.
3. Open **Sign-in method**.
4. Enable **Email/Password**.

### 2. Project files

Create:

```text
src/hooks/useAuthUser.js
src/components/AuthPanel.jsx
```

Modify:

```text
src/App.jsx
```

### 3. Code

Create `src/hooks/useAuthUser.js`:

```js
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase.js'

export function useAuthUser() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
    })
  }, [])

  return { user, authReady }
}
```

Create `src/components/AuthPanel.jsx`:

```jsx
import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase.js'

export default function AuthPanel({ user, authReady }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const run = async (action) => {
    try {
      setMessage('')
      await action(auth, email, password)
    } catch (error) {
      setMessage(error.message)
    }
  }

  if (!authReady) return <p>Checking login…</p>

  if (user) {
    return (
      <div>
        <span>{user.email}</span>
        <button type="button" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        type="password"
        placeholder="Password (6+ characters)"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="button" onClick={() => run(createUserWithEmailAndPassword)}>
        Create account
      </button>
      <button type="button" onClick={() => run(signInWithEmailAndPassword)}>
        Sign in
      </button>
      {message ? <p>{message}</p> : null}
    </div>
  )
}
```

In `src/App.jsx`, add imports:

```js
import AuthPanel from './components/AuthPanel.jsx'
import { useAuthUser } from './hooks/useAuthUser.js'
```

Inside `App()`, near the other state declarations:

```js
const { user, authReady } = useAuthUser()
```

In the non-home layout, place this directly after `</header>` and before `<div className="app-main">`:

```jsx
<section aria-label="Firebase account">
  <AuthPanel user={user} authReady={authReady} />
</section>
```

No CSS is required yet.

### 4. Test

1. Open `#/2d`.
2. Create an account with a test email and a password of at least six characters.
3. Confirm the email appears in the app.
4. In Firebase Console → **Authentication → Users**, confirm the new user exists.
5. Sign out and sign back in.

---

## Step 3 — Create Firestore and link user data to login

### 1. Firebase Console

1. Open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Production mode**.
4. Select a nearby region. This location is difficult to change later.

### 2. Project files

Create:

```text
src/services/users.js
firestore.rules
```

Modify:

```text
src/hooks/useAuthUser.js
firebase.json
```

If `firebase.json` does not exist yet, create it with the code below.

### 3. Code

Create `src/services/users.js`:

```js
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

export async function ensureUserProfile(user) {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      email: user.email,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  )
}
```

Update the auth callback in `useAuthUser.js`:

```js
import { ensureUserProfile } from '../services/users.js'

// Inside onAuthStateChanged:
if (nextUser) {
  ensureUserProfile(nextUser).catch(console.error)
}
setUser(nextUser)
setAuthReady(true)
```

Create `firestore.rules`:

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow create: if request.auth != null
                    && request.auth.uid == userId;
      allow read, update, delete: if request.auth != null
                    && request.auth.uid == userId;

      match /configs/{configId} {
        allow read, delete: if request.auth != null
                            && request.auth.uid == userId;
        allow create, update: if request.auth != null
                              && request.auth.uid == userId
                              && request.resource.data.ownerId == request.auth.uid;
      }
    }
  }
}
```

Create or extend `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

Install the Firebase CLI and connect this local folder:

```powershell
npm install --save-dev firebase-tools
npx firebase login
npx firebase init firestore
```

When asked:

- Choose the existing Noise Lab Firebase project.
- Use `firestore.rules`.
- Keep the generated index filename.
- Do not overwrite the rules above.

Deploy rules:

```powershell
npx firebase deploy --only firestore:rules
```

### 4. Test

1. Sign out and sign in again.
2. Open Firebase Console → **Firestore Database → Data**.
3. Confirm `users/{your-uid}` exists and contains the login email.
4. Sign out. The app should no longer create or update that document.

---

## Step 4 — Save and load Noise Lab configurations

### 1. Firebase Console

No new service is required. Keep Firestore open so you can inspect saved documents.

### 2. Project files

Create:

```text
src/services/noiseConfigs.js
src/components/NoiseConfigPanel.jsx
```

Modify:

```text
src/App.jsx
```

### 3. Code

Create `src/services/noiseConfigs.js`:

```js
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'

const PARAM_KEYS = [
  'scale',
  'octaves',
  'strength',
  'time',
  'resolution',
  'noiseType',
  'shapeOp',
  'shapeAmount',
  'displace',
  'gridScale',
  'windStrength',
  'evolutionSpeed',
  'vectorDensity',
  'particleCount',
  'particleSpeed',
  'particleSize',
  'trailLength',
  'rainAmount',
  'erosionRate',
]

function serializableParams(params) {
  return Object.fromEntries(PARAM_KEYS.map((key) => [key, params[key]]))
}

export async function saveNoiseConfig(user, name, state) {
  return addDoc(collection(db, 'users', user.uid, 'configs'), {
    ownerId: user.uid,
    name: name.trim() || 'Untitled configuration',
    schemaVersion: 1,
    params: serializableParams(state.params),
    simulationMode: state.simulationMode,
    simView: state.simView,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function listNoiseConfigs(user) {
  const q = query(
    collection(db, 'users', user.uid, 'configs'),
    orderBy('updatedAt', 'desc'),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}
```

Create `src/components/NoiseConfigPanel.jsx`:

```jsx
import { useState } from 'react'
import { listNoiseConfigs, saveNoiseConfig } from '../services/noiseConfigs.js'

export default function NoiseConfigPanel({ user, state, onLoad }) {
  const [name, setName] = useState('')
  const [configs, setConfigs] = useState([])
  const [message, setMessage] = useState('')

  if (!user) return <p>Sign in to save configurations.</p>

  const refresh = async () => {
    try {
      setConfigs(await listNoiseConfigs(user))
      setMessage('')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const save = async () => {
    try {
      await saveNoiseConfig(user, name, state)
      setName('')
      setMessage('Saved.')
      await refresh()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <div>
      <input
        value={name}
        placeholder="Configuration name"
        onChange={(event) => setName(event.target.value)}
      />
      <button type="button" onClick={save}>Save current config</button>
      <button type="button" onClick={refresh}>Refresh saved configs</button>
      <select defaultValue="" onChange={(event) => {
        const config = configs.find((item) => item.id === event.target.value)
        if (config) onLoad(config)
      }}>
        <option value="" disabled>Load a configuration…</option>
        {configs.map((config) => (
          <option key={config.id} value={config.id}>{config.name}</option>
        ))}
      </select>
      {message ? <p>{message}</p> : null}
    </div>
  )
}
```

In `src/App.jsx`, import:

```js
import NoiseConfigPanel from './components/NoiseConfigPanel.jsx'
```

After `handleModeChange`, add:

```js
const handleLoadConfig = useCallback(
  (config) => {
    stopAndResetSimulation()
    setParams((current) => ({ ...current, ...config.params }))
    setSimulationMode(config.simulationMode ?? DEFAULT_SIMULATION_MODE)
    setSimView(config.simView ?? '2d')
  },
  [stopAndResetSimulation],
)
```

Place this beside `AuthPanel`:

```jsx
<NoiseConfigPanel
  user={user}
  state={{ params, simulationMode, simView }}
  onLoad={handleLoadConfig}
/>
```

### 4. Test

1. Sign in.
2. Set `scale`, `octaves`, `noiseType`, `shapeOp`, and simulation controls to recognizable values.
3. Save as `Test config`.
4. In Firestore, confirm:

```text
users/{your-uid}/configs/{config-id}
```

5. Change the controls.
6. Click **Refresh saved configs**, then load `Test config`.
7. Confirm the controls and generated Noise Lab view return to the saved values.
8. Sign in as a second user and confirm the first user's config does not appear.

---

## Step 5 — Upload exported files to Firebase Storage

Project02 currently downloads PNG/OBJ/GLTF/GLB files in `src/export/exportTerrain.js`. To avoid refactoring that export pipeline, this first integration lets the user select one of those downloaded files and upload it.

### 1. Firebase Console

1. Open **Build → Storage**.
2. Click **Get started** and create the default bucket.
3. Choose a bucket region carefully.

As of 2026, Cloud Storage for Firebase requires the **Blaze pay-as-you-go plan**. Set a small budget alert before enabling it. Eligible usage in some US regions can still fall within Google Cloud's Always Free allowance, but billing must be enabled.

### 2. Project files

Create:

```text
src/services/userFiles.js
src/components/StoragePanel.jsx
storage.rules
```

Modify:

```text
src/App.jsx
firebase.json
```

### 3. Code

Create `src/services/userFiles.js`:

```js
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase.js'

export async function uploadUserExport(user, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `users/${user.uid}/exports/${Date.now()}-${safeName}`
  const snapshot = await uploadBytes(ref(storage, path), file, {
    contentType: file.type || 'application/octet-stream',
  })

  return getDownloadURL(snapshot.ref)
}
```

Create `src/components/StoragePanel.jsx`:

```jsx
import { useState } from 'react'
import { uploadUserExport } from '../services/userFiles.js'

export default function StoragePanel({ user }) {
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')

  if (!user) return null

  const upload = async () => {
    if (!file) return
    try {
      setMessage('Uploading…')
      setUrl(await uploadUserExport(user, file))
      setMessage('Uploaded.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".png,.obj,.gltf,.glb"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <button type="button" disabled={!file} onClick={upload}>Upload export</button>
      {url ? <a href={url} target="_blank" rel="noreferrer">Open uploaded file</a> : null}
      {message ? <p>{message}</p> : null}
    </div>
  )
}
```

Create `storage.rules`:

```txt
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/exports/{fileName} {
      allow read, delete: if request.auth != null
                          && request.auth.uid == userId;
      allow create, update: if request.auth != null
                            && request.auth.uid == userId
                            && request.resource.size < 25 * 1024 * 1024;
    }
  }
}
```

Extend `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

Deploy:

```powershell
npx firebase deploy --only storage
```

In `src/App.jsx`, import:

```js
import StoragePanel from './components/StoragePanel.jsx'
```

Place beside the other Firebase controls:

```jsx
<StoragePanel user={user} />
```

### 4. Test

1. Sign in.
2. Use the existing Noise Lab **EXPORT** menu to download a PNG or OBJ.
3. Choose that file in `StoragePanel` and upload it.
4. Confirm it appears in Console → **Storage → Files** at:

```text
users/{your-uid}/exports/
```

5. Confirm a file larger than 25 MB is rejected.
6. Sign in as a second user and confirm it cannot access the first user's path through the Firebase SDK.

> A Firebase download URL contains an access token and can be opened by anyone who receives that URL. Do not treat the URL itself as a secret document vault.

---

## Step 6 — Verify all Security Rules

### 1. Firebase Console

1. Firestore → **Rules**: confirm the deployed rules match `firestore.rules`.
2. Storage → **Rules**: confirm the deployed rules match `storage.rules`.
3. Do not use `allow read, write: if true`.

### 2. Project files

Review only:

```text
firestore.rules
storage.rules
firebase.json
```

### 3. Commands

```powershell
npx firebase deploy --only firestore:rules,storage
```

### 4. Test

Use two accounts:

- Account A can save/load only `users/A/configs/*`.
- Account B cannot read or write Account A's config path.
- Account A can upload only under `users/A/exports/*`.
- Signed-out users cannot read or write either service.

In browser DevTools, expected permission failures appear as `permission-denied` or `storage/unauthorized`.

---

## Step 7 — Deploy the Vite app with Firebase Hosting

This project is a static Vite SPA with hash routes, so classic Firebase Hosting is sufficient.

### 1. Firebase Console

No manual setup is required beyond the existing Firebase project. Hosting will appear after the first deployment.

### 2. Project files

The CLI creates or updates:

```text
.firebaserc
firebase.json
```

### 3. Commands and configuration

```powershell
npx firebase init hosting
```

Choose:

- Existing Noise Lab Firebase project
- Public directory: `dist`
- Configure as a single-page app: **Yes**
- GitHub automatic deploys: **No** for now
- Do not replace an existing `index.html`

The complete `firebase.json` should resemble:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Build and deploy:

```powershell
npm run build
npx firebase deploy --only hosting
```

### 4. Test

1. Open the printed `https://PROJECT_ID.web.app` URL.
2. Test `#/2d`, `#/3d`, and `#/sim`.
3. Create or sign into a test account.
4. Save a config, refresh the browser, then load it.
5. Upload a small export and open its returned URL.

---

## Files added or modified after the tutorial

```text
Project02/
├── .env.local                         # create; ignored by Git
├── .firebaserc                        # generated by Firebase CLI
├── firebase.json                      # create/modify
├── firestore.indexes.json             # generated by Firebase CLI
├── firestore.rules                    # create
├── storage.rules                      # create
├── package.json                       # firebase + firebase-tools
└── src/
    ├── App.jsx                        # minimal UI/state wiring
    ├── firebase.js                    # create
    ├── components/
    │   ├── AuthPanel.jsx              # create
    │   ├── NoiseConfigPanel.jsx       # create
    │   └── StoragePanel.jsx           # create
    ├── hooks/
    │   └── useAuthUser.js             # create
    └── services/
        ├── noiseConfigs.js            # create
        ├── userFiles.js               # create
        └── users.js                   # create
```

No noise, simulation, page, Three.js, or export modules need to be refactored for this first integration.

---

## Final acceptance checklist

- [ ] Existing app still passes `npm run build`
- [ ] User can create an account, sign in, and sign out
- [ ] Each login has `users/{uid}` in Firestore
- [ ] Current Noise Lab parameters save under that user's `configs`
- [ ] Loading a config restores params, simulation mode, and sim view
- [ ] Generated arrays and runtime simulation state are not stored
- [ ] Signed-out users cannot access Firestore or Storage
- [ ] One user cannot access another user's data
- [ ] Export files upload under the logged-in user's Storage path
- [ ] Hosted `web.app` build supports all current hash routes
