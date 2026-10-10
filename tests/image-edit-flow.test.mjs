import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
await import('../public/edit-layer.js');
await import('../public/edit-validation.js');
const E=globalThis.SketchlingEdits,V=globalThis.SketchlingValidation;
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const pixels=v=>{const a=new Uint8ClampedArray(1000*1000*4);for(let n=0;n<1000*1000;n++)a.set([v,v,v,255],n*4);return a;};
class Canvas {
 constructor(p=pixels(255)){this.p=p;}
 getContext(){const c=this;return {
  getImageData:()=>({data:new Uint8ClampedArray(c.p)}),putImageData:d=>{c.p=new Uint8ClampedArray(d.data);},
  clearRect:()=>c.p.fill(0),drawImage:img=>{c.p.set(img.p);}
 };}
 toDataURL(){return 'data:image/png;base64,YQ==';}
}
const before=pixels(200),previousGoal=pixels(210),previousState=new Float64Array(before);
const f={kind:'uploadedEdit',featureName:'right ear',label:'Move the right ear right',why:'',refWarpUrl:'reference',
 region:{x:78,y:32,w:18,h:29},editScopeLoops:[[[84,35],[91,35],[91,58],[84,58]],[[81,35],[88,35],[88,58],[81,58]]],editScopeRadius:1,
 base:{canvas:new Canvas(before)},goal:previousGoal,state:previousState};
let output=pixels(200),size=[1024,1024],sent=null,error='',view='',canvases=[];
class TestImage {set src(url){this.p=url==='generated'?output:before;this.naturalWidth=size[0];this.naturalHeight=size[1];}async decode(){}}
const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},classList:{toggle(){}}});return nodes.get(id);};
const context=vm.createContext({SketchlingEdits:E,SketchlingValidation:V,Uint8ClampedArray,Float64Array,AbortController,Image:TestImage,$,
 editButton:{},session:{fixes:[f],cur:0},busy:false,stageTk:{dead:false},drawFile:{},refFile:{},ctl:null,
 stopJawPicker(){},newToken:()=>({dead:false}),setBusy(v){context.busy=v;},showErr:s=>{error=s;},
 clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),num:(n,d=0)=>Number.isFinite(+n)?+n:d,
 blankSheet:()=>{const c=new Canvas();canvases.push(c);return c;},
 fetch:async(url,req)=>{sent=JSON.parse(req.body);return {ok:true,json:async()=>({image:'generated'})};},
 renderInstructionGuide(){},renderChips(){},setInset(){},setView:s=>{view=s;},updateButtons(){}
});
vm.runInContext(html.slice(html.indexOf('editButton.onclick='),html.indexOf('let jawPicker=')),context);
// The screenshot's failure: a central rectangular block, even though the ear
// is selected. Reject raw output before committing a new goal or stroke state.
for(let y=350;y<580;y++)for(let x=290;x<690;x++)output.set([0,0,0,255],(y*1000+x)*4);
await context.editButton.onclick();
assert.match(error,/solid black block/);assert.strictEqual(f.goal,previousGoal);assert.strictEqual(f.state,previousState);assert.equal(view,'');
assert.match(sent.reason,/Move the right ear right/);assert.equal(sent.feature,'right ear');
assert.equal(canvases[0].p[(450*1000+500)*4+3],255,'request mask protects middle of face');
assert.equal(canvases[0].p[(450*1000+820)*4+3],0,'request mask includes original ear');
assert.equal(canvases[0].p[(450*1000+900)*4+3],0,'request mask includes proposed ear');
assert.equal(context.busy,false);
output=pixels(200);output[(450*1000+850)*4+3]=0;
await context.editButton.onclick();assert.match(error,/transparent/);assert.strictEqual(f.goal,previousGoal);
output=pixels(200);size=[1024,768];await context.editButton.onclick();assert.match(error,/image size/);assert.strictEqual(f.state,previousState);
// A legitimate local tone change must still be accepted.
size=[1024,1024];output=pixels(200);
for(let y=380;y<550;y++)for(let x=840;x<900;x++)output.set([140,140,140,255],(y*1000+x)*4);
await context.editButton.onclick();assert.equal(error,'');assert.equal(view,'proposal');assert.equal(f.goal[(450*1000+860)*4],140);assert.equal(f.goal[(450*1000+500)*4],200);
assert.deepEqual(new Uint8ClampedArray(f.state),before,'accepting a proposal applies no demonstration strokes');
// The production brow playback handler cannot call the generic planner.
context.document={querySelectorAll:()=>[]};context.clearShade=()=>{};context.syncCurrentInstruction=()=>{};context.selectDrawingView=()=>{};context.paintUploadedEdit=()=>{};context.eraseRegionControls={hidden:false};
context.SketchlingEdits={...E,tutorialRegions(){throw new Error('Generic planner must not run for brows');}};
vm.runInContext(html.slice(html.indexOf('async function playUploadedEdit('),html.indexOf('editButton.onclick=')),context);
await context.playUploadedEdit({...f,featureName:'right brow'},1,{dead:false});assert.match($('visualCaption').textContent,/hair direction/);
// Exercise the real server handler with a mocked upstream, not a paid API call.
const server=await readFile(new URL('../server.js',import.meta.url),'utf8');let payload=null,reply=null;
const serverContext=vm.createContext({process:{env:{OPENAI_API_KEY:'test-key',OPENAI_IMAGE_MODEL:'configured-image-model'}},AbortController,setTimeout,clearTimeout,
 readBody:async()=>JSON.stringify(sent),send:(res,status,data)=>{reply={status,data};},
 fetch:async(url,request)=>{payload=JSON.parse(request.body);return {ok:true,json:async()=>({data:[{b64_json:'YQ=='}]})};}
});
vm.runInContext(server.slice(server.indexOf('async function handleImageEdit('),server.indexOf('async function handleStatic(')),serverContext);
await serverContext.handleImageEdit({}, {on(){},writableEnded:false,destroyed:false});
assert.equal(reply.status,200);assert.equal(payload.model,'configured-image-model');assert.equal(payload.background,'opaque');assert.match(payload.prompt,/Move the right ear right/);assert.match(payload.prompt,/Do not render the mask/);
assert.equal(payload.images[0].image_url,sent.drawing);assert.equal(payload.mask.image_url,sent.mask);
console.log('Image-edit request, artifact rejection without state loss, valid acceptance, brow playback guard and server payload passed (mocked API/DOM).');
