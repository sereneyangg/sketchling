import assert from 'node:assert/strict';
await import('../public/lesson.js');
const L = globalThis.SketchlingLesson;

// A 200×200 grid (two cells per sheet unit). Drawing and reference share the broad tone (V2 is done);
// the reference has details the drawing lacks, and the drawing has scribbly hatching where the reference is smooth.
const N = 200, k = 2, at = (ux, uy) => Math.floor(uy*k)*N + Math.floor(ux*k);
const inside = new Uint8Array(N*N), draw = new Float32Array(N*N), ref = new Float32Array(N*N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
  const ux = (x+.5)/k, uy = (y+.5)/k, i = y*N + x;
  inside[i] = Math.hypot(ux-50, uy-50) < 40 ? 1 : 0;
  const base = uy < 30 ? .3 : .72 + .1*(ux-50)/40;                  // hair band + a gentle side light
  draw[i] = ref[i] = base;
  const dot = (cx, cy, r) => Math.hypot(ux-cx, uy-cy) < r;
  if (dot(40, 48, 1.1)) ref[i] = .04;                                  // left pupil: missing in the drawing
  if (dot(60, 48, 1.1)) ref[i] = .04;                                  // right pupil: drawn, but 1 unit off
  if (dot(61, 48, 1.1)) draw[i] = .05;
  if (dot(50, 61, .9)) ref[i] = .99;                                   // highlight on the nose tip
  if (uy > 69.7 && uy < 70.3 && ux > 40 && ux < 58) ref[i] = .12;      // a crisp edge (the lip line)
  if (uy > 63 && uy < 65 && ux > 46 && ux < 54) ref[i] = .2;           // a soft band: the shadow under the nose
  if (ux > 63 && ux < 73 && uy > 55 && uy < 64) draw[i] += ((Math.floor(ux*2) % 2) ? .14 : -.14);   // scribbly hatching
  if (dot(45, 22, 1)) ref[i] = .02;                                    // a dark speck in the hair mass: texture, not an accent
  if (ux > 52 && ux < 62 && uy > 15 && uy < 25) draw[i] += ((Math.floor(ux*2) % 2) ? .12 : -.12);   // hair strokes: keep them
}
const named = [{ name:'left eye', pts:[[36,48],[40,46],[44,48],[40,50]] }, { name:'right eye', pts:[[56,48],[60,46],[64,48],[60,50]] },
               { name:'nose', pts:[[47,52],[53,52],[54,62],[46,62]] }, { name:'mouth', pts:[[40,68],[50,67],[59,68],[50,72]] }];
const plan = L.planDetailStage({ drawLum: draw, refLum: ref, inside, N, named, faceCx: 50, max: 6, perKind: 3 });
const by = kind => plan.filter(e => e.kind === kind);
const near = (e, x, y, r=2) => Math.hypot(e.c[0]-x, e.c[1]-y) < r;
console.log(plan.map(e => `${e.kind} ${e.text} @${e.c.map(v=>v.toFixed(1))} · ${e.detail}`).join('\n'));

assert(by('accent').some(e => near(e, 40, 48)), 'the missing pupil is an accent');
assert(!plan.some(e => e.kind === 'accent' && near(e, 60, 48, 3)), 'a pupil drawn one unit off is not drawn twice');
assert(by('highlight').some(e => near(e, 50, 61)), 'the nose-tip highlight is found');
const edge = by('edge').find(e => near(e, 49, 70, 4));
assert(edge, 'the thin dark line is an edge, not an accent');
assert(Math.abs(edge.axis[1]) < .2, 'and runs along the line');
assert(by('blend').some(e => e.c[0] > 62 && e.c[0] < 74 && e.c[1] > 54 && e.c[1] < 65), 'the scribbly patch is blended');
const shadow = by('shadow')[0];
assert(shadow && near(shadow, 50, 64), 'a wider dark band is a small cast shadow');
assert.equal(shadow.text, 'Add the shadow under the nose');
assert(!plan.some(e => e.c[1] < 32), 'nothing is added to or blended in the hair');
assert.deepEqual([...new Set(plan.map(e => e.kind))], ['blend','shadow','edge','accent','highlight'], 'surface first, highlights last');
assert.equal(by('accent').find(e => near(e, 40, 48)).text, 'Add a dark accent in the left eye');
assert.equal(by('highlight')[0].text, 'Pick out a highlight on the nose');
assert.equal(edge.text, 'Sharpen the edge between the lips');

// Pixels: changes stay in the area and go the planned way.
const W = 400, s = W/100, img = new Uint8ClampedArray(W*W*4);
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++){ const v = draw[at((x+.5)/s, (y+.5)/s)]*255, i = (y*W+x)*4; img[i]=img[i+1]=img[i+2]=v; img[i+3]=255; }
const lum = (a, ux, uy) => { const i = (Math.floor(uy*s)*W + Math.floor(ux*s))*4; return a[i]; };
for (const e of plan){
  const { goal, box } = L.detailGoal(img, W, e);
  let changed = 0;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++){ const i = (y*W+x)*4; if (goal[i] !== img[i]){ changed++;
    assert(x >= box.x0 && x < box.x0+box.w && y >= box.y0 && y < box.y0+box.h, `${e.kind}: change outside its box`);
    const ux = (x+.5)/s, uy = (y+.5)/s;
    assert(Math.min(...e.cells.map(c => Math.hypot((c%N+.5)/k-ux, ((c/N|0)+.5)/k-uy))) < 2, `${e.kind}: change far from its cells`); } }
  assert(changed > 0, `${e.kind}: something changes`);
  if (e.kind === 'accent' || e.kind === 'edge' || e.kind === 'shadow') assert(lum(goal, e.c[0], e.c[1]) < lum(img, e.c[0], e.c[1]) - 40, `${e.kind} darkens`);
  if (e.kind === 'highlight') { const a = lum(img, e.c[0], e.c[1]); assert(lum(goal, e.c[0], e.c[1]) > a + .6*(e.paper*255 - a), 'highlight lifts most of the way to the paper'); }
  if (e.kind === 'blend'){ let a = 0, b = 0; for (let ux = 64; ux < 72; ux += .25){ a += Math.abs(lum(img, ux, 59) - lum(img, ux+.5, 59)); b += Math.abs(lum(goal, ux, 59) - lum(goal, ux+.5, 59)); } assert(b < a*.5, 'blend evens out the stripes'); }
  // the tool stays on the area it is changing
  const mask = L.detailMask(e), strokes = L.detailStrokes(e, mask);
  assert(strokes.length && strokes.every(st => st.length >= 2), `${e.kind}: has a path`);
  for (const st of strokes) for (const p of st) assert(Math.min(...e.cells.map(c => Math.hypot((c%N+.5)/k-p[0], ((c/N|0)+.5)/k-p[1]))) < 1.6, `${e.kind}: tool leaves the area`);
}
// Nothing to finish when the drawing already has the reference's details.
assert.equal(L.planDetailStage({ drawLum: ref, refLum: ref, inside, N, named }).length, 0, 'no items when the details already match');
console.log('Detail stage: placement, tolerance, wording, order, pixel locality, direction and tool path checks passed');
