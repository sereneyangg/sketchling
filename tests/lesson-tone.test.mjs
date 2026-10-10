import assert from 'node:assert/strict';
await import('../public/lesson.js');
const L = globalThis.SketchlingLesson, N = 100;

// A face patch 20..80 square. The reference has a dark shadow at x 30-40, y 40-60 that the drawing left light,
// and the drawing has a dark smudge at x 60-70, y 40-55 where the reference is light.
const inside = new Uint8Array(N*N), drawLum = new Float32Array(N*N), refLum = new Float32Array(N*N);
for (let y=20;y<80;y++) for (let x=20;x<80;x++){ const i=y*N+x; inside[i]=1;
  drawLum[i] = 0.75 + ((x*7+y*13)%10)/200;                  // light skin with a little grain
  refLum[i]  = 0.70 + ((x*3+y*5)%10)/200; }
for (let y=20;y<80;y++) for (let x=50;x<56;x++){ drawLum[y*N+x]=0.25; refLum[y*N+x]=0.25; }   // shared dark line sets the range
for (let y=40;y<60;y++) for (let x=30;x<40;x++) refLum[y*N+x] = 0.30;
for (let y=40;y<55;y++) for (let x=60;x<70;x++) drawLum[y*N+x] = 0.32;
const named = [{ name:'nose', pts:[[48,50],[52,50],[50,56]] }];
const plan = L.planToneStage({ drawLum, refLum, inside, named, faceCx:50 });
const dk = plan.find(e => e.kind==='darken'), lf = plan.find(e => e.kind==='lift');
assert(dk && lf, 'finds both the missing shadow and the extra smudge');
assert(dk.c[0] > 28 && dk.c[0] < 42 && dk.c[1] > 38 && dk.c[1] < 62, 'the shadow is where the reference has it');
assert(lf.c[0] > 58 && lf.c[0] < 72, 'the smudge is where the drawing has it');
assert.match(dk.text, /^Darken the shadow on the left cheek/); assert.match(lf.text, /^Lift graphite on the right cheek/);
assert.match(dk.detail, /tone step/);

// Pixels: goal darkens only inside the area, by the planned amount, keeping texture.
const W = 200, src = new Uint8ClampedArray(W*W*4);
for (let y=0;y<W;y++) for (let x=0;x<W;x++){ const i=(y*W+x)*4, v = 200 + ((x+y)%3)*10; src[i]=src[i+1]=src[i+2]=v; src[i+3]=255; }
const { goal } = L.toneGoal(src, W, dk);
const lum = (a, ux, uy) => { const i=((uy*2)*W+ux*2)*4; return a[i]; };
assert(lum(goal, 35, 50) < lum(src, 35, 50) - 40, 'the shadow gets clearly darker');
assert.equal(lum(goal, 70, 50), lum(src, 70, 50), 'pixels outside the area are untouched');
assert.equal(lum(goal, 35, 15), lum(src, 35, 15), 'and outside the face');
const lifted = L.toneGoal(goal, W, lf).goal;
assert(lum(lifted, 65, 47) >= lum(goal, 65, 47), 'lifting never darkens');

// Tool path stays inside the area; stamps move pixels toward the goal and stop there.
const strokes = L.toneStrokes(dk), mask = L.toneMask(dk);
assert(strokes.length > 5 && strokes.every(s => s.every(([x,y]) => x>27 && x<43 && y>37 && y<63)), 'strokes stay in the shadow');
const state = new Float64Array(src); for (const s of strokes) for (const [x,y] of s) L.stamp(state, goal, W, x, y, .7, .35);
const after = lum(state, 35, 50); assert(after < lum(src, 35, 50) && after >= lum(goal, 35, 50) - 1, 'stamps darken toward the goal, never past it');
const hairline = [{ name:'hairline', pts:[[30,35],[50,33],[70,35]] }, { name:'jaw', pts:[[30,60],[50,80],[70,60]] }, { name:'left eye', pts:[[38,45],[44,45]] }, { name:'mouth', pts:[[45,70],[55,70]] }];
assert.equal(L.whereOf([66,28], hairline, 50), 'in the hair on the right');
assert.equal(L.whereOf([50,38], hairline, 50), 'on the forehead');
assert.equal(L.whereOf([33,55], hairline, 50), 'on the left cheek');
assert.equal(L.whereOf([34,76], hairline, 50), 'along the left jaw');
console.log('Tone plan: placement, wording, goal locality, lift direction, stroke confinement and stamp bounds passed');
