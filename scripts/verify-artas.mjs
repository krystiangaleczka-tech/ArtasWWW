import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
const compile=async path=>ts.transpileModule(await readFile(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const mechanicsURL=data(await compile('lib/artas/mechanics.ts'));
const {rollerPath,gatePath,splitPanels,safeWireMove,validQuad,gateHeight,MODEL_OPENING_DURATION_MS}=await import(mechanicsURL);
const {products,nominalProfiles,assemblySteps,palette,defaultStudioColorIndex}=await import(data(await compile('lib/artas/catalog.ts')));
assert.equal(MODEL_OPENING_DURATION_MS,5000);
assert.equal(palette[defaultStudioColorIndex].ral,'9007');
assert.deepEqual(splitPanels(4.5,.5),[.5,.5,.5,.5,.5,.5,.5,.5,.5]);
assert.equal(products.length,17);assert.equal(new Set(products.map(p=>p.slug)).size,17);
for(const p of products)if(p.image!==undefined)await access(new URL('../public/images/original-'+p.image+'.jpeg',import.meta.url));
assert.deepEqual(nominalProfiles('gate'),[500,555,610]);assert.deepEqual(nominalProfiles('roller'),[39,43,52]);assert.deepEqual(nominalProfiles('commercial-grille'),[77]);
for(const mm of [500,555,610]){const panels=splitPanels(gateHeight(mm),mm/1000);assert(Math.abs(panels.reduce((a,b)=>a+b,0)-gateHeight(mm))<1e-9);assert(panels.every(h=>h>0&&h<=mm/1000+1e-9));}
for(const fn of [rollerPath,gatePath])for(let d=0;d<5;d+=.005){const p=fn(d,2.5),q=fn(d+.000001,2.5);assert(Object.values(p).every(Number.isFinite));assert(Math.hypot(p.y-q.y,p.z-q.z)<.0001);}
const gateEnd=gatePath(4.8,2.5);assert(Math.abs(gateEnd.y-2.5)<1e-8);assert(Math.abs(gateEnd.angle+Math.PI/2)<1e-8);assert(gateEnd.z<-.5);
const route=[{x:0,y:0},{x:100,y:0},{x:100,y:100}];assert(safeWireMove({x:0,y:0},{x:100,y:0},route,12));assert(!safeWireMove({x:0,y:0},{x:100,y:100},route,12));assert(!safeWireMove({x:0,y:0},{x:0,y:30},route,12));
assert(validQuad([{x:.1,y:.1},{x:.8,y:.1},{x:.8,y:.8},{x:.1,y:.8}]));assert(!validQuad([{x:.1,y:.1},{x:.8,y:.8},{x:.8,y:.1},{x:.1,y:.8}]));assert(!validQuad([{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]));
let modelCode=await compile('lib/artas/model.ts');modelCode=modelCode.replace("from 'three'","from "+JSON.stringify(import.meta.resolve('three'))).replace("from './mechanics'","from "+JSON.stringify(mechanicsURL));const {createProduct}=await import(data(modelCode));
for(const kind of ['roller','flush','top','gate','industrial','rolling-gate','commercial-grille','pergola']){
 const model=createProduct(kind,'#383e42',nominalProfiles(kind)[0]??200);assert(model.parts.length>=5);
 for(const opening of [0,50,100]){for(let i=0;i<100;i++)model.update(opening,.4,true);model.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model.root);assert(!b.isEmpty());assert([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));assert(b.max.y<6&&b.min.y>-4,kind+' transforms must not accumulate');}
 if(kind==='roller')for(const opening of [0,50,100]){model.update(opening,0,false);const bottom=model.parts.find(p=>p.id==='bottom');assert(bottom);const expected=rollerPath(opening/100*2.1,2.1);assert(Math.abs(bottom.group.position.y-expected.y)<1e-9);assert(Math.abs(bottom.group.position.z-expected.z)<1e-9);}
 for(const family of ['roller','gate'])if(family===kind)for(const step of assemblySteps[family])assert(model.parts.some(p=>p.id===step.id),'Game part must exist in model: '+step.id);
 model.dispose();
}
console.log('PASS: 17 product routes and assets; nominal profiles; panel totals; continuous shutter and garage trajectories; all eight model transforms; synchronized roller bottom rail; assembly part dependencies; wire collision sampling; photo corner validation.');
