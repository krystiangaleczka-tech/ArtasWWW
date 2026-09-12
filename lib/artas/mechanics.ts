// Nominal product dimensions are metres. Educational kinematics, not fabrication CAD.
export const MODEL_OPENING_DURATION_MS=5000;
export function rollerPath(distance:number,height:number){
 const axisY=height+.12,r0=.07,b=.009/(2*Math.PI);
 if(distance<=axisY)return {y:distance,z:0,angle:0};
 const travel=distance-axisY;
 const angle=(-r0+Math.sqrt(r0*r0+2*b*travel))/b;
 const r=r0+b*angle;
 return {y:axisY+r*Math.sin(angle),z:-r0+r*Math.cos(angle),angle:-angle};
}
export function gatePath(distance:number,height:number){
 const r=.32, start=height-r;
 if(distance<=start)return {y:distance,z:0,angle:0};
 const a=Math.min((distance-start)/r,Math.PI/2);
 const extra=Math.max(0,distance-start-r*Math.PI/2);
 return {y:start+r*Math.sin(a),z:-r*(1-Math.cos(a))-extra,angle:-a};
}
export function splitPanels(height:number,nominal:number){
 const parts:number[]=[];let left=height;
 while(left>0.00001){const h=Math.min(nominal,left);parts.push(h);left-=h;}
 return parts;
}
export type Point={x:number;y:number};
export function distanceToSegment(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)}
export function withinChannel(p:Point,path:Point[],radius:number){return path.slice(1).some((v,i)=>distanceToSegment(p,path[i],v)<=radius)}
export function safeWireMove(a:Point,b:Point,path:Point[],radius:number){const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=1;i<=count;i++)if(!withinChannel({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count},path,radius))return false;return true;}

export function validQuad(points:Point[]){
 if(points.length!==4)return false;let sign=0;
 for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];if(!Number.isFinite(a.x)||!Number.isFinite(a.y))return false;const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(cross)<.002||sign&&Math.sign(cross)!==sign)return false;sign=Math.sign(cross);}
 return sign>0;
}

export function gateHeight(profile:number){return profile/1000*(profile===500?5:4)}
