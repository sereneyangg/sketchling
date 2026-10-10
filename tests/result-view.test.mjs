import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
await import('../public/edit-layer.js');
const E=globalThis.SketchlingEdits,w=100,h=100;
const before=new Uint8ClampedArray(w*h*4).fill(100),goal=new Uint8ClampedArray(w*h*4).fill(230);
const phases=new Int8Array(w*h),actions=E.strokeActions([[15,20],[65,20]],'eraser',4);
const pass={phases,actions,applied:actions.map(()=>0)},state=new Float64Array(before),passes=new Map([['erase:0',pass]]);
// Record a partial stroke, as when the student switches views mid-playback.
for(let i=0;i<9;i++){E.applyActionSample(state,goal,phases,w,h,actions[0],i);pass.applied[0]=i+1;}
assert.deepEqual(E.reconstruct(before,goal,w,h,passes),state,'interrupted stroke preserved exactly');
assert.deepEqual(E.reconstruct(before,goal,w,h,passes,'erase:0'),new Float64Array(before),'replay excludes only the selected pass');
const edit={kind:'uploadedEdit',before,goal,state,base:{url:'original.png'},viewRegion:{x:10,y:12,w:20,h:20},region:{x:0,y:0,w:100,h:100},tutorialPasses:passes};
assert.strictEqual(E.displayPixels(edit,'after'),state);assert.strictEqual(E.displayPixels(edit,'proposal'),goal);assert.strictEqual(E.displayPixels(edit,'before'),before);
assert.notDeepEqual(new Uint8ClampedArray(state),goal,'actual result is deliberately different from proposal');
// Exercise the production view/result handlers, with minimal display surfaces.
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const nodes=new Map();function $(id){if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{remove(){},toggle(){}}});return nodes.get(id);}
let painted=null,reference=false,zoom=null;
const ctx=vm.createContext({$,SketchlingEdits:E,session:{fixes:[edit],cur:0},view:'before',busy:false,stageTk:{dead:false},resetJaw:{hidden:true},eraseRegionControls:{hidden:true},instructionStep:0,
 document:{querySelectorAll:()=>[]},setInset(){},clearShade(){painted=null;},refOver(v){reference=v;},paintUploadedEdit(f,v='after'){painted=E.displayPixels(f,v);},stopJawPicker(){},
 newToken(old){old.dead=true;return {dead:false};},setStageImage(){},camFor:r=>r,setCam:r=>{zoom=r;},syncCurrentInstruction(){},NS:'svg'
});
vm.runInContext(html.slice(html.indexOf('function selectDrawingView('),html.indexOf('$("vBefore").onclick')),ctx);
vm.runInContext(html.slice(html.indexOf('async function playUploadedEdit('),html.indexOf('editButton.onclick=')),ctx);
vm.runInContext(html.slice(html.indexOf('async function showInstructionStep('),html.indexOf('for(const [i,card]')),ctx);
ctx.setView('proposal');assert.strictEqual(painted,goal);assert.equal(reference,false);assert.equal($('vProposal').attrs['aria-pressed'],'true');
ctx.setView('ref');assert.equal(reference,true);assert.equal($('viewBadge').textContent,'Reference photo');
await ctx.showInstructionStep(2);assert.strictEqual(painted,state,'Result renders demonstrated pixels, never proposal or reference');assert.equal(reference,false);assert.strictEqual(zoom,edit.viewRegion,'result keeps the demonstration zoom');assert.equal($('vAfter').attrs['aria-pressed'],'true');assert.equal($('vRef').attrs['aria-pressed'],'false');assert.equal($('vProposal').attrs['aria-pressed'],'false');
ctx.setView('before');ctx.setView('after');assert.strictEqual(painted,state);assert.deepEqual(E.reconstruct(before,goal,w,h,passes),state,'view switches do not mutate progress');
// A jaw contour is open. Its interior (nose/mouth) cannot be edited simply
// because it lies inside the jaw's enclosing box, even if AI changes it.
const scope=E.contourBand([[[15,20],[18,65],[50,85],[82,65],[85,20]]],w,h,7);
assert.equal(scope[45*w+50],0);assert.equal(scope[60*w+50],0);assert(scope[80*w+50]>0);
const composite=E.composite(before,goal,w,h,{x:5,y:5,w:90,h:90},scope);
assert(composite.changed>0);
for(let n=0;n<scope.length;n++)if(scope[n]===0)assert.equal(composite.goal[n*4],before[n*4],'outside contour band stays original');
console.log('Actual result/proposal/reference separation, stable zoom, partial replay and jaw-interior protection passed.');
