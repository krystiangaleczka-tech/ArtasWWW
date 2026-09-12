import * as T from 'three';
import { gatePath,rollerPath,splitPanels,gateHeight } from './mechanics';
import type {ModelKind} from './catalog';
export type Part={id:string;label:string;group:T.Group;offset:T.Vector3;base:T.Vector3;stage:number};
export type Model={root:T.Group;parts:Part[];update:(open:number,explode:number,cut:boolean,assembled?:number,selected?:string)=>void;dispose:()=>void};
export function createProduct(kind:ModelKind,hex:string,profile:number):Model{
 const root=new T.Group();const parts:Part[]=[];const moving:{group:T.Group;y:number;h:number}[]=[];
 const isGate=kind==='gate'||kind==='industrial';const isPergola=kind==='pergola';const isGrille=kind==='commercial-grille';
 const W=isPergola?3.5:isGate?3.1:kind==='rolling-gate'||isGrille?2.8:1.7;
 const H=isPergola?2.4:isGate?gateHeight(profile):2.1;
 const cutPlane=new T.Plane(new T.Vector3(-1,0,0),0);
 const painted=new T.MeshStandardMaterial({color:hex,metalness:.65,roughness:.31});
 const skin=painted.clone();const dark=new T.MeshStandardMaterial({color:'#24282b',metalness:.45,roughness:.48});
 const silver=new T.MeshStandardMaterial({color:'#a9b0b5',metalness:.8,roughness:.25});
 const orange=new T.MeshStandardMaterial({color:'#f9813d',metalness:.45,roughness:.3});
 const foam=new T.MeshStandardMaterial({color:'#c2ab76',roughness:.9});
 const glass=new T.MeshStandardMaterial({color:'#71838b',metalness:.35,roughness:.15,transparent:true,opacity:.65});
 const cutMaterials=[skin];const materials=new Set<T.Material>([painted,skin,dark,silver,orange,foam,glass]);
 function part(id:string,label:string,stage:number,off:number[]){const group=new T.Group();root.add(group);const p={id,label,stage,group,offset:new T.Vector3(...off as [number,number,number]),base:new T.Vector3()};parts.push(p);return group;}
 function box(g:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material=painted){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
 function cyl(g:T.Object3D,r:number,l:number,x:number,y:number,z:number,m:T.Material=silver,axis='x'){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,l,24),m);if(axis==='x')mesh.rotation.z=Math.PI/2;if(axis==='z')mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.castShadow=true;g.add(mesh);return mesh;}
 function tube(g:T.Object3D,points:T.Vector3[],r:number,m:T.Material=silver){const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(20,points.length*2),r,8,false),m);g.add(mesh);return mesh;}
 const guides=part('guides',isPergola?'Słupy i stopy':'Prowadnice pionowe',0,[-.55,0,0]);
 if(isPergola){
  for(const x of [-W/2,W/2])for(const z of [-1.3,1.3]){box(guides,.14,H,.14,x,H/2,z);box(guides,.25,.03,.25,x,.015,z,silver);}
  const beams=part('box','Belki obwodowe i rynny',1,[0,.9,0]);
  for(const z of [-1.3,1.3])box(beams,W+.14,.255,.14,0,H,z);
  for(const x of [-W/2,W/2])box(beams,.14,.255,2.6,x,H,0);
  for(const x of [-W/2,W/2])for(const z of [-1.3,1.3]){box(beams,.23,.04,.10,x-Math.sign(x)*.07,H-.07,z,silver);box(beams,.04,.15,.10,x-Math.sign(x)*.17,H-.015,z,silver);}
  const blades=part('curtain','Lamele dachowe',2,[0,1.7,0]);
  for(let i=0;i<12;i++){const b=new T.Group();b.position.set(0,H+.075,-1.1+i*.2);box(b,W-.14,.044,.223,0,0,0,skin);box(b,W-.2,.006,.204,0,-.014,0,dark);blades.add(b);moving.push({group:b,y:0,h:0});for(const x of [-W/2+.09,W/2-.09])cyl(b,.015,.09,x,0,0,silver);}
  const motor=part('shaft','Napęd i cięgno',3,[.9,.65,0]);box(motor,.085,.09,2.2,W/2-.2,H+.03,0,orange);cyl(motor,.035,.55,W/2-.2,H-.055,.8,silver,'z');
  const drains=part('bottom','Odwodnienie',4,[.8,0,.55]);for(const z of [-1.3,1.3]){box(drains,.04,H-.15,.04,W/2-.045,(H-.15)/2,z,silver);box(drains,.15,.035,.04,W/2-.01,.065,z,orange);}
  const caps=part('cover','Maskownice i uszczelnienia',5,[0,.65,.85]);for(const z of [-1.3,1.3])box(caps,W+.18,.035,.18,0,H+.13,z,skin);
 }else if(isGate){
  for(const x of [-W/2-.06,W/2+.06]){box(guides,.075,H-.3,.09,x,(H-.3)/2,0,silver);box(guides,.13,H,.024,x,H/2,-.075,silver);}
  const tracks=part('tracks','Łuki i prowadnice poziome',1,[0,.55,-.7]);
  for(const x of [-W/2-.06,W/2+.06]){const pts=[];for(let i=0;i<=50;i++){const p=gatePath(H-.32+i*H/50,H);pts.push(new T.Vector3(x,p.y,p.z))}tube(tracks,pts,.023,silver);box(tracks,.08,.6,.08,x,H+.3,-2.05,silver);}
  const curtain=part('curtain','Panele, zawiasy i rolki',2,[0,0,.95]);let pos=0;
  splitPanels(H,profile/1000).forEach((ph,i)=>{const p=new T.Group();p.position.y=pos+ph/2;curtain.add(p);
   box(p,W,ph-.006,.04,0,0,0,skin);box(p,W-.008,ph-.018,.032,0,0,0,foam);
   box(p,W,.008,.044,0,-ph/2+.006,0,dark);
   if(kind==='industrial'&&i===2)for(const x of [-.95,0,.95]){box(p,.63,ph*.52,.055,x,0,.002,dark);box(p,.57,ph*.43,.058,x,0,.004,glass);}
   for(const x of [-W/2+.04,W/2-.04]){box(p,.055,.12,.035,x,-ph/2+.065,-.04,silver);cyl(p,.037,.065,x+(x>0?.09:-.09),-ph/2+.06,0,silver);}
   for(const x of [-.6,.6])box(p,.055,.09,.018,x,-ph/2+.05,-.039,silver);
   moving.push({group:p,y:pos+ph/2,h:ph});pos+=ph;
  });
  const shaft=part('shaft','Wał, sprężyny i linki',3,[0,.65,.35]);cyl(shaft,.025,W+.3,0,H+.16,-.16);
  for(const x of [-.55,.55]){const pts=[];for(let j=0;j<=300;j++){const a=j/300*Math.PI*60;pts.push(new T.Vector3(x-.3+j/300*.6,H+.16+Math.sin(a)*.062,-.16+Math.cos(a)*.062));}tube(shaft,pts,.007,dark);}
  for(const x of [-W/2,W/2]){cyl(shaft,.085,.10,x,H+.16,-.16,dark);tube(shaft,[new T.Vector3(x,.04,-.03),new T.Vector3(x,H+.15,-.1)],.003,silver);}
  const motor=part('motor','Szyna i napęd sufitowy',4,[0,.5,-.9]);box(motor,.065,.06,2.35,0,H+.13,-1.13,silver);box(motor,.3,.15,.43,0,H+.06,-2.35,dark);box(motor,.21,.02,.2,0,H-.022,-2.35,orange);tube(motor,[new T.Vector3(0,H-.1,-.05),new T.Vector3(0,H+.08,-.42)],.015,silver);
  const sensor=part('sensor','Fotokomórki i uszczelnienie',5,[.65,0,.5]);for(const x of [-W/2-.1,W/2+.1]){box(sensor,.07,.11,.07,x,.24,.085,dark);cyl(sensor,.022,.014,x,.24,.13,orange,'z');}box(sensor,W,.024,.07,0,.012,0,dark);
 }else{
  for(const x of [-W/2-.028,W/2+.028]){box(guides,.062,H,.078,x,H/2,-.005);box(guides,.032,H,.012,x,H/2,.04,dark);}
  const housing=part('box','Korpus skrzynki',1,[0,.5,-.4]);const casingH=kind==='rolling-gate'||isGrille?.36:kind==='top'?.29:.255;const cy=H+casingH/2-.015;
  box(housing,W+.13,.025,casingH,0,H+casingH-.015,-.09,skin);box(housing,W+.13,casingH,.024,0,cy,-.09-casingH/2,skin);
  for(const x of [-W/2-.047,W/2+.047])box(housing,.025,casingH,casingH,x,cy,-.09,skin);
  if(kind==='flush'){const facade=new T.MeshStandardMaterial({color:'#b7b7b0',roughness:.9});cutMaterials.push(facade);box(housing,W+.22,casingH+.10,.045,0,cy+.025,.075,facade);}
  if(kind==='top'){box(housing,W+.10,.045,.22,0,H-.018,-.08,foam);box(housing,W+.10,.035,.24,0,H+casingH-.038,-.09,foam);}
  const shaft=part('shaft','Wał nawojowy i napęd rurowy',2,[.5,.72,.18]);const shaftShell=dark.clone();materials.add(shaftShell);cutMaterials.push(shaftShell);cyl(shaft,.065,W-.10,0,H+.11,-.11,shaftShell);cyl(shaft,.045,.5,W/2-.33,H+.11,-.11,orange);cyl(shaft,.075,.065,W/2-.075,H+.11,-.11,silver);
  for(const x of [-W/2+.01,W/2-.01]){box(shaft,.055,.15,.14,x,H+.11,-.11,silver);cyl(shaft,.075,.028,x,H+.11,-.11,dark);}
  const curtain=part('curtain',isGrille?'Pancerz ażurowy i wieszaki':'Pancerz aluminiowy i wieszaki',3,[0,0,.75]);const hs=profile/1000;const list=splitPanels(H-.04,hs);let pos=.04;
  const thickness=profile===52?.013:profile===77?.018:.009;
  for(const ph of list){const p=new T.Group();p.position.y=pos+ph/2;curtain.add(p);
   if(isGrille){
    box(p,W-.025,.022,.022,0,0,0,skin);
    for(const x of [-W*.42,-W*.14,W*.14,W*.42])box(p,.018,Math.max(.025,ph-.018),.028,x,0,0,dark);
    box(p,W-.025,.009,.03,0,ph/2-.006,0,skin);
   }else{
    box(p,W-.025,ph-.001,thickness,0,0,0,skin);box(p,W-.03,ph-.004,thickness*.65,0,0,0,foam);box(p,W-.023,.002,thickness*.6,0,ph/2-.001,-thickness*.2,dark);
   }
   moving.push({group:p,y:pos+ph/2,h:ph});pos+=ph;
  }
  for(const x of [-W*.28,W*.28])box(curtain,.05,.115,.009,x,H+.033,-.05,dark);
  const bottom=part('bottom','Listwa dolna i uszczelka',4,[0,-.23,.5]);box(bottom,W-.018,.04,.025,0,.025,0);box(bottom,W-.018,.01,.027,0,.003,0,dark);
  const cover=part('cover','Pokrywa rewizyjna',5,[0,.38,.9]);box(cover,W+.13,casingH-.04,.022,0,cy,.045,skin);box(cover,W+.13,.024,.09,0,H+.015,.012,skin);
 }
 root.position.y=-H/2;
 for(const p of parts){const cache=new Map<T.Material,T.Material>();p.group.traverse(o=>{if(o instanceof T.Mesh){const original=o.material;if(!Array.isArray(original)&&(original===painted||original===skin)){if(!cache.has(original)){const m=original.clone();m.userData.highlightable=true;if(original===skin)cutMaterials.push(m);cache.set(original,m);materials.add(m);}o.material=cache.get(original)!;}const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)materials.add(m);}});}
 const update=(open:number,explode:number,cut:boolean,assembled?:number,selected?:string)=>{
  for(const m of cutMaterials){m.clippingPlanes=cut?[cutPlane]:[];m.clipShadows=true;m.side=T.DoubleSide;}
  for(const p of parts){const ex=assembled!==undefined?(p.stage<assembled?0:1):explode;const target=p.offset.clone().multiplyScalar(ex);if(p.id==='bottom'&&!isGate&&!isPergola){const v=rollerPath(open/100*H,H);p.group.position.set(target.x,target.y+v.y,target.z+v.z);p.group.rotation.x=v.angle;}else p.group.position.lerp(target,.10);p.group.userData.partId=p.id;
   p.group.traverse(o=>{if(o instanceof T.Mesh){o.userData.partId=p.id;const m=o.material;if(!Array.isArray(m)&&m.userData.highlightable){(m as T.MeshStandardMaterial).emissive.set(selected===p.id?'#51220c':'#000000');(m as T.MeshStandardMaterial).emissiveIntensity=.6;}}});
  }
  const lift=open/100*H;
  if(isPergola){for(const m of moving)m.group.rotation.x=open/100*Math.PI*.75;}
  else for(const m of moving){const v=isGate?gatePath(m.y+lift,H):rollerPath(m.y+lift,H);m.group.position.y=v.y;m.group.position.z=v.z;m.group.rotation.x=v.angle;}
 };
 // No persistent transform allocations or user-dependent URLs are retained outside this model.
 return {root,parts,update,dispose(){root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});for(const m of materials)m.dispose();}};
}
