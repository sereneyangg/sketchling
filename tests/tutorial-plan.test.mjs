import assert from 'node:assert/strict';
await import('../public/edit-layer.js');
const E=globalThis.SketchlingEdits,w=100,h=100,b=new Uint8ClampedArray(w*h*4),g=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;b.set([130,130,130,255],i);g.set([x<50?210:65,x<50?210:65,x<50?210:65,255],i);}
const region={bounds:{x:10,y:10,w:80,h:80},loops:[[[10,10],[90,10],[90,90],[10,90]],[[40,40],[40,60],[60,60],[60,40]]]};
for(const kind of ['eraser','pencil']){
 const plan=E.teachingPlan(b,g,w,h,region,kind);assert(plan.actions.length>0);assert(plan.actions.length<=(kind==='eraser'?32:40));assert.equal(plan.mask[50*w+50],0);
 const state=new Float64Array(b);
 for(const action of plan.actions){assert.equal(action.type,'stroke');assert(action.points.length>=8);for(let j=0;j<action.points.length;j++){const [x,y]=action.points[j];if(j)assert(Math.hypot(x-action.points[j-1][0],y-action.points[j-1][1])<=1.01,'continuous contact');assert(plan.mask[Math.round(y)*w+Math.round(x)],'tool stays in guide');E.applyActionSample(state,g,plan.phases,w,h,action,j);}}
 let changed=0;for(let n=0;n<w*h;n++){const i=n*4;if(state[i]!==b[i]){changed++;assert(plan.mask[n]);assert(kind==='eraser'?state[i]>b[i]:state[i]<b[i]);}assert.equal(state[i+3],255);}
 assert(changed>0);assert.equal(state[(50*w+50)*4],130,'protected island stays intact');
}
console.log('Tutorial plans: correct tool direction, guide confinement, protected islands and bounded action count passed.');

// A narrow sloping graphite mark must be followed along its length, not dotted.
const bw=180,bh=180,original=new Uint8ClampedArray(bw*bh*4).fill(255),target=new Uint8ClampedArray(original);
for(let y=10;y<170;y++)for(let x=10;x<170;x++)if(Math.abs(y-(.65*x+25))<4)original.set([70,70,70,255],(y*bw+x)*4);
const lineRegion={bounds:{x:5,y:5,w:170,h:170},loops:[[[5,5],[175,5],[175,175],[5,175]]]};
const linePlan=E.teachingPlan(original,target,bw,bh,lineRegion,'eraser');
assert(linePlan.actions.length>2);
for(const a of linePlan.actions){const first=a.points[0],last=a.points.at(-1),dx=last[0]-first[0],dy=last[1]-first[1];assert(Math.abs(dy/dx-.65)<.3,'eraser follows the mark direction');}
assert(E.strokePressure(0)<E.strokePressure(.5)/4);assert(E.strokePressure(1)<E.strokePressure(.5)/4);
console.log('Continuous strokes follow sloping marks and taper pressure at both ends.');
