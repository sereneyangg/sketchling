import assert from 'node:assert/strict';await import('../public/edit-layer.js');const E=globalThis.SketchlingEdits;
const w=220,h=220,b=new Uint8ClampedArray(w*h*4),g=new Uint8ClampedArray(w*h*4),expected=new Uint8Array(w*h);let seed=123456;function noise(){seed=(seed*1664525+1013904223)>>>0;return (seed/4294967296-.5)*45;}
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,n=noise(),oval=((x-105)/43)**2+((y-112)/59)**2<1,hole=((x-105)/11)**2+((y-112)/15)**2<1;expected[y*w+x]=oval&&!hole?1:0;const base=110+n;for(let c=0;c<3;c++){b[i+c]=base;g[i+c]=base+(expected[y*w+x]?65:0)+noise();}b[i+3]=g[i+3]=255;}
let regions=E.overallEraseRegions(b,g,w,h,{x:0,y:0,w:100,h:100});assert.equal(regions.length,1,'one coherent region, despite independent texture noise');assert(regions[0].loops.length>=2,'keep the protected interior island');assert(!regions[0].clipped);
function inside(loop,x,y){let yes=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],q=loop[j];if((a[1]>y)!==(q[1]>y)&&x<(q[0]-a[0])*(y-a[1])/(q[1]-a[1])+a[0])yes=!yes;}return yes;}
let intersection=0,union=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const is=regions[0].loops.reduce((s,p)=>s!==inside(p,x+.5,y+.5),false),truth=!!expected[y*w+x];if(is&&truth)intersection++;if(is||truth)union++;}
const iou=intersection/union;assert(iou>.9,'outline overlaps known region >90%: '+iou);
// Erase regions never arise from darkening alone or unchanged texture.
assert.equal(E.overallEraseRegions(b,b,w,h,{x:0,y:0,w:100,h:100}).length,0);
const dark=new Uint8ClampedArray(b);for(let i=0;i<dark.length;i+=4)for(let c=0;c<3;c++)dark[i+c]=Math.max(0,b[i+c]-45);assert.equal(E.overallEraseRegions(b,dark,w,h,{x:0,y:0,w:100,h:100}).length,0);
// Two distant regions must remain separate, not be wrapped by one invented hull.
const two=new Uint8ClampedArray(b);for(let y=35;y<65;y++)for(let x=25;x<55;x++)for(let c=0;c<3;c++)two[(y*w+x)*4+c]+=70;for(let y=145;y<180;y++)for(let x=155;x<185;x++)for(let c=0;c<3;c++)two[(y*w+x)*4+c]+=70;
assert.equal(E.overallEraseRegions(b,two,w,h,{x:0,y:0,w:100,h:100}).length,2);
console.log(JSON.stringify({noiseRobustShape:true,preservedHole:true,knownShapeIntersectionOverUnion:+iou.toFixed(3),keepsSeparateRegions:true,noFalseEraseFromDarkening:true}));
