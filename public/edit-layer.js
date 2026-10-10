// Pure pixel operations shared by the upload workspace and regression tests.
(function(root){
 const lum=(a,i)=>a[i]*.2126+a[i+1]*.7152+a[i+2]*.0722;
 function phaseAt(before,goal,i){const d=lum(goal,i)-lum(before,i);return d>5?0:d< -24?1:d< -5?2:-1;}
 function composite(before,target,w,h,r,scope=null){
  const goal=new Uint8ClampedArray(before),phases=new Int8Array(w*h).fill(-1);let changed=0;
  const x0=Math.max(0,Math.floor(r.x*w/100)),y0=Math.max(0,Math.floor(r.y*h/100)),x1=Math.min(w,Math.ceil((r.x+r.w)*w/100)),y1=Math.min(h,Math.ceil((r.y+r.h)*h/100));
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const i=(y*w+x)*4,edge=Math.min(x-x0,y-y0,x1-1-x,y1-1-y),a=Math.min(1,edge/4)*(scope?scope[y*w+x]:1)*target[i+3]/255;
   for(let c=0;c<3;c++)goal[i+c]=before[i+c]+(target[i+c]-before[i+c])*a;
   const p=phaseAt(before,goal,i);if(p<0){goal.set(before.subarray(i,i+4),i);continue;}phases[y*w+x]=p;changed++;
  }
  return {goal,phases,changed};
 }
 function plan(phases,w,h){
  const result=[[],[],[]];
  for(let p=0;p<3;p++)for(let y=0;y<h;y+=p===1?3:6){let start=-1;
   for(let x=0;x<=w;x++){
    let hit=false;if(x<w)for(let yy=Math.max(0,y-3);yy<Math.min(h,y+4);yy++)if(phases[yy*w+x]===p){hit=true;break;}
    if(hit&&start<0)start=x;
    if(start>=0&&(!hit||x-start>=24)){result[p].push([[start,y],[Math.max(start,x-1),y]]);start=hit?x:-1;}
   }
  }
  return result;
 }
 function stamp(state,goal,phases,w,h,x,y,r,p,strength=.65){
  for(let yy=Math.max(0,Math.floor(y-r));yy<Math.min(h,Math.ceil(y+r));yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<Math.min(w,Math.ceil(x+r));xx++){
   if(phases[yy*w+xx]!==p)continue;const d=Math.hypot(xx-x,yy-y)/r;if(d>=1)continue;const i=(yy*w+xx)*4;
   for(let c=0;c<3;c++)state[i+c]+=(goal[i+c]-state[i+c])*(1-d)*Math.max(0,Math.min(1,strength));
  }
 }
 function finish(state,goal,phases,p){for(let n=0;n<phases.length;n++)if(phases[n]===p)for(let c=0;c<3;c++)state[n*4+c]=goal[n*4+c];}
  function contours(mask,w,h,minArea=24){
  // Trace pixel-cell edges, preserving concavities and holes. No fitted boxes.
  const seen=new Uint8Array(mask.length),kept=new Uint8Array(mask.length);
  for(let n=0;n<mask.length;n++)if(mask[n]&&!seen[n]){const q=[n];seen[n]=1;for(let k=0;k<q.length;k++){const i=q[k],x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&mask[j]&&!seen[j]){seen[j]=1;q.push(j);}}if(q.length>=minArea)for(const i of q)kept[i]=1;}
  const edges=new Map(),key=(x,y)=>y*(w+1)+x;
  function add(x,y,xx,yy,d){const k=key(x,y);if(!edges.has(k))edges.set(k,[]);edges.get(k).push({x:xx,y:yy,d});}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!kept[i])continue;if(y===0||!kept[i-w])add(x,y,x+1,y,0);if(x===w-1||!kept[i+1])add(x+1,y,x+1,y+1,1);if(y===h-1||!kept[i+w])add(x+1,y+1,x,y+1,2);if(x===0||!kept[i-1])add(x,y+1,x,y,3);}
  const loops=[];
  while(edges.size){const start=edges.keys().next().value;let x=start%(w+1),y=(start/(w+1))|0,d=0;const pts=[[x,y]];let closed=false;
   for(let guard=0;guard<w*h*4;guard++){const k=key(x,y),options=edges.get(k);if(!options?.length)break;const priority=[(d+1)%4,d,(d+3)%4,(d+2)%4];options.sort((a,b)=>priority.indexOf(a.d)-priority.indexOf(b.d));const e=options.shift();if(!options.length)edges.delete(k);x=e.x;y=e.y;d=e.d;if(key(x,y)===start){closed=true;break;}pts.push([x,y]);}
   if(closed&&pts.length>=4){const simple=pts.filter((p,i)=>{const a=pts[(i+pts.length-1)%pts.length],b=pts[(i+1)%pts.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});loops.push(simple);}
  }
  return loops;
 }
 function shadowBoundaries(before,goal,w,h,r){
  const erase=new Uint8Array(w*h),shadow=new Uint8Array(w*h),seed=new Uint8Array(w*h);
  const x0=Math.max(0,Math.floor(r.x*w/100)),y0=Math.max(0,Math.floor(r.y*h/100)),x1=Math.min(w,Math.ceil((r.x+r.w)*w/100)),y1=Math.min(h,Math.ceil((r.y+r.h)*h/100));
  const smooth=(a,x,y)=>{let s=0,n=0;for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){s+=lum(a,(yy*w+xx)*4);n++;}return s/n;};
  const levels=[];for(let y=y0;y<y1;y+=3)for(let x=x0;x<x1;x+=3)levels.push(lum(goal,(y*w+x)*4));levels.sort((a,b)=>a-b);const paper=levels[Math.floor(levels.length*.85)]||200,cutoff=Math.max(35,paper-40);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const n=y*w+x,a=smooth(before,x,y),b=smooth(goal,x,y),d=b-a;erase[n]=d>8?1:0;shadow[n]=b<cutoff?1:0;seed[n]=d< -8?1:0;}
  // Keep entire connected target shadows only when their shape contains a
  // proposed darkening; outlines follow the target shadow, not a rectangle.
  const seen=new Uint8Array(w*h),selected=new Uint8Array(w*h);
  for(let n=0;n<shadow.length;n++)if(shadow[n]&&!seen[n]){const q=[n];seen[n]=1;let additions=0;for(let k=0;k<q.length;k++){const i=q[k];additions+=seed[i];const x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&shadow[j]&&!seen[j]){seen[j]=1;q.push(j);}}if(additions>=12)for(const i of q)selected[i]=1;}
  return {erase:contours(erase,w,h),eraseMask:erase,shadow:contours(selected,w,h),cutoff};
 }

  // Broad lightening regions: suppress paper grain before tracing any boundary.
 function boxMean(src,w,h,r){
  const sums=new Float64Array((w+1)*(h+1)),out=new Float32Array(w*h);
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=src[y*w+x];sums[(y+1)*(w+1)+x+1]=sums[y*(w+1)+x+1]+row;}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x0=Math.max(0,x-r),x1=Math.min(w,x+r+1),y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);out[y*w+x]=(sums[y1*(w+1)+x1]-sums[y0*(w+1)+x1]-sums[y1*(w+1)+x0]+sums[y0*(w+1)+x0])/((x1-x0)*(y1-y0));}return out;
 }
 function components(mask,w,h){
  const seen=new Uint8Array(mask.length),out=[];
  for(let n=0;n<mask.length;n++)if(mask[n]&&!seen[n]){const q=[n];seen[n]=1;for(let k=0;k<q.length;k++){const i=q[k],x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&mask[j]&&!seen[j]){seen[j]=1;q.push(j);}}out.push(q);}return out;
 }
 function polygonArea(pts){return pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;}
 function simplifyLoop(pts,tolerance=.8){
  // RDP on two arcs of the closed ring: <= tolerance from the traced edge.
  if(pts.length<=8)return pts;let far=1;for(let i=2;i<pts.length;i++)if(Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1])>Math.hypot(pts[far][0]-pts[0][0],pts[far][1]-pts[0][1]))far=i;
  function arc(p){const keep=new Uint8Array(p.length);keep[0]=keep[p.length-1]=1;const stack=[[0,p.length-1]];
   while(stack.length){const [a,b]=stack.pop(),u=p[a],v=p[b],dx=v[0]-u[0],dy=v[1]-u[1],den=dx*dx+dy*dy;let max=tolerance,index=-1;for(let i=a+1;i<b;i++){const t=den?Math.max(0,Math.min(1,((p[i][0]-u[0])*dx+(p[i][1]-u[1])*dy)/den)):0,d=Math.hypot(p[i][0]-u[0]-t*dx,p[i][1]-u[1]-t*dy);if(d>max){max=d;index=i;}}if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}}
   return p.filter((_,i)=>keep[i]);}
  const result=[...arc(pts.slice(0,far+1)).slice(0,-1),...arc([...pts.slice(far),pts[0]]).slice(0,-1)];return result.length>=4?result:pts;
 }
 function overallEraseRegions(before,goal,w,h,r){
  const x0=Math.max(0,Math.floor(r.x*w/100)),x1=Math.min(w,Math.ceil((r.x+r.w)*w/100)),y0=Math.max(0,Math.floor(r.y*h/100)),y1=Math.min(h,Math.ceil((r.y+r.h)*h/100));
  const short=Math.max(1,Math.min(x1-x0,y1-y0)),radius=Math.max(1,Math.min(10,Math.round(short*.02))),joinRadius=Math.max(1,Math.min(6,Math.round(short*.012))),regionArea=(x1-x0)*(y1-y0);
  const delta=new Float32Array(w*h);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*4;delta[y*w+x]=lum(goal,i)-lum(before,i);}
  const field=boxMean(boxMean(delta,w,h,radius),w,h,radius),mask=new Uint8Array(w*h);
  const positives=[];for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2)if(field[y*w+x]>5)positives.push(field[y*w+x]);positives.sort((a,b)=>a-b);
  const threshold=Math.max(9,(positives[Math.floor(positives.length*.9)]||0)*.42),strongThreshold=Math.max(16,threshold*1.4);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)mask[y*w+x]=field[y*w+x]>threshold?1:0;
  // Close only tiny cracks. Never draw a hull across separated facial features.
  const expanded=Uint8Array.from(boxMean(mask,w,h,joinRadius),v=>v>0?1:0),closedMean=boxMean(expanded,w,h,joinRadius),closed=new Uint8Array(w*h);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)closed[y*w+x]=closedMean[y*w+x]>.999?1:0;
  const minArea=Math.max(40,regionArea*.0025),candidates=[];
  for(const cells of components(closed,w,h)){
   if(cells.length<minArea)continue;let strong=0,energy=0;for(const i of cells){if(field[i]>strongThreshold)strong++;energy+=Math.max(0,field[i]);}
   if(strong<Math.max(12,cells.length*.08))continue;
   const cm=new Uint8Array(w*h);for(const i of cells)cm[i]=1;
   const raw=contours(cm,w,h,1),outer=raw.filter(p=>polygonArea(p)>0),holes=raw.filter(p=>polygonArea(p)<0&&Math.abs(polygonArea(p))>=Math.max(100,cells.length*.025));
   if(!outer.length)continue;
   const loops=[...outer,...holes].map(p=>simplifyLoop(p,1.2));
   let cx=0,cy=0,bx0=w,by0=h,bx1=0,by1=0;for(const i of cells){const x=i%w,y=(i/w)|0;cx+=x;cy+=y;bx0=Math.min(bx0,x);by0=Math.min(by0,y);bx1=Math.max(bx1,x);by1=Math.max(by1,y);}
   candidates.push({loops,area:cells.length,energy,center:[cx/cells.length,cy/cells.length],bounds:{x:bx0,y:by0,w:bx1-bx0+1,h:by1-by0+1},clipped:bx0<=x0||by0<=y0||bx1>=x1-1||by1>=y1-1});
  }
  candidates.sort((a,b)=>b.energy-a.energy);const best=candidates[0]?.energy||0;
  return candidates.filter((c,i)=>i<4&&c.energy>=best*.12);
 }

  function maskForRegion(region,w,h){
  // Rasterize the displayed polygon, including its protected islands, using
  // even-odd scanlines. Demonstrations stay inside the guide the student sees.
  const mask=new Uint8Array(w*h),loops=region.loops;
  for(let y=Math.max(0,Math.floor(region.bounds.y));y<Math.min(h,Math.ceil(region.bounds.y+region.bounds.h+1));y++){
   const yy=y+.5,hits=[];for(const loop of loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[j],b=loop[i];if((a[1]>yy)!==(b[1]>yy))hits.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }hits.sort((a,b)=>a-b);
   for(let i=0;i+1<hits.length;i+=2)for(let x=Math.max(0,Math.ceil(hits[i]-.5));x<Math.min(w,Math.ceil(hits[i+1]-.5));x++)mask[y*w+x]=1;
  }return mask;
 }
 // One pressure envelope per moving stroke; samples are independent of frame rate.
 function strokePressure(t){return .12+.76*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.7);}
 function strokeActions(path,kind,radius,maxLength=30){
  const pts=[path[0]];
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));for(let j=1;j<=n;j++)pts.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
  const out=[];for(let i=0;i<pts.length-1;i+=maxLength-4){const points=pts.slice(i,i+maxLength+1);if(points.length<3)break;out.push({type:'stroke',kind,points,radius,strength:kind==='eraser'?.16:.18});}return out;
 }
 function applyActionSample(state,goal,phases,w,h,action,index){
  const [x,y]=action.points[index],pressure=strokePressure(index/Math.max(1,action.points.length-1));
  stamp(state,goal,phases,w,h,x,y,action.radius,0,action.strength*pressure);
 }
 // Display only the pixels belonging to the requested view. The proposal is
 // never a substitute for the strokes applied by the demonstration.
 function displayPixels(edit,view='after'){
  if(view==='proposal')return edit.goal;
  if(view==='after')return edit.state||edit.before;
  return edit.before;
 }
 function applyPass(state,goal,w,h,pass){
  for(let a=0;a<pass.actions.length;a++)for(let i=0;i<(pass.applied?.[a]??pass.actions[a].points.length);i++)applyActionSample(state,goal,pass.phases,w,h,pass.actions[a],i);
 }
 function reconstruct(before,goal,w,h,passes,except=null){
  const state=new Float64Array(before);for(const [key,pass]of passes)if(key!==except)applyPass(state,goal,w,h,pass);return state;
 }
 function contourBand(paths,w,h,radius=35){
  const mask=new Float32Array(w*h),feather=Math.min(8,radius/3);
  for(const points of paths)for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
   for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1])-radius));y<Math.min(h,Math.ceil(Math.max(a[1],b[1])+radius));y++)for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0])-radius));x<Math.min(w,Math.ceil(Math.max(a[0],b[0])+radius));x++){
    const t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den)):0,d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
    if(d<radius)mask[y*w+x]=Math.max(mask[y*w+x],Math.min(1,(radius-d)/feather));
   }
  }return mask;
 }
 function teachingPlan(before,goal,w,h,region,kind){
  const mask=maskForRegion(region,w,h),phases=new Int8Array(w*h).fill(-1),weight=new Float32Array(w*h),covered=new Uint8Array(w*h);
  const radius=kind==='eraser'?4:3.5,b=region.bounds;let count=0;
  for(let n=0;n<mask.length;n++)if(mask[n]){const d=(lum(goal,n*4)-lum(before,n*4))*(kind==='eraser'?1:-1);if(d>5){phases[n]=0;weight[n]=d;count++;}}
  // Local weighted covariance follows the long direction of the excess mark.
  // Broad, directionless tone uses a consistent light pass; never isolated dots.
  function direction(x,y,previous){
   let mass=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
   for(let dy=-10;dy<=10;dy+=2)for(let dx=-10;dx<=10;dx+=2){const xx=Math.round(x+dx),yy=Math.round(y+dy);if(xx<0||yy<0||xx>=w||yy>=h)continue;const v=weight[yy*w+xx];mass+=v;sx+=v*dx;sy+=v*dy;sxx+=v*dx*dx;syy+=v*dy*dy;sxy+=v*dx*dy;}
   if(!mass)return previous;const xx=sxx/mass-(sx/mass)**2,yy=syy/mass-(sy/mass)**2,xy=sxy/mass-sx*sy/(mass*mass),coherence=Math.hypot(xx-yy,2*xy)/(xx+yy+1e-6);
   if(coherence<.18)return previous;
   const angle=.5*Math.atan2(2*xy,xx-yy);let vx=Math.cos(angle),vy=Math.sin(angle);if(vx*previous[0]+vy*previous[1]<0){vx=-vx;vy=-vy;}
   vx=.65*previous[0]+.35*vx;vy=.65*previous[1]+.35*vy;const len=Math.hypot(vx,vy);return [vx/len,vy/len];
  }
  const candidates=[];
  for(let y=Math.max(0,Math.ceil(b.y));y<Math.min(h,b.y+b.h);y+=6)for(let x=Math.max(0,Math.ceil(b.x));x<Math.min(w,b.x+b.w);x+=6){
   let best=-1;for(let yy=Math.max(0,y-3);yy<=Math.min(h-1,y+3);yy++)for(let xx=Math.max(0,x-3);xx<=Math.min(w-1,x+3);xx++){const n=yy*w+xx;if(weight[n]>(best<0?5:weight[best]))best=n;}
   if(best>=0)candidates.push({x:best%w,y:(best/w)|0,score:weight[best]});
  }
  candidates.sort((a,b)=>b.score-a.score);const actions=[];let last=null,anchor=null;
  while(candidates.length&&actions.length<(kind==='eraser'?32:40)){
   let best=-1,score=-Infinity;
   for(let i=0;i<candidates.length;i++){const c=candidates[i];if(covered[c.y*w+c.x])continue;
    // Finish a nearby patch before moving elsewhere. One demonstration is local.
    if(anchor&&Math.hypot(c.x-anchor[0],c.y-anchor[1])>90)continue;
    const value=c.score/(1+(last?Math.hypot(c.x-last[0],c.y-last[1])/12:0));if(value>score){score=value;best=i;}}
   if(best<0)break;const c=candidates.splice(best,1)[0],fallback=b.h>b.w?[0,1]:[1,0];let dir=fallback;for(let i=0;i<5;i++)dir=direction(c.x,c.y,dir);
   function extend(sign){const points=[];let x=c.x,y=c.y,v=[dir[0]*sign,dir[1]*sign];for(let i=0;i<15;i++){v=direction(x,y,v);x+=v[0];y+=v[1];const xx=Math.round(x),yy=Math.round(y);if(xx<0||yy<0||xx>=w||yy>=h||phases[yy*w+xx]!==0)break;points.push([x,y]);}return points;}
   const points=[...extend(-1).reverse(),[c.x,c.y],...extend(1)];
   if(points.length<8){covered[c.y*w+c.x]=1;continue;}
   if(last&&Math.hypot(points.at(-1)[0]-last[0],points.at(-1)[1]-last[1])<Math.hypot(points[0][0]-last[0],points[0][1]-last[1]))points.reverse();
   actions.push({type:'stroke',kind,points,radius,strength:kind==='eraser'?.16:.18});last=points.at(-1);anchor??=[c.x,c.y];
   for(const [x,y]of points)for(let yy=Math.max(0,Math.floor(y-radius));yy<Math.min(h,y+radius);yy++)for(let xx=Math.max(0,Math.floor(x-radius));xx<Math.min(w,x+radius);xx++)if(Math.hypot(xx-x,yy-y)<radius)covered[yy*w+xx]=1;
  }
  return {mask,phases,actions,affectedPixels:count};
 }
 function tutorialRegions(before,goal,w,h,r,kind){return kind==='eraser'?overallEraseRegions(before,goal,w,h,r):overallEraseRegions(goal,before,w,h,r);}

 root.SketchlingEdits={composite,plan,stamp,finish,contours,shadowBoundaries,overallEraseRegions,simplifyLoop,maskForRegion,teachingPlan,tutorialRegions,strokePressure,strokeActions,applyActionSample,displayPixels,applyPass,reconstruct,contourBand};
})(globalThis);
