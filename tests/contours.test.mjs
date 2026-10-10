import assert from 'node:assert/strict';await import('../public/edit-layer.js');const E=globalThis.SketchlingEdits;
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
let mask=new Uint8Array(400);for(let y=4;y<12;y++)for(let x=3;x<10;x++)mask[y*20+x]=1;let loops=E.contours(mask,20,20,1);assert.equal(loops.length,1);assert.equal(area(loops[0]),56);assert.equal(loops[0].length,4);
for(let y=6;y<10;y++)for(let x=5;x<8;x++)mask[y*20+x]=0;loops=E.contours(mask,20,20,1);assert.equal(loops.length,2);assert.deepEqual(loops.map(area).sort((a,b)=>a-b),[12,56]);
mask=new Uint8Array(400);mask[21]=1;mask[42]=1;loops=E.contours(mask,20,20,1);assert.equal(loops.length,2);assert(loops.every(p=>area(p)===1));assert.equal(E.contours(mask,20,20,24).length,0);
const w=60,h=60,b=new Uint8ClampedArray(w*h*4),g=new Uint8ClampedArray(b.length);for(let n=0;n<w*h;n++){b.set([220,220,220,255],n*4);g.set([220,220,220,255],n*4);}for(let y=20;y<40;y++)for(let x=20;x<35;x++)g.set([75,75,75,255],(y*w+x)*4);for(let y=10;y<18;y++)for(let x=10;x<22;x++)b.set([60,60,60,255],(y*w+x)*4);
const result=E.shadowBoundaries(b,g,w,h,{x:0,y:0,w:100,h:100});assert(result.erase.length);assert(result.shadow.length);for(const loops of [result.erase,result.shadow])for(const p of loops)for(const [x,y]of p)assert(x>=0&&x<=w&&y>=0&&y<=h);
console.log('Contour tests passed: exact cell boundaries, hole preservation, diagonal separation, speckle filtering and separate erase/shadow detection.');
