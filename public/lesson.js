// Layers of teaching: V1 shape and proportion, V2 light and shadow, V3 details and finishing.
// One edit plan drives everything: the checklist wording, the tool's path and the pixels.
// Coordinates are sheet units (0-100 across the square sheet); images are W×W pixels.
(function(root){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

 // Per-axis least squares: target = a*drawn + b. Maps the student's line onto the reference's.
 function axisFit(D,G,k){
  const xs=D.map(p=>p[k]),ys=G.map(p=>p[k]),mx=mean(xs),my=mean(ys);
  let sxy=0,sxx=0;for(let i=0;i<xs.length;i++){sxy+=(xs[i]-mx)*(ys[i]-my);sxx+=(xs[i]-mx)**2;}
  const a=sxx>1e-6?clamp(sxy/sxx,.5,1.6):1;return {a,b:my-a*mx};
 }

 // Distance from a point to a polyline (closed or open).
 function polyDist(pts,closed,x,y){
  let best=Infinity;const n=pts.length,m=closed?n:n-1;
  for(let i=0;i<m;i++){const a=pts[i],b=pts[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
   const t=den?clamp(((x-a[0])*dx+(y-a[1])*dy)/den,0,1):0,d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(d<best)best=d;}
  return best;
 }
 function inside(pts,x,y){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}

 // Plain-language size, measured in eye-widths the way artists measure a face.
 function amount(units,eyeW){
  if(!(eyeW>0))return units<2?'slightly':'';
  const f=units/eyeW;
  if(f<.18)return 'a little';
  const q=Math.round(f*4)/4;
  if(q<=.25)return 'about a quarter of an eye-width';
  if(q<=.5)return 'about half an eye-width';
  if(q<=.75)return 'about three-quarters of an eye-width';
  if(q<=1.25)return 'about one eye-width';
  return `about ${Math.round(f*2)/2} eye-widths`;
 }
 const sideOf=name=>/\bleft\b/i.test(name)?'left':/\bright\b/i.test(name)?'right':'';

 // Words come from the same numbers that move the pixels.
 function describe(edit,faceCx,eyeW){
  const {D,G,name}=edit,X=a=>a.map(p=>p[0]),Y=a=>a.map(p=>p[1]);
  const dx=mean(X(G))-mean(X(D)),dy=mean(Y(G))-mean(Y(D));
  const wD=Math.max(...X(D))-Math.min(...X(D)),hD=Math.max(...Y(D))-Math.min(...Y(D));
  const dw=wD*(edit.A.x.a-1),dh=hD*(edit.A.y.a-1),the='the '+name.toLowerCase(),eye=/eye/i.test(name);
  const cx=mean(X(D)),side=sideOf(name),outward=side&&Math.sign(dx)===Math.sign(cx-faceCx);
  const opts=[
   {m:Math.abs(dw),verb:dw>0?'Widen':'Narrow',obj:the},
   {m:Math.abs(dh),verb:eye?(dh>0?'Open up':'Flatten'):(dh>0?'Lengthen':'Shorten'),obj:the},
   {m:Math.abs(dy),verb:dy>0?'Lower':'Raise',obj:the},
   {m:Math.abs(dx),verb:'Move',obj:the+(side?(outward?' outward':' inward'):(dx<0?' to the left':' to the right'))},
  ].sort((a,b)=>b.m-a.m);
  const top=opts[0],next=opts[1],total=Math.hypot(dx,dy)+Math.max(Math.abs(dw),Math.abs(dh))/2;
  if(top.m<total*.45)return {text:`Adjust the curve of ${the}`,detail:`It drifts ${amount(edit.maxShift,eyeW)} from the reference in places`,kind:'reshape'};
  const by=amount(top.m,eyeW),detail=by?(by==='a little'||by==='slightly'?`Just ${by}`:`By ${by}`):'';
  // two clear changes of different kinds (a move and a resize): say both
  const isMove=v=>/^(Lower|Raise|Move)$/.test(v),simple=v=>v!=='Move';
  if(next.m>=top.m*.6&&next.m>=1&&isMove(top.verb)!==isMove(next.verb)&&simple(top.verb)&&simple(next.verb))
   return {text:`${top.verb} and ${next.verb.toLowerCase()} ${the}`,detail,kind:'combined'};
  return {text:`${top.verb} ${top.obj}`,detail,kind:top.verb.toLowerCase()};
 }

 // One shape edit. D = where the student drew the feature, G = where the reference puts it (same points, same order).
 function shapeEdit({name,closed,D,G},opts={}){
  const A={x:axisFit(D,G,0),y:axisFit(D,G,1)};
  const to=p=>[A.x.a*p[0]+A.x.b,A.y.a*p[1]+A.y.b];
  const shifts=D.map(p=>{const q=to(p);return Math.hypot(q[0]-p[0],q[1]-p[1]);});
  const maxShift=Math.max(...shifts),meanShift=mean(shifts);
  const xs=D.map(p=>p[0]),ys=D.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
  // The area that moves: the drawn feature plus a soft margin, so nearby features stay put.
  const core=closed?clamp(Math.min(w,h)*.25,.8,2.5):clamp(opts.band??2.2,1,3.5);
  const feather=clamp(maxShift*1.4+1.5,2.5,closed?Math.max(3,Math.min(w,h)*.6):5);
  const reach=core+feather+maxShift;
  const box={x0:clamp(Math.min(...xs)-reach,0,100),y0:clamp(Math.min(...ys)-reach,0,100),x1:clamp(Math.max(...xs)+reach,0,100),y1:clamp(Math.max(...ys)+reach,0,100)};
  const allX=[...xs,...G.map(p=>p[0])],allY=[...ys,...G.map(p=>p[1])];
  const region={x:Math.min(...allX)-3,y:Math.min(...allY)-3,w:Math.max(...allX)-Math.min(...allX)+6,h:Math.max(...allY)-Math.min(...allY)+6};
  return {id:opts.id||name,stage:1,name,closed,D,G,A,maxShift,meanShift,core,feather,box,region,size:Math.max(w,h)};
 }
 function weightAt(edit,x,y){
  const d=edit.closed&&inside(edit.D,x,y)?0:polyDist(edit.D,edit.closed,x,y);
  const t=clamp((d-edit.core)/edit.feather,0,1);return 1-t*t*(3-2*t);
 }
 function displacement(edit,x,y){return [edit.A.x.a*x+edit.A.x.b-x,edit.A.y.a*y+edit.A.y.b-y];}

 // The weight field never changes during an edit, so compute it once per edit.
 function prepare(edit,W){
  const s=W/100,x0=Math.max(0,Math.floor(edit.box.x0*s)),y0=Math.max(0,Math.floor(edit.box.y0*s));
  const x1=Math.min(W,Math.ceil(edit.box.x1*s)),y1=Math.min(W,Math.ceil(edit.box.y1*s)),w=x1-x0,h=y1-y0;
  const weight=new Float32Array(w*h),step=Math.max(1,Math.round(s/4));
  // coarse grid then nearest lookup: distance work stays small even for long contours
  const gw=Math.ceil(w/step),gh=Math.ceil(h/step),grid=new Float32Array(gw*gh);
  for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++)grid[gy*gw+gx]=weightAt(edit,(x0+(gx+.5)*step)/s,(y0+(gy+.5)*step)/s);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)weight[y*w+x]=grid[Math.min(gh-1,(y/step)|0)*gw+Math.min(gw-1,(x/step)|0)];
  return {x0,y0,w,h,weight,s};
 }
 // Pull the student's own pixels along the plan. t=0: untouched, t=1: the full correction.
 function warp(src,dst,W,edit,prep,t){
  const {x0,y0,w,h,weight,s}=prep,ax=edit.A.x,ay=edit.A.y;
  const wAt=(px,py)=>{const xx=Math.round(px)-x0,yy=Math.round(py)-y0;return xx<0||yy<0||xx>=w||yy>=h?0:weight[yy*w+xx];};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const X=x0+x+.5,Y=y0+y+.5;
   // backward mapping: find where this pixel's content came from (two fixed-point steps)
   let sx=X,sy=Y;
   for(let k=0;k<2;k++){const wt=wAt(sx-.5,sy-.5)*t,ux=sx/s,uy=sy/s;sx=X-wt*(ax.a*ux+ax.b-ux)*s;sy=Y-wt*(ay.a*uy+ay.b-uy)*s;}
   const fx=clamp(sx-.5,0,W-1.001),fy=clamp(sy-.5,0,W-1.001),ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,o=((y0+y)*W+x0+x)*4;
   for(let c=0;c<4;c++){
    const p=(yy,xx)=>src[((iy+yy)*W+ix+xx)*4+c];
    dst[o+c]=(p(0,0)*(1-tx)+p(0,1)*tx)*(1-ty)+(p(1,0)*(1-tx)+p(1,1)*tx)*ty;
   }
  }
 }
 // Where the tool sits at progress t: on the moving line, sweeping along it once.
 function toolPoint(edit,t){
  const n=edit.D.length,f=clamp(t,0,1)*(n-1),i=Math.min(n-2,Math.floor(f)),u=f-i;
  const at=k=>{const p=edit.D[k],q=[edit.A.x.a*p[0]+edit.A.x.b,edit.A.y.a*p[1]+edit.A.y.b];return [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];};
  if(n<2)return at(0);const a=at(i),b=at(i+1);return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
 }

 // The aperture rule: an edge only shows movement across itself. A shape made of mostly vertical
 // edges (an ear) can't show a vertical shift, so that part of a measured shift is dropped.
 function measurableShift(G,closed,t){
  let xx=0,yy=0,xy=0;const n=G.length,m=closed?n:n-1;
  for(let i=0;i<m;i++){const a=G[i],b=G[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(!L)continue;
   const nx=-dy/L,ny=dx/L;xx+=nx*nx*L;yy+=ny*ny*L;xy+=nx*ny*L;}
  const tr=xx+yy;if(!tr)return t;
  const d=Math.sqrt(((xx-yy)/2)**2+xy*xy),l1=tr/2+d,l2=tr/2-d,ang=.5*Math.atan2(2*xy,xx-yy);
  const e1=[Math.cos(ang),Math.sin(ang)],e2=[-e1[1],e1[0]];
  const keep=clamp((l2/l1-.1)/.25,0,1);               // weak direction: none below ~1:10, full from ~1:3
  const p1=t[0]*e1[0]+t[1]*e1[1],p2=(t[0]*e2[0]+t[1]*e2[1])*keep;
  return [p1*e1[0]+p2*e2[0],p1*e1[1]+p2*e2[1]];
 }
 // Choose V1's edits: only clear, plausible measurements, in teaching order, one per feature.
 const ORDER=[/jaw|face|chin|head/i,/eye/i,/nose/i,/mouth|lip/i,/brow/i,/ear/i];
 function planShapeStage(features,{faceCx=50,eyeW=0,thr=1.5,max=5}={}){
  const edits=[];
  for(const f of features){
   if(!f||/hair/i.test(f.name)||f.D.length<3||!f.confident)continue;
   let D=f.D,shiftOnly=f.shiftOnly;
   // a resize beyond ~20% is more likely a mismatch than a drawing error: fall back to the plain shift
   if(!shiftOnly&&f.Dshift){const ax=axisFit(f.D,f.G,0).a,ay=axisFit(f.D,f.G,1).a;if(Math.max(Math.abs(ax-1),Math.abs(ay-1))>.2){shiftOnly=true;D=f.Dshift;}}
   if(shiftOnly){                                     // a pure shift: keep only what the edges can show
    const t=[mean(D.map((p,i)=>p[0]-f.G[i][0])),mean(D.map((p,i)=>p[1]-f.G[i][1]))],u=measurableShift(f.G,f.closed,t);
    D=f.G.map(p=>[p[0]+u[0],p[1]+u[1]]);
   }
   const e=shapeEdit({...f,D},{id:f.name});
   // a correction larger than a third of the feature is more likely a mismatch than a mistake
   if(e.meanShift<thr||e.meanShift>Math.max(3,e.size*.35))continue;
   Object.assign(e,describe(e,faceCx,eyeW));edits.push(e);
  }
  const rank=e=>{const i=ORDER.findIndex(r=>r.test(e.name));return i<0?ORDER.length:i;};
  return edits.sort((a,b)=>rank(a)-rank(b)||b.meanShift-a.meanShift).slice(0,max);
 }

 /* ---------- V2: light and shadow ----------
    Tone is judged in the student's own range: the reference says WHERE it is dark or light (its order),
    the drawing's own darkest-to-lightest values say HOW dark. So the plan asks for the student's darks
    in the reference's places, not for a photographic copy. All grids are N×N cells, one cell per sheet unit. */
 function smoothField(f,N,inside,r=2,passes=2){
  let a=f;
  for(let pass=0;pass<passes;pass++){const b=new Float32Array(N*N).fill(NaN);
   for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x;if(!inside[i])continue;let s=0,n=0;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=N||yy>=N)continue;const v=a[yy*N+xx];if(!Number.isNaN(v)&&inside[yy*N+xx]){s+=v;n++;}}
    b[i]=n?s/n:NaN;}
   a=b;}
  return a;
 }
 function toneTargets(drawLum,refLum,inside){
  const idx=[];for(let i=0;i<inside.length;i++)if(inside[i])idx.push(i);
  const d=idx.map(i=>drawLum[i]).sort((a,b)=>a-b),order=idx.slice().sort((a,b)=>refLum[a]-refLum[b]);
  const target=new Float32Array(drawLum.length).fill(NaN);order.forEach((i,k)=>{target[i]=d[k];});
  const q=p=>d[Math.floor(p*(d.length-1))]||0;
  return {target,step:Math.max(.02,(q(.9)-q(.1))/5),paper:q(.97),ink:q(.02)};
 }
 const REL=(c,f)=>{const dx=c[0]-f.c[0],dy=c[1]-f.c[1];
  if(Math.abs(dy)>Math.abs(dx)*1.2)return (dy>0?'under ':'above ')+f.the;
  return /\b(left|right)\b/.test(f.the)?'beside '+f.the:(dx<0?'left of ':'right of ')+f.the;};
 // Names a painter would use: hair, forehead, cheek and jaw areas by side; otherwise relative to the nearest feature.
 // "left/right" is the drawing's left/right, the same convention as the feature names.
 function whereOf(c,named,faceCx=50){
  let best=null,bd=Infinity;
  const segD=(a,b)=>{const vx=b[0]-a[0],vy=b[1]-a[1],L=vx*vx+vy*vy,t=L?clamp(((c[0]-a[0])*vx+(c[1]-a[1])*vy)/L,0,1):0;return Math.hypot(a[0]+t*vx-c[0],a[1]+t*vy-c[1]);};
  for(const f of named){const P=f.pts;for(let k=0;k<P.length;k++){const d=segD(P[k],P[Math.min(k+1,P.length-1)]);if(d<bd){bd=d;best=f;}}}
  if(!best)return 'in this area';
  const xs=best.pts.map(p=>p[0]),ys=best.pts.map(p=>p[1]),fc=[mean(xs),mean(ys)],side=c[0]<faceCx?'left':'right',n=best.name.toLowerCase();
  const find=re=>named.find(f=>re.test(f.name)),cy=f=>f?mean(f.pts.map(p=>p[1])):NaN;
  if(/hair/.test(n))return c[1]<fc[1]?`in the hair on the ${side}`:(Math.abs(c[0]-faceCx)<6?'on the forehead':`on the ${side} of the forehead`);
  if(/jaw|chin|face/.test(n)){const eye=cy(find(/eye/i)),mouth=cy(find(/mouth|lip/i));
   if(c[1]>(Number.isNaN(mouth)?fc[1]:mouth)+2)return Math.abs(c[0]-faceCx)<6?'under the chin':`along the ${side} jaw`;
   if(!Number.isNaN(eye)&&c[1]>eye)return `on the ${side} cheek`;}
  // well to the side of the nose or mouth is the cheek
  if(/nose|mouth|lip/.test(n)&&(c[0]<Math.min(...xs)-2||c[0]>Math.max(...xs)+2))return `on the ${side} cheek`;
  return REL(c,{the:'the '+n,c:fc});
 }
 function toneSteps(n){const r=Math.round(n*2)/2;return r<=.5?'About half a tone step':r===1?'About one tone step':`About ${r} tone steps`;}
 function toneWords(kind,where,steps){
  return kind==='darken'
   ?{text:`Darken the shadow ${where}`.replace('shadow in the hair','hair'),detail:`${toneSteps(steps)} darker · HB, light layers`}
   :{text:`Lift graphite ${where}`,detail:`${toneSteps(steps)} lighter · kneaded eraser`};
 }
 function planToneStage({drawLum,refLum,inside,N=100,named=[],faceCx=50,thr=.07,minArea=25,max=4}){
  const {target,step,paper}=toneTargets(drawLum,refLum,inside);
  const raw=new Float32Array(N*N).fill(NaN);for(let i=0;i<N*N;i++)if(inside[i])raw[i]=target[i]-drawLum[i];
  const delta=smoothField(raw,N,inside,2),edits=[];
  for(const sign of [-1,1]){
   const seen=new Uint8Array(N*N),hit=i=>!seen[i]&&inside[i]&&sign*delta[i]>thr;
   for(let s=0;s<N*N;s++){if(!hit(s))continue;const cells=[],q=[s];seen[s]=1;
    while(q.length){const i=q.pop();cells.push(i);const x=i%N,y=(i/N)|0;
     for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=N||yy>=N)continue;const j=yy*N+xx;if(hit(j)){seen[j]=1;q.push(j);}}}
    if(cells.length<minArea)continue;
    let sum=0,cx=0,cy=0,x0=N,y0=N,x1=0,y1=0;
    for(const i of cells){const x=i%N,y=(i/N)|0;sum+=Math.abs(delta[i]);cx+=x+.5;cy+=y+.5;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
    const kind=sign<0?'darken':'lift',c=[cx/cells.length,cy/cells.length],steps=sum/cells.length/step;
    edits.push({stage:2,type:'tone',kind,cells,score:sum,c,box:{x0,y0,x1,y1},steps,delta,step,paper,N,
     region:{x:x0-3,y:y0-3,w:x1-x0+6,h:y1-y0+6},name:kind,...toneWords(kind,whereOf(c,named,faceCx),steps)});
   }
  }
  // the biggest tonal shapes first: they carry the form; one pass per area
  return edits.sort((a,b)=>b.score-a.score).slice(0,max).sort((a,b)=>b.cells.length-a.cells.length);
 }
 // The area's mask on the cell grid, feathered by ~1.5 units so the edit blends into the drawing.
 function toneMask(e){
  const {N}=e,m=new Float32Array(N*N);for(const i of e.cells)m[i]=1;
  const all=new Uint8Array(N*N).fill(1);return smoothField(m,N,all,1);
 }
 const bil=(g,N,x,y)=>{const fx=clamp(x-.5,0,N-1.001),fy=clamp(y-.5,0,N-1.001),ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,v=(a,b)=>{const t=g[(iy+b)*N+ix+a];return Number.isNaN(t)?0:t;};
  return (v(0,0)*(1-tx)+v(1,0)*tx)*(1-ty)+(v(0,1)*(1-tx)+v(1,1)*tx)*ty;};
 // Goal pixels for one tone edit: the student's own marks, darkened (graphite, with a faint hatch grain)
 // or lifted toward the paper, by the planned amount and only inside the feathered area.
 function toneGoal(src,W,e,mask=toneMask(e)){
  const s=W/100,goal=new Uint8ClampedArray(src),x0=Math.max(0,Math.floor(e.box.x0*s-2*s)),y0=Math.max(0,Math.floor(e.box.y0*s-2*s));
  const x1=Math.min(W,Math.ceil(e.box.x1*s+2*s)),y1=Math.min(W,Math.ceil(e.box.y1*s+2*s)),paper=e.paper*255;
  const ang=e.kind==='darken'?-55*Math.PI/180:30*Math.PI/180,ca=Math.cos(ang),sa=Math.sin(ang);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const ux=(x+.5)/s,uy=(y+.5)/s,w=bil(mask,e.N,ux,uy);if(w<=.003)continue;
   const d=bil(e.delta,e.N,ux,uy)*255*w,i=(y*W+x)*4,L=.299*src[i]+.587*src[i+1]+.114*src[i+2];
   if(e.kind==='darken'){if(d>=0)continue;
    const grain=.8+.4*(.5+.5*Math.sin((-ux*sa+uy*ca)*Math.PI*2/.7));        // hatch lines ~0.7 units apart
    const f=clamp((L+d*grain)/Math.max(L,1),.2,1);for(let c=0;c<3;c++)goal[i+c]=src[i+c]*f;}
   else{if(d<=0||L>=paper)continue;const k=clamp(d/(paper-L),0,.85);for(let c=0;c<3;c++)goal[i+c]=src[i+c]+(paper*(src[i+c]/Math.max(L,1))-src[i+c])*k;}
  }
  return {goal,box:{x0,y0,w:x1-x0,h:y1-y0}};
 }
 // The tool's path: hatching lines across the area, alternating direction like a hand.
 function toneStrokes(e,mask=toneMask(e),spacing=e.kind==='darken'?.9:1.2){
  const ang=(e.kind==='darken'?-55:30)*Math.PI/180,d=[Math.cos(ang),Math.sin(ang)],n=[-d[1],d[0]];
  const c=[(e.box.x0+e.box.x1)/2,(e.box.y0+e.box.y1)/2],R=Math.hypot(e.box.x1-e.box.x0,e.box.y1-e.box.y0)/2+1,out=[];let flip=false;
  for(let o=-R;o<=R;o+=spacing){let line=[];
   const push=()=>{if(line.length>=3){out.push(flip?line.reverse():line);flip=!flip;}line=[];};
   for(let t=-R;t<=R;t+=.3){const x=c[0]+n[0]*o+d[0]*t,y=c[1]+n[1]*o+d[1]*t;
    if(x>0&&y>0&&x<e.N&&y<e.N&&bil(mask,e.N,x,y)>.5)line.push([x,y]);else push();}
   push();}
  return out;
 }
 // One contact of the tool: pixels move part of the way to the goal under a soft round tip.
 function stamp(state,goal,W,x,y,r,strength){
  const s=W/100,px=x*s,py=y*s,R=r*s;
  for(let yy=Math.max(0,Math.floor(py-R));yy<Math.min(W,Math.ceil(py+R));yy++)for(let xx=Math.max(0,Math.floor(px-R));xx<Math.min(W,Math.ceil(px+R));xx++){
   const t=Math.hypot(xx+.5-px,yy+.5-py)/R;if(t>=1)continue;const i=(yy*W+xx)*4,a=strength*(1-t*t);
   for(let c=0;c<3;c++)state[i+c]+=(goal[i+c]-state[i+c])*a;
  }
 }

 /* ---------- V3: details and finishing ----------
    Works on a finer grid (N=200: two cells per sheet unit) and only on small-scale structure:
    what V2 settled (the broad tone) is removed by a local high-pass, so V3 only sees accents, edges,
    highlights and texture. Every item is something the reference shows that the drawing has nowhere
    nearby (within ~1.5 units), so a pupil drawn slightly off is not drawn twice. */
 function rankFilter(f,N,inside,r,mode){
  const out=new Float32Array(N*N).fill(NaN),pick=mode==='min'?Math.min:Math.max;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x;if(!inside[i])continue;let v=mode==='min'?Infinity:-Infinity;
   for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=N||yy>=N)continue;const j=yy*N+xx;if(inside[j])v=pick(v,f[j]);}
   out[i]=v;}
  return out;
 }
 function components(hit,N){
  const seen=new Uint8Array(N*N),out=[];
  for(let s=0;s<N*N;s++){if(seen[s]||!hit(s))continue;const cells=[],q=[s];seen[s]=1;
   while(q.length){const i=q.pop();cells.push(i);const x=i%N,y=(i/N)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=N||yy>=N)continue;const j=yy*N+xx;if(!seen[j]&&hit(j)){seen[j]=1;q.push(j);}}}
   out.push(cells);}
  return out;
 }
 // Centre, main direction and spread of a set of cells, in sheet units.
 function shapeOf(cells,N){
  const u=100/N;let cx=0,cy=0;for(const i of cells){cx+=(i%N+.5)*u;cy+=(((i/N)|0)+.5)*u;}cx/=cells.length;cy/=cells.length;
  let xx=0,yy=0,xy=0;for(const i of cells){const dx=(i%N+.5)*u-cx,dy=(((i/N)|0)+.5)*u-cy;xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;}
  xx/=cells.length;yy/=cells.length;xy/=cells.length;
  const d=Math.sqrt(((xx-yy)/2)**2+xy*xy),l1=(xx+yy)/2+d,l2=Math.max((xx+yy)/2-d,1e-6),ang=.5*Math.atan2(2*xy,xx-yy);
  return {c:[cx,cy],axis:[Math.cos(ang),Math.sin(ang)],l1,l2,length:Math.sqrt(12*l1),width:Math.sqrt(12*l2)};
 }
 // Inside a feature: "in the left eye", "on the nose", "at the mouth"; otherwise the V2 names.
 function detailWhere(c,named,faceCx=50){
  const eyes=named.filter(f=>/eye(?!brow)/i.test(f.name)&&f.pts.length>2);
  if(eyes.length===2){const ex=eyes.map(f=>f.pts.map(p=>p[0])),ey=mean(eyes.flatMap(f=>f.pts.map(p=>p[1]))),inner=[Math.min(Math.max(...ex[0]),Math.max(...ex[1])),Math.max(Math.min(...ex[0]),Math.min(...ex[1]))];
   const nose=named.find(f=>/nose/i.test(f.name)&&f.pts.length>1),noseTop=nose?Math.min(...nose.pts.map(p=>p[1])):ey+10;
   if(c[0]>inner[0]&&c[0]<inner[1]){if(Math.abs(c[1]-ey)<3)return 'between the eyes';if(c[1]>ey&&c[1]<noseTop)return 'on the bridge of the nose';}}
  let best=null,ba=Infinity;
  for(const f of named){if(/hair|jaw|face|chin|head/i.test(f.name)||f.pts.length<3)continue;
   const xs=f.pts.map(p=>p[0]),ys=f.pts.map(p=>p[1]),x0=Math.min(...xs)-1,x1=Math.max(...xs)+1,y0=Math.min(...ys)-1,y1=Math.max(...ys)+1;
   if(c[0]>=x0&&c[0]<=x1&&c[1]>=y0&&c[1]<=y1){const a=(x1-x0)*(y1-y0);if(a<ba){ba=a;best=f;}}}
  if(best&&/mouth|lip/i.test(best.name)){const xs=best.pts.map(p=>p[0]),x0=Math.min(...xs),x1=Math.max(...xs);
   const ys=best.pts.map(p=>p[1]),y1=Math.max(...ys),ym=(Math.min(...ys)+y1)/2;
   if(c[0]>=x0+2.5&&c[0]<=x1-2.5){if(c[1]>y1-1.5)return 'under the lower lip';if(Math.abs(c[1]-ym)<1.5)return 'between the lips';}
   if(c[0]<x0+2.5)return `at the ${c[0]<faceCx?'left':'right'} corner of the mouth`;if(c[0]>x1-2.5)return `at the ${c[0]<faceCx?'left':'right'} corner of the mouth`;}
  if(!best){const side=c[0]<faceCx?'left':'right',eye=eyes.find(f=>new RegExp(side).test(f.name)),brow=named.find(f=>/brow/i.test(f.name)&&new RegExp(side).test(f.name));
   if(eye){const xs=eye.pts.map(p=>p[0]),ey=mean(eye.pts.map(p=>p[1])),by=brow?mean(brow.pts.map(p=>p[1])):ey-4,outer=side==='left'?c[0]<Math.min(...xs):c[0]>Math.max(...xs);
    if(outer&&Math.abs(c[0]-(side==='left'?Math.min(...xs):Math.max(...xs)))<6&&c[1]>by-2&&c[1]<ey+3)return `at the ${side} temple`;}}
  if(best){const n=best.name.toLowerCase();return (/eye(?!brow)|ear/.test(n)?'in':/mouth|lip/.test(n)?'at':'on')+' the '+n;}
  return whereOf(c,named,faceCx);
 }
 const DETAIL_ORDER=['blend','shadow','edge','accent','highlight'];      // smooth the surface, then crisp edges, darkest darks, highlights last
 function detailWords(kind,where,steps){
  const st=toneSteps(steps);
  return kind==='blend'?{text:`Blend the marks ${where}`,detail:'Smooth the hatching into an even tone · blending stump'}
   :kind==='shadow'?{text:`Add the shadow ${where}`,detail:`${st} darker, soft-edged · HB, light layers`}
   :kind==='edge'?{text:`Sharpen the edge ${where}`,detail:`${st} darker, one crisp line · 2B, sharp point`}
   :kind==='accent'?{text:`Add a dark accent ${where}`,detail:`${st} darker, your darkest value · 2B, sharp point`}
   :{text:`Pick out a highlight ${where}`,detail:`${st} lighter · kneaded eraser, pinched to a point`};
 }
 function planDetailStage({drawLum,refLum,inside:all,drawTex=null,refTex=null,N=200,named=[],faceCx=50,thr=.1,max=5,perKind=2,blendGain=.03,minScore=.3,debug=false}){
  const k=N/100;
  // The hair and its edge belong to V1/V2: V3 works below the hairline (and 2.5 units clear of it).
  const hl=named.find(f=>/hairline/i.test(f.name)&&f.pts.length>1),hlY=x=>{if(!hl)return -Infinity;const P=hl.pts.slice().sort((a,b)=>a[0]-b[0]);
   if(x<=P[0][0])return P[0][1];for(let j=1;j<P.length;j++)if(x<=P[j][0]){const t=(x-P[j-1][0])/((P[j][0]-P[j-1][0])||1);return P[j-1][1]+(P[j][1]-P[j-1][1])*t;}return P[P.length-1][1];};
  const inside=new Uint8Array(N*N);for(let x=0;x<N;x++){const lim=(hlY((x+.5)/k)+2.5)*k;for(let y=0;y<N;y++)inside[y*N+x]=all[y*N+x]&&y+.5>lim?1:0;}
  // Tone order is taken within the face itself, so the reference's pupils and nostrils map to the drawing's darkest marks
  // (not to the hair's), and its catchlights to the drawing's lightest.
  const {target:T,step,paper,ink}=toneTargets(drawLum,refLum,inside);
  const r=Math.max(1,Math.round(1.5*k)),D=new Float32Array(N*N).fill(NaN);for(let i=0;i<N*N;i++)if(inside[i])D[i]=drawLum[i];
  const lowT=smoothField(T,N,inside,r),lowD=smoothField(D,N,inside,r),hpT=new Float32Array(N*N),hpD=new Float32Array(N*N);
  for(let i=0;i<N*N;i++){hpT[i]=inside[i]?T[i]-lowT[i]:0;hpD[i]=inside[i]?D[i]-lowD[i]:0;}
  // Marks are compared after one light 3×3 softening, so thin lash or hatch lines don't stand in for a missing accent.
  const Ds=smoothField(D,N,inside,1,1);
  // Texture: the fine-scale variation (the cell's own pixel spread when given, plus the high-pass), smoothed.
  const tex=(hp,t)=>{const a=new Float32Array(N*N);for(let i=0;i<N*N;i++)a[i]=Math.abs(hp[i])+(t?t[i]:0);return smoothField(a,N,inside,r);};
  const eT=tex(hpT,refTex),eD=tex(hpD,drawTex);
  const eTnear=rankFilter(eT,N,inside,Math.round(2*k),'max');      // blend only where the reference is smooth all around
  // marks that follow the reference's own structure (a shared edge) are drawing, not noise: blending leaves them alone
  const prod=(a,b)=>{const o=new Float32Array(N*N);for(let i=0;i<N*N;i++)o[i]=a[i]*b[i];return smoothField(o,N,inside,r);};
  const cDT=prod(hpD,hpT),cDD=prod(hpD,hpD),cTT=prod(hpT,hpT),corr=i=>cDT[i]/Math.sqrt(cDD[i]*cTT[i]+1e-6);
  const delta=new Float32Array(N*N).fill(NaN);for(let i=0;i<N*N;i++)if(inside[i])delta[i]=T[i]-D[i];
  // Away from the outline's edge (where the photo's background meets the face).
  const core=new Uint8Array(N*N),rb=Math.round(3*k);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x;if(!all[i])continue;let ok=1;
   for(let dy=-rb;dy<=rb&&ok;dy+=Math.max(1,rb>>2))for(let dx=-rb;dx<=rb;dx+=Math.max(1,rb>>2)){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=N||yy>=N||!all[yy*N+xx]){ok=0;break;}}
   core[i]=ok;}
  // Only where both the reference and the drawing are skin-light around the spot: a dark speck inside a dark mass is
  // texture, and where the two disagree (hair drawn lower than the reference's) it's a shape question, not a finishing touch.
  const T0=toneTargets(drawLum,refLum,all).target,D0=new Float32Array(N*N).fill(NaN);for(let i=0;i<N*N;i++)if(all[i])D0[i]=drawLum[i];
  const lightOf=f=>{const a=smoothField(f,N,all,Math.round(3*k)),v=[];for(let i=0;i<N*N;i++)if(all[i])v.push(a[i]);v.sort((x,y)=>x-y);
   const q=p=>v[Math.floor(p*(v.length-1))]??0;return {a,lim:q(.1)+(q(.9)-q(.1))*.6};};
  const LT=lightOf(T0),LD=lightOf(D0),light=i=>LT.a[i]>LT.lim&&LD.a[i]>LD.lim;
  const ok=i=>inside[i]&&core[i];
  // eyes, brows and lips are kept crisp: never blended
  const crisp=new Uint8Array(N*N);
  for(const f of named){if(!/eye|brow|mouth|lip/i.test(f.name)||f.pts.length<3)continue;
   const xs=f.pts.map(p=>p[0]),ys=f.pts.map(p=>p[1]);
   for(let y=Math.max(0,Math.floor((Math.min(...ys)-1.5)*k));y<Math.min(N,Math.ceil((Math.max(...ys)+1.5)*k));y++)
    for(let x=Math.max(0,Math.floor((Math.min(...xs)-1.5)*k));x<Math.min(N,Math.ceil((Math.max(...xs)+1.5)*k));x++)crisp[y*N+x]=1;}
  // The reference's own small darks and lights, as shapes...
  // edges are among the reference's darkest quarter in the face, accents its darkest tenth, highlights its lightest tenth
  const tq=[];for(let i=0;i<N*N;i++)if(inside[i])tq.push(T[i]);tq.sort((a,b)=>a-b);const tAt=p=>tq[Math.floor(p*(tq.length-1))]??0,t10=tAt(.1),t25=tAt(.25),t90=tAt(.9);
  const tests={
   dark:i=>ok(i)&&light(i)&&hpT[i]<-step&&T[i]<=t25&&T[i]<lowD[i]-thr,
   light:i=>ok(i)&&light(i)&&hpT[i]>step&&T[i]>=t90&&T[i]>lowD[i]+thr,
   blend:i=>ok(i)&&!crisp[i]&&light(i)&&eD[i]-eT[i]>Math.max(blendGain,step*.3)&&eD[i]>1.7*eT[i]&&eTnear[i]<step*.9&&corr(i)<.5,
  };
  const dil=(cells,rr)=>{const s=new Set();for(const i of cells){const x=i%N,y=(i/N)|0;for(let dy=-rr;dy<=rr;dy++)for(let dx=-rr;dx<=rr;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<N&&yy<N&&inside[yy*N+xx])s.add(yy*N+xx);}}return s;};
  const cand=[],area=n=>n/(k*k),rejected=[],why=(w,cells)=>{if(debug)rejected.push({why:w,sign:0,n:cells.length,c:shapeOf(cells,N).c.map(v=>+v.toFixed(1))});};
  for(const [sign,test] of Object.entries(tests))for(let cells of components(test,N)){
   if(sign!=='blend'){
    // ...that the drawing doesn't already have: a mark at least halfway there, covering most of that shape within
    // half its own size (at most a unit) of it.
    // A pupil drawn a unit off counts as there; a few lash lines crossing the spot don't.
    const Tm=mean(cells.map(i=>T[i])),Lm=mean(cells.map(i=>lowD[i])),half=(Tm+Lm)/2,near=dil(cells,clamp(Math.round(.5*Math.sqrt(area(cells.length))*k),1,Math.round(k)));let have=0;
    for(const j of near)if(sign==='dark'?Ds[j]<=half:D[j]>=half)have++;
    if(have>=.6*cells.length){why('have '+have,cells);continue;}
    cells=cells.filter(i=>sign==='dark'?D[i]>T[i]+thr/2:D[i]<T[i]-thr/2);
    if(!cells.length)continue;
   }
   const a=area(cells.length),sh=shapeOf(cells,N);
   if(sign==='blend'){if(a<5||a>220)continue;}
   else{if(a<.5||a>40){why('area '+a,cells);continue;}}
   // a long thin dark is an edge (one crisp line); a long dark band wider than about a unit is a small cast shadow
   const elongated=sign==='dark'&&sh.length>3.5&&sh.length/sh.width>3.5,band=a/sh.length;
   const kind=sign==='blend'?'blend':sign==='light'?'highlight':elongated?(band>1.05?'shadow':'edge'):'accent';
   if(kind==='accent'&&(sh.length>6||mean(cells.map(i=>T[i]))>t10))continue;                       // a big dark blob is a V2 shadow, not an accent
   let sum=0;for(const i of cells)sum+=sign==='blend'?eD[i]-eT[i]:Math.abs(delta[i]);
   const steps=sign==='blend'?0:sum/cells.length/step;
   // the eyes carry a portrait, then the mouth and nose: details there come first
   const inF=re=>named.some(f=>re.test(f.name)&&f.pts.length>2&&sh.c[0]>=Math.min(...f.pts.map(p=>p[0]))-1&&sh.c[0]<=Math.max(...f.pts.map(p=>p[0]))+1&&sh.c[1]>=Math.min(...f.pts.map(p=>p[1]))-1&&sh.c[1]<=Math.max(...f.pts.map(p=>p[1]))+1);
   const weight=kind==='blend'?1:inF(/eye(?!brow)/i)?4:inF(/mouth|lip|nose/i)?2:1;
   cand.push({kind,cells,sh,score:sum/(k*k)*weight,steps});
  }
  const chosen=[],count={};
  for(const e of cand.sort((a,b)=>b.score-a.score)){
   if(e.kind!=='blend'&&e.score<minScore)continue;                // too small to see: not worth a demonstration
   if((count[e.kind]||0)>=perKind||chosen.length>=max)continue;
   if(chosen.some(o=>o.kind===e.kind&&Math.hypot(o.sh.c[0]-e.sh.c[0],o.sh.c[1]-e.sh.c[1])<3))continue;
   count[e.kind]=(count[e.kind]||0)+1;chosen.push(e);
  }
  const u=1/k;
  const result=chosen.sort((a,b)=>DETAIL_ORDER.indexOf(a.kind)-DETAIL_ORDER.indexOf(b.kind)||b.score-a.score).map(e=>{
   let x0=N,y0=N,x1=0,y1=0;for(const i of e.cells){const x=i%N,y=(i/N)|0;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
   const box={x0:x0*u,y0:y0*u,x1:x1*u,y1:y1*u},w=Math.max(14,box.x1-box.x0+8),h=Math.max(14,box.y1-box.y0+8);
   const cx=(box.x0+box.x1)/2,cy=(box.y0+box.y1)/2,look=e.kind==='highlight'?'lift':e.kind==='blend'?'blend':'darken';
   return {stage:3,type:'detail',kind:e.kind,look,cells:e.cells,N,k,c:e.sh.c,axis:e.sh.axis,length:e.sh.length,score:e.score,steps:e.steps,
    delta,step,paper,ink,box,region:{x:cx-w/2,y:cy-h/2,w,h},name:e.kind,...detailWords(e.kind,detailWhere(e.sh.c,named,faceCx),e.steps)};
  });
  if(debug)result.rejected=rejected;
  if(debug)result.fields={eD,eT,eTnear,T,D,Ds,lowD,core,inside,hpT,hpD,crisp,step};
  return result;
 }
 // Feathered area on the fine grid (one cell of softening) — the same mask for the goal and the tool.
 function detailMask(e){
  const {N}=e,m=new Float32Array(N*N);for(const i of e.cells)m[i]=1;
  const all=new Uint8Array(N*N).fill(1);return smoothField(m,N,all,e.kind==='blend'||e.kind==='shadow'?2:1);     // blending fades out over ~2 units
 }
 const bilK=(g,e,ux,uy)=>bil(g,e.N,ux*e.k,uy*e.k);
 function boxBlur(src,W,x0,y0,w,h,r){
  let a=new Float32Array(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((y0+y)*W+x0+x)*4,j=(y*w+x)*3;a[j]=src[i];a[j+1]=src[i+1];a[j+2]=src[i+2];}
  for(let pass=0;pass<2;pass++)for(const dir of [0,1]){const b=new Float32Array(a.length);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s0=0,s1=0,s2=0,n=0;
    for(let t=-r;t<=r;t++){const xx=dir?x:x+t,yy=dir?y+t:y;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=(yy*w+xx)*3;s0+=a[j];s1+=a[j+1];s2+=a[j+2];n++;}
    const j=(y*w+x)*3;b[j]=s0/n;b[j+1]=s1/n;b[j+2]=s2/n;}
   a=b;}
  return a;
 }
 // Goal pixels for one V3 item, from the student's own pixels:
 // edge/accent → graphite pressed down to the planned value (no grain: a sharp point);
 // highlight → lifted toward the paper; blend → the marks averaged with their neighbours.
 function detailGoal(src,W,e,mask=detailMask(e)){
  const s=W/100,goal=new Uint8ClampedArray(src),pad=1.5;
  const x0=Math.max(0,Math.floor((e.box.x0-pad)*s)),y0=Math.max(0,Math.floor((e.box.y0-pad)*s)),x1=Math.min(W,Math.ceil((e.box.x1+pad)*s)),y1=Math.min(W,Math.ceil((e.box.y1+pad)*s));
  const w=x1-x0,h=y1-y0,blur=e.kind==='blend'?boxBlur(src,W,x0,y0,w,h,Math.max(2,Math.ceil(.45*s))):null,paper=e.paper*255;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const ux=(x+.5)/s,uy=(y+.5)/s,m=bilK(mask,e,ux,uy);if(m<=.003)continue;
   const i=(y*W+x)*4,L=.299*src[i]+.587*src[i+1]+.114*src[i+2];
   if(blur){const j=((y-y0)*w+x-x0)*3,a=.8*m;for(let c=0;c<3;c++)goal[i+c]=src[i+c]+(blur[j+c]-src[i+c])*a;continue;}
   const d=bilK(e.delta,e,ux,uy)*255*m;
   if(e.kind==='highlight'){if(L>=paper)continue;const t=clamp(Math.max(d/(paper-L),.75*m),0,.9);/* a highlight goes to the paper's white */for(let c=0;c<3;c++)goal[i+c]=src[i+c]+(paper*(src[i+c]/Math.max(L,1))-src[i+c])*t;}
   else{if(d>=0)continue;const f=clamp((L+d)/Math.max(L,1),Math.min(1,e.ink*255/Math.max(L,1)),1);for(let c=0;c<3;c++)goal[i+c]=src[i+c]*f;}
  }
  return {goal,box:{x0,y0,w,h}};
 }
 // The tool's path, from the same cells: a line drawn along an edge (twice, like a hand firming it up),
 // a small spiral filling an accent, short dabs for a highlight, little circles for blending.
 function hatchIn(e,mw,ang,spacing,step=.2){
  const d=[Math.cos(ang),Math.sin(ang)],n=[-d[1],d[0]],c=[(e.box.x0+e.box.x1)/2,(e.box.y0+e.box.y1)/2],R=Math.hypot(e.box.x1-e.box.x0,e.box.y1-e.box.y0)/2+1,out=[];let flip=false;
  for(let o=-R;o<=R;o+=spacing){let line=[];const push=()=>{if(line.length>=2){out.push(flip?line.reverse():line);flip=!flip;}line=[];};
   for(let t=-R;t<=R;t+=step){const x=c[0]+n[0]*o+d[0]*t,y=c[1]+n[1]*o+d[1]*t;if(mw(x,y)>.5)line.push([x,y]);else push();}push();}
  return out;
 }
 function detailStrokes(e,mask=detailMask(e)){
  const mw=(x,y)=>bilK(mask,e,x,y),u=1/e.k;
  if(e.kind==='edge'){
   const [ax,ay]=e.axis,bins=new Map();
   for(const i of e.cells){const x=(i%e.N+.5)*u,y=(((i/e.N)|0)+.5)*u,t=(x-e.c[0])*ax+(y-e.c[1])*ay,o=-(x-e.c[0])*ay+(y-e.c[1])*ax,b=Math.round(t/.5);
    const v=bins.get(b)||[0,0];v[0]+=o;v[1]++;bins.set(b,v);}
   const line=[...bins.entries()].sort((a,b)=>a[0]-b[0]).map(([b,[o,n]])=>{const t=b*.5,oo=o/n;return [e.c[0]+ax*t-ay*oo,e.c[1]+ay*t+ax*oo];});
   const dense=[];for(let j=0;j<line.length-1;j++)for(let t=0;t<1;t+=.4)dense.push([line[j][0]+(line[j+1][0]-line[j][0])*t,line[j][1]+(line[j+1][1]-line[j][1])*t]);
   if(line.length)dense.push(line[line.length-1]);
   return dense.length>1?[dense,dense.slice().reverse()]:[[e.c,e.c]];
  }
  if(e.kind==='accent'){
   const R=Math.max(.3,Math.sqrt(e.cells.length*u*u/Math.PI)),pts=[];
   for(let th=0;th<=Math.PI*2*Math.max(2,R/.35);th+=.35){const rr=R*th/(Math.PI*2*Math.max(2,R/.35)),p=[e.c[0]+rr*Math.cos(th),e.c[1]+rr*Math.sin(th)];if(mw(p[0],p[1])>.3)pts.push(p);}
   return pts.length>1?[pts]:[[e.c,e.c]];
  }
  if(e.kind==='highlight'){const h=hatchIn(e,mw,Math.PI/6,.45);return h.length?h:[[e.c,e.c]];}
  if(e.kind==='shadow'){const h=hatchIn(e,mw,Math.atan2(e.axis[1],e.axis[0]),.4,.2);return h.length?h:[[e.c,e.c]];}
  const lines=hatchIn(e,mw,-Math.PI/9,1.1,.12);
  return lines.map(l=>l.map((p,j)=>{const th=j*.9;return [p[0]+.45*Math.cos(th),p[1]+.45*Math.sin(th)];}));
 }
 const DETAIL_TOOL={shadow:{tool:'pencil',tip:.55,strength:.45},edge:{tool:'pencil',tip:.35,strength:.6},accent:{tool:'pencil',tip:.4,strength:.55},highlight:{tool:'eraser',tip:.45,strength:.5},blend:{tool:'stump',tip:.9,strength:.35}};

 root.SketchlingLesson={planDetailStage,detailMask,detailGoal,detailStrokes,detailWhere,DETAIL_TOOL,toneTargets,planToneStage,toneMask,toneGoal,toneStrokes,stamp,whereOf,measurableShift,axisFit,shapeEdit,describe,amount,weightAt,displacement,prepare,warp,toolPoint,planShapeStage};
})(globalThis);
