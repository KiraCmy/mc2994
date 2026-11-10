import { underworldSpan, remainNiches } from './src/playground/finalHabitat/caves.js'
let bad=0; for (const [x,y,z] of remainNiches(40)) { const s=underworldSpan(x,y,z); if(!s||y<s.floor||y>s.ceiling) bad++ } console.log('bad niches', bad)
