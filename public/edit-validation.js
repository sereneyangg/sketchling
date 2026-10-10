// Keep feature selection and generated-image acceptance separate from playback.
(function(root){
 const paired=n=>/\b(eye|eyes|brow|brows|eyebrow|eyebrows|ear|ears)\b/i.test(n);
 const groupKey=n=>paired(n)?n.toLowerCase().trim():n.toLowerCase().replace(/\b(left|right)\b/g,'').trim();
 const correctionReason=f=>[f.label,f.why].filter(Boolean).join('. ');
 function demonstrationIssue(f){
  return f?.kind==='uploadedEdit'&&/brow/i.test(f.featureName||f.label||'')
   ? 'Brow stroke demonstration is paused: hair direction has not been established. Compare Original, AI proposal and Reference before changing your drawing.' : '';
 }
 function featureScope(evs,T,isConfident){
  const name=evs[0]?.name||'';
  if(!paired(name))return {};
  const fail={editScopeError:'A separate, closed outline for this feature was not established. Analyze again before creating this edit.'};
  if(evs.length!==1||!evs[0].feature.closed)return fail;
  const ev=evs[0],loops=[ev.feature.pts.map(T)];
  if(isConfident(ev)&&ev.drawingContour)loops.push(ev.drawingContour);
  const maxHeight=/brow|eye/i.test(name)?22:45;
  for(const pts of loops){
   if(pts.length<3||pts.some(p=>!p.every(Number.isFinite)))return fail;
   const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
   const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
   const area=Math.abs(pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
   if(width>35||height>maxHeight||area<.1)return fail;
  }
  return {editScopeLoops:loops,editScopeRadius:1};
 }
 function scopeMask(f,w,h){
  if(f.editScopeError)throw new Error(f.editScopeError);
  const E=root.SketchlingEdits,scale=path=>path.map(p=>[p[0]*w/100,p[1]*h/100]);
  if(f.editScopeLoops?.length){
   const mask=new Float32Array(w*h);
   // Union each closed silhouette independently: never fill the space between
   // two disjoint features, and never cancel overlapping old/new silhouettes.
   for(const loop of f.editScopeLoops){
    const pts=scale(loop),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    const bounds={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
    const inside=E.maskForRegion({loops:[pts],bounds},w,h);
    const edge=E.contourBand([[...pts,pts[0]]],w,h,f.editScopeRadius*Math.min(w,h)/100);
    for(let n=0;n<mask.length;n++)mask[n]=Math.max(mask[n],inside[n],edge[n]);
   }
   return mask;
  }
  if(paired(f.featureName||''))throw new Error('This feature needs its own closed outline. Analyze again before creating this edit.');
  return f.editScopePaths?.length?E.contourBand(f.editScopePaths.map(scale),w,h,f.editScopeRadius*Math.min(w,h)/100):null;
 }
 function validateDimensions(w,h){
  if(!Number.isFinite(w)||!Number.isFinite(h)||w!==h||w<256)throw new Error('The image editor returned an unexpected image size. The edit was not applied.');
 }
 function validateOutput(before,target,w,h){
  if(before.length!==w*h*4||target.length!==before.length)throw new Error('Incomplete image data. The edit was not applied.');
  const dark=new Uint8Array(w*h),newDark=new Uint8Array(w*h),seen=new Uint8Array(w*h);
  for(let n=0;n<dark.length;n++){
   const i=n*4;
   if(target[i+3]<250)throw new Error('The image editor returned transparent pixels instead of drawing paper. The edit was not applied.');
   const t=Math.max(target[i],target[i+1],target[i+2]),b=(before[i]+before[i+1]+before[i+2])/3;
   dark[n]=t<=12?1:0;newDark[n]=dark[n]&&b-t>40?1:0;
  }
  const minArea=Math.max(64,w*h*.0008),minSide=Math.max(8,Math.min(w,h)*.01);
  for(let n=0;n<dark.length;n++)if(dark[n]&&!seen[n]){
   const q=[n];seen[n]=1;let x0=w,x1=0,y0=h,y1=0,additions=0;
   for(let k=0;k<q.length;k++){
    const i=q[k],x=i%w,y=(i/w)|0;additions+=newDark[i];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&dark[j]&&!seen[j]){seen[j]=1;q.push(j);}
   }
   const bw=x1-x0+1,bh=y1-y0+1;
   if(q.length>=minArea&&bw>=minSide&&bh>=minSide&&q.length/(bw*bh)>.94&&additions/q.length>.5)
    throw new Error('The generated image contains a new solid black block. The edit was rejected; your drawing and any previous edit are unchanged.');
  }
 }
 root.SketchlingValidation={groupKey,correctionReason,demonstrationIssue,featureScope,scopeMask,validateDimensions,validateOutput};
})(globalThis);
