export function normalizeRotation(value){return ((value+180)%360+360)%360-180;}

// Coordinates use actual canvas pixels so portrait cards rotate without distortion.
export function unrotatePoint(item,x,y,W=1,H=1){
  if(!item.rotation)return {x,y};
  const angle=-(item.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const cx=(item.x+item.width/2)*W,cy=(item.y+item.height/2)*H,dx=x*W-cx,dy=y*H-cy;
  return {x:(cx+dx*c-dy*s)/W,y:(cy+dx*s+dy*c)/H};
}
export function rotateContext(ctx,item,W,H){
  const angle=(item.rotation??0)*Math.PI/180;
  if(!angle)return;
  const cx=(item.x+item.width/2)*W,cy=(item.y+item.height/2)*H;
  ctx.translate(cx,cy);ctx.rotate(angle);ctx.translate(-cx,-cy);
}
export function resizeInRotation(item,dx,dy,W,H,lockAspect=false){
  const angle=(item.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  let width=Math.max(.02,Math.min(1,item.width+(dx*W*c+dy*H*s)/W));
  let height=Math.max(.02,Math.min(1,item.height+(-dx*W*s+dy*H*c)/H));
  if(lockAspect){const factor=Math.min(width/item.width,height/item.height);width=item.width*factor;height=item.height*factor;}
  const dw=(width-item.width)*W/2,dh=(height-item.height)*H/2;
  return {width,height,x:item.x+(dw*c-dh*s-dw)/W,y:item.y+(dw*s+dh*c-dh)/H};
}
