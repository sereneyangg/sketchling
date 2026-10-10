import assert from 'node:assert/strict';
await import('../public/lesson.js');
const L = globalThis.SketchlingLesson;

// A drawn line at y=40 that the reference puts at y=44.
const W = 200, s = W/100;
const sheet = () => { const a = new Uint8ClampedArray(W*W*4).fill(255); return a; };
const dot = (a, ux, uy, r=1) => { for (let y=-r;y<=r;y++) for (let x=-r;x<=r;x++){ const i=((Math.round(uy*s)+y)*W+Math.round(ux*s)+x)*4; a[i]=a[i+1]=a[i+2]=20; } };
const src = sheet();
for (let ux=30; ux<=70; ux+=0.25) dot(src, ux, 40);
dot(src, 50, 85, 2);                                   // an unrelated mark far below
const D = [], G = [];
for (let ux=30; ux<=70; ux+=2){ D.push([ux,40]); G.push([ux,44]); }
const edit = L.shapeEdit({ name:'jaw', closed:false, D, G });
const prep = L.prepare(edit, W);
const dark = (a, ux, uy) => a[((Math.round(uy*s))*W+Math.round(ux*s))*4] < 128;

const none = new Uint8ClampedArray(src); L.warp(src, none, W, edit, prep, 0);
assert.deepEqual(none, src, 't=0 leaves every pixel unchanged');

const done = new Uint8ClampedArray(src); L.warp(src, done, W, edit, prep, 1);
assert(dark(done, 50, 44), 'the line arrives where the reference puts it');
assert(!dark(done, 50, 40), 'and leaves where it was');
assert(dark(done, 50, 85), 'marks outside the edit area are untouched');
for (let i=0; i<src.length; i++){ const px=(i/4)%W, py=((i/4)/W)|0; if (py > 70*s) assert.equal(done[i], src[i], 'nothing changes far from the feature'); }

const half = new Uint8ClampedArray(src); L.warp(src, half, W, edit, prep, 0.5);
assert(dark(half, 50, 42), 'halfway through, the line is halfway there');

// The words come from the same numbers.
const say = L.describe(edit, 50, 8);
assert.match(say.text, /^Lower the jaw/); assert.match(say.detail, /half an eye-width/);
const ear = L.shapeEdit({ name:'right ear', closed:true, D:[[74,45],[77,45],[78,52],[75,58],[73,52]], G:[[77,45],[80,45],[81,52],[78,58],[76,52]] });
assert.equal(L.describe(ear, 50, 8).text, 'Move the right ear outward');
const eye = L.shapeEdit({ name:'left eye', closed:true, D:[[35,48],[39,46],[43,48],[39,50]], G:[[34,48],[39,46],[44,48],[39,50]] });
assert.match(L.describe(eye, 50, 8).text, /^Widen the left eye/);

// Tool rides the moving line: start of the line at t=0, end of the corrected line at t=1.
assert.deepEqual(L.toolPoint(edit, 0).map(v=>+v.toFixed(3)), [30,40]);
assert.deepEqual(L.toolPoint(edit, 1).map(v=>+v.toFixed(3)), [70,44]);

// Planning: only confident, plausible edits; hair skipped; teaching order.
const feats = [
  { name:'right ear', closed:true, confident:true, D:ear.D, G:ear.G },
  { name:'jaw', closed:false, confident:true, D, G },
  { name:'hair outline', closed:false, confident:true, D, G },
  { name:'nose', closed:false, confident:false, D, G },
  { name:'mouth', closed:true, confident:true, D:[[40,70],[50,69],[60,70],[50,73]], G:[[40,90],[50,89],[60,90],[50,93]] },
];
const plan = L.planShapeStage(feats, { faceCx:50, eyeW:8, thr:1.5 });
assert.deepEqual(plan.map(e=>e.name), ['jaw','right ear'], 'confident, plausible edits only, structure first');
assert(plan.every(e => e.text && e.region), 'every edit carries its own words and area');
console.log('Lesson plan: warp locality, progress, wording, tool path and selection checks passed');

// Aperture rule: a vertical edge can't show vertical movement.
const vertical = [[70,45],[70,50],[70,55],[70,60]];
const u = L.measurableShift(vertical, false, [2, 3]);
assert(Math.abs(u[0]-2) < 1e-6 && Math.abs(u[1]) < 1e-6, 'a vertical edge keeps only the sideways shift');
const ring = []; for (let k=0;k<16;k++){ const a=k/16*Math.PI*2; ring.push([50+5*Math.cos(a), 50+3*Math.sin(a)]); }
const v = L.measurableShift(ring, true, [2, 3]);
assert(Math.abs(v[0]-2) < 1e-6 && Math.abs(v[1]-3) < 1e-6, 'a closed shape shows movement in every direction');
const shifted = L.planShapeStage([{ name:'mouth', closed:true, confident:true, shiftOnly:true, G:ring, D:ring.map(p=>[p[0], p[1]-3]) }], { faceCx:50, eyeW:7.5, thr:1.5 });
assert.match(shifted[0].text, /^Lower the mouth/, 'a mouth drawn too high is lowered, not resized');
console.log('Aperture rule and shift-only planning checks passed');

// A resize beyond ~20% falls back to the shift; a move plus a real resize is named in full.
const big = L.planShapeStage([{ name:'mouth', closed:true, confident:true, shiftOnly:false,
  G: ring, D: ring.map(p=>[50+(p[0]-50)*.55, p[1]-3]), Dshift: ring.map(p=>[p[0], p[1]-3]) }], { faceCx:50, eyeW:7.5, thr:1.5 });
assert.match(big[0].text, /^Lower the mouth/, 'an implausible resize is not demonstrated');
assert(Math.abs(big[0].A.x.a - 1) < 1e-6, 'and the pixels only move, they are not stretched');
const both = L.planShapeStage([{ name:'mouth', closed:true, confident:true, shiftOnly:false,
  G: ring, D: ring.map(p=>[50+(p[0]-50)*.85, p[1]-2.5]), Dshift: ring.map(p=>[p[0], p[1]-2.5]) }], { faceCx:50, eyeW:7.5, thr:1.5 });
assert.match(both[0].text, /^Lower and widen the mouth/, 'a move and a modest resize are both named');
console.log('Resize limit and combined-label checks passed');
