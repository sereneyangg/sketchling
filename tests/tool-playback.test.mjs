import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
await import('../public/edit-layer.js');
const E=globalThis.SketchlingEdits;
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const player=html.slice(html.indexOf('async function playToolActions('),html.indexOf('async function traceTutorialGuide('));
const actions=E.strokeActions([[12,20],[40,22],[65,32]],'eraser',4);
const w=80,h=60,before=new Uint8ClampedArray(w*h*4).fill(120),goal=new Uint8ClampedArray(w*h*4).fill(220),phases=new Int8Array(w*h);
const expected=new Float64Array(before);for(const a of actions)for(let i=0;i<a.points.length;i++)E.applyActionSample(expected,goal,phases,w,h,a,i);
async function run(frames,reduceMotion=false,cancel=false){
 let contact=false,removed=false,paintCount=0;const token={dead:false},CANCEL=Symbol('cancel'),seen=[],state=new Float64Array(before);
 const context=vm.createContext({SketchlingEdits:E,reduceMotion,CANCEL,
  tutorialTool:()=>({move(x,y,o){contact=o.contact;assert(Number.isFinite(x)&&Number.isFinite(y));},remove(){removed=true;}}),
  toolTween:async(ms,tk,draw)=>{for(const t of frames){if(tk.dead)throw CANCEL;draw(t);}},wait:async()=>{}
 });vm.runInContext(player,context);
 try{await context.playToolActions(actions,'eraser',token,p=>p,(a,i)=>{
  if(!reduceMotion)assert(contact,'no graphite changes while tool is lifted');
  seen.push([actions.indexOf(a),i]);E.applyActionSample(state,goal,phases,w,h,a,i);
 },()=>{paintCount++;if(cancel)token.dead=true;});}catch(e){assert.equal(e,CANCEL);}
 assert(removed,'tool removed after completion or cancellation');
 assert.equal(new Set(seen.map(v=>v.join(':'))).size,seen.length,'never stamp a sample twice');
 if(!cancel)assert.deepEqual(state,expected,'playback matches reconstructed pass at every frame rate');
 else assert(seen.length<actions.reduce((n,a)=>n+a.points.length,0),'cancellation stops drawing');
 assert(paintCount>0);
}
await run([0,.02,.08,.21,.4,.69,.86,1]);
await run([0,.5,1]);
await run([1],true);
await run([0,.5,1],false,true);
console.log('Playback: contact only, frame-rate independent replay, reduced motion and cancellation passed.');
