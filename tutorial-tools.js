// Shared, tip-anchored tools for prepared lessons and uploaded corrections.
(function(root){
 const NS='http://www.w3.org/2000/svg';
 function node(name,attrs={}){const el=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
 function createTool(svg,kind='pencil'){
  const group=node('g',{'class':'tutorial-tool','aria-label':kind==='eraser'?'Precision eraser':kind==='stump'?'Blending stump':'Drawing pencil',role:'img','pointer-events':'none'});
  const contact=node('ellipse',{cx:0,cy:.1,rx:.48,ry:.13,fill:'#43382a',opacity:0});
  const body=node('g');group.append(contact,body);
  if(kind==='eraser'){
   // Narrow precision eraser: rubber touches the origin; the holder extends away.
   body.append(node('path',{d:'M -.28 -.12 L -.29 -.85 Q -.29 -1.02 -.12 -1.06 L .12 -1.06 Q .29 -1.02 .29 -.85 L .28 -.12 Q 0 .08 -.28 -.12 Z',fill:'#f4e8d2',stroke:'#8c806b','stroke-width':.055}));
   body.append(node('rect',{x:-.3,y:-3.05,width:.6,height:2.22,rx:.13,fill:'#7e9c8c',stroke:'#3c5a49','stroke-width':.065}));
   body.append(node('path',{d:'M -.19 -2.85 L -.19 -1.08',stroke:'#c7dacf','stroke-width':.07,'stroke-linecap':'round'}));
   body.append(node('rect',{x:-.31,y:-1.15,width:.62,height:.25,rx:.04,fill:'#c2c8bc',stroke:'#687566','stroke-width':.04}));
  }else if(kind==='stump'){
   // Blending stump (tortillon): rolled paper, tip smudged with graphite, tip exactly at (0,0).
   body.append(node('path',{d:'M 0 0 L -.34 -2.9 Q 0 -3.05 .34 -2.9 Z',fill:'#efe9dc',stroke:'#968c78','stroke-width':.05}));
   body.append(node('path',{d:'M 0 0 L -.09 -.75 L .09 -.75 Z',fill:'#8c857a'}));
   for(const y of [-1.2,-1.75,-2.3])body.append(node('path',{d:`M ${(y*.115).toFixed(3)} ${y} L ${(-y*.115).toFixed(3)} ${y-.35}`,stroke:'#c9bfaa','stroke-width':.04}));
  }else{
   // Graphite tip is exactly (0,0), so the icon cannot drift from the mark.
   body.append(node('path',{d:'M 0 0 L -.27 -.65 L .27 -.65 Z',fill:'#d4b58a',stroke:'#725f48','stroke-width':.045}));
   body.append(node('path',{d:'M 0 0 L -.11 -.26 L .11 -.26 Z',fill:'#343532'}));
   body.append(node('path',{d:'M -.27 -.65 L -.27 -4.2 Q 0 -4.4 .27 -4.2 L .27 -.65 Z',fill:'#ceab59',stroke:'#765d2d','stroke-width':.06}));
   body.append(node('path',{d:'M -.1 -.8 L -.1 -4.13',stroke:'#f4d993','stroke-width':.09}));
   body.append(node('path',{d:'M .18 -.8 L .18 -4.13',stroke:'#a9843f','stroke-width':.045}));
   body.append(node('rect',{x:-.28,y:-4.35,width:.56,height:.28,rx:.08,fill:'#536a57',stroke:'#324739','stroke-width':.05}));
  }
  svg.append(group);
  return {element:group,kind,
   move(x,y,{contact:down=true,pressure=1,lift=0,tilt=0}={}){
    const z=Number(svg.dataset.s)||1;group.setAttribute('transform',`translate(${x} ${y}) scale(${1/z})`);
    body.setAttribute('transform',`translate(0 ${-lift}) rotate(${(kind==='eraser'?25:32)+tilt}) scale(1 ${kind==='eraser'?1-(down?.025*pressure:0):1})`);
    contact.setAttribute('opacity',down?(kind==='eraser'?.17:.1):0);contact.setAttribute('rx',kind==='eraser'?.3+.12*pressure:.16);
    group.style.opacity='1';
   },hide(){group.style.opacity='0';},remove(){group.remove();}
  };
 }
 root.SketchlingTutorialTools={createTool};
})(globalThis);
