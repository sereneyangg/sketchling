(function(root){
 function words(e){
  if(e.type==='check')return `Let's look at ${e.the||e.name}. Notice where the outlines separate. Nothing changes yet.`;
  const intro=[e.text,e.detail].filter(Boolean).join('. ')+'. ';
  if(e.type==='tone')return intro+(e.kind==='darken'?'Watch the pencil build up a little tone here. Keep the light area open.':'Watch the eraser gently lift this area. Stop and compare before taking more away.');
  if(e.type==='detail')return intro+({blend:'Now watch the blending tool soften these rough marks.',highlight:'Now watch the eraser pick out this small highlight.',edge:'Now watch the pencil clean up this edge.',accent:'Now watch the pencil add this small dark accent.',shadow:'Now watch the pencil build this shadow with a few light strokes.'}[e.kind]||'Now watch this small area change.');
  return intro+'Watch the line move into place, then compare it with your reference.';
 }
 function create({synth=root.speechSynthesis,Utterance=root.SpeechSynthesisUtterance,onError=()=>{},setTimer=setInterval,clearTimer=clearInterval}={}){
  const supported=!!(synth&&Utterance);let enabled=false,pending=null,paused=false,selectedVoice='',voicesChanged=()=>{};
  const voiceId=v=>`${v.voiceURI||v.name}|${v.lang}`;
  const listVoices=()=>supported&&typeof synth.getVoices==='function'?synth.getVoices().filter(v=>/^en(?:-|_)/i.test(v.lang)):[];
  const chooseVoice=()=>{
   const voices=listVoices();
   if(selectedVoice){const chosen=voices.find(v=>voiceId(v)===selectedVoice);if(chosen)return chosen;}
   const natural=voices.find(v=>/natural|neural|enhanced|premium/i.test(v.name));if(natural)return natural;
   const preferred=['Microsoft Jenny','Samantha','Ava','Google US English','Karen'];
   return preferred.reduce((found,name)=>found||voices.find(v=>v.name.toLowerCase().includes(name.toLowerCase())),null)
    || voices.find(v=>/^en(-|_)(us|gb)/i.test(v.lang))||voices[0]||null;
  };
  if(supported&&typeof synth.addEventListener==='function')synth.addEventListener('voiceschanged',()=>voicesChanged());
  function cancel(){const p=pending;pending=null;if(p){clearTimer(p.timer);p.utterance.onend=p.utterance.onerror=null;p.resolve();}if(supported)try{synth.cancel();}catch{}paused=false;}
  function speak(text,{preview=false}={}){
   cancel();if((!enabled&&!preview)||!supported||!text)return Promise.resolve();
   return new Promise(resolve=>{
    const u=new Utterance(text),p={utterance:u,resolve,timer:null,elapsed:0};pending=p;u.lang='en-US';u.rate=1;u.pitch=1.1;u.volume=.96;u.voice=chooseVoice();
    const finish=failed=>{if(pending!==p)return;cancel();if(failed)onError();};
    u.onend=()=>finish(false);u.onerror=()=>finish(true);
    // Missing browser speech events must never leave the lesson waiting forever.
    p.timer=setTimer(()=>{if(!paused)p.elapsed+=250;if(p.elapsed>=45000)finish(true);},250);
    try{synth.resume();synth.speak(u);}catch{finish(true);}
   });
  }
  return {supported,get enabled(){return enabled;},setEnabled(value){enabled=!!value&&supported;if(!enabled)cancel();},speak,cancel,
   listVoices(){return listVoices().map(v=>({id:voiceId(v),name:v.name,lang:v.lang}));},
   setVoice(id){selectedVoice=id;},onVoicesChanged(callback){voicesChanged=callback;},
   pause(){paused=true;if(pending)try{synth.pause();}catch{}},
   resume(){paused=false;if(pending)try{synth.resume();}catch{cancel();onError();}}
  };
 }
 root.SketchlingLessonVoice={create,words};
})(globalThis);
