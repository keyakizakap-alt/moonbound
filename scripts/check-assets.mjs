import {stat} from 'node:fs/promises';
import {heroes} from '../dist/game.js';
const files=['index.html','style.css','app.js','world.js','game.js','assets/three.js','assets/portraits.png','assets/portraits-kpop.png','assets/portraits-elegant.png','assets/portraits-curvy.png'];
for(const file of files){const s=await stat(new URL('../dist/'+file,import.meta.url));if(!s.isFile()||!s.size)throw new Error(`Required asset missing or empty: ${file}`)}
if(heroes.length!==24||new Set(heroes.map(h=>h.id)).size!==24)throw new Error('Expected 24 unique heroes');
console.log('Static build ready: game scripts, 3D library, all four portrait atlases and 24 heroes verified.');
