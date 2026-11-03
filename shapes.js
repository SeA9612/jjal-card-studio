function rounded(ctx,x,y,w,h,r){ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
export function drawShapePath(ctx,shape,x,y,w,h){
  ctx.beginPath();
  const point=(a,b,first=false)=>first?ctx.moveTo(x+a*w,y+b*h):ctx.lineTo(x+a*w,y+b*h);
  if(shape==='rect')ctx.rect(x,y,w,h);
  if(shape==='roundrect')rounded(ctx,x,y,w,h,Math.min(w,h)*.18);
  if(shape==='ellipse')ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);
  if(shape==='triangle'){point(.5,0,true);point(1,1);point(0,1);ctx.closePath();}
  if(shape==='diamond'){point(.5,0,true);point(1,.5);point(.5,1);point(0,.5);ctx.closePath();}
  if(shape==='arrow'){point(0,.28,true);point(.58,.28);point(.58,0);point(1,.5);point(.58,1);point(.58,.72);point(0,.72);ctx.closePath();}
  if(shape==='hexagon'){point(.25,0,true);point(.75,0);point(1,.5);point(.75,1);point(.25,1);point(0,.5);ctx.closePath();}
  if(shape==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.43:1;point(.5+Math.cos(a)*.5*r,.5+Math.sin(a)*.5*r,i===0);}ctx.closePath();}
  if(shape==='heart'){
    point(.5,.97,true);ctx.bezierCurveTo(x+.41*w,y+.83*h,x+.03*w,y+.58*h,x+.03*w,y+.29*h);
    ctx.bezierCurveTo(x+.03*w,y-.03*h,x+.39*w,y-.05*h,x+.5*w,y+.23*h);
    ctx.bezierCurveTo(x+.61*w,y-.05*h,x+.97*w,y-.03*h,x+.97*w,y+.29*h);
    ctx.bezierCurveTo(x+.97*w,y+.58*h,x+.59*w,y+.83*h,x+.5*w,y+.97*h);ctx.closePath();
  }
  if(shape==='bubble'){
    point(.14,.03,true);point(.86,.03);ctx.quadraticCurveTo(x+.98*w,y+.03*h,x+.98*w,y+.17*h);point(.98,.64);ctx.quadraticCurveTo(x+.98*w,y+.78*h,x+.86*w,y+.78*h);point(.43,.78);point(.18,.98);point(.23,.78);point(.14,.78);ctx.quadraticCurveTo(x+.02*w,y+.78*h,x+.02*w,y+.64*h);point(.02,.17);ctx.quadraticCurveTo(x+.02*w,y+.03*h,x+.14*w,y+.03*h);ctx.closePath();
  }
}
