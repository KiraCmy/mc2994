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
  'waterLevel',
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
  const configQuery = query(
    collection(db, 'users', user.uid, 'configs'),
    orderBy('updatedAt', 'desc'),
  )
  const snapshot = await getDocs(configQuery)
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}
