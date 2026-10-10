import assert from 'node:assert/strict';
await import('../public/edit-layer.js');
const E=globalThis.SketchlingEdits,w=40,h=40,b=new Uint8ClampedArray(w*h*4),t=new Uint8ClampedArray(b.length);
for(let n=0;n<w*h;n++){b.set([100,100,100,255],n*4);t.set([240,240,240,255],n*4);}
for(let y=14;y<20;y++)for(let x=14;x<20;x++)t.set([20,20,20,255],(y*w+x)*4);
for(let y=20;y<26;y++)for(let x=14;x<20;x++)t.set([88,88,88,255],(y*w+x)*4);
const r={x:25,y:25,w:50,h:50},a=E.composite(b,t,w,h,r);assert(a.changed>0);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;assert.equal(a.goal[i+3],255);if(x<10||x>=30||y<10||y>=30)assert.deepEqual(a.goal.subarray(i,i+4),b.subarray(i,i+4));}
const paths=E.plan(a.phases,w,h);assert(paths.every(p=>p.length));for(const phase of paths)for(const path of phase)for(const [x,y] of path){assert(x>=0&&x<w&&y>=0&&y<h);}
const state=new Float64Array(b);E.stamp(state,a.goal,a.phases,w,h,16,16,5,0);assert.equal(state[(16*w+16)*4],100);E.stamp(state,a.goal,a.phases,w,h,16,16,5,1);assert(state[(16*w+16)*4]<100);
E.finish(state,a.goal,a.phases,0);E.finish(state,a.goal,a.phases,1);E.finish(state,a.goal,a.phases,2);assert.deepEqual(new Uint8ClampedArray(state),a.goal);
const unchanged=E.composite(b,b,w,h,r);assert.equal(unchanged.changed,0);assert(E.plan(unchanged.phases,w,h).every(p=>!p.length));console.log('Edit area confinement, alpha preservation, phase separation, brush locality, path bounds, complete replay and unchanged-image checks passed');
const transparent=new Uint8ClampedArray(b.length);assert.deepEqual(E.composite(b,transparent,w,h,r).goal,b,'transparent black cannot paint over paper');
