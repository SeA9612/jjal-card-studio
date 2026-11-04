import {fitElement} from './elements.js?v=20261104-image-ratio1';

export function fitImageAspect(item,canvasSize,width=item.width,center=false){
  const [W,H]=canvasSize,aspect=item.image.width/item.image.height;
  let height=width*W/H/aspect;
  const scale=Math.min(1,1/width,1/height);width*=scale;height*=scale;
  const x=center?item.x+item.width/2-width/2:item.x;
  const y=center?item.y+item.height/2-height/2:item.y;
  return fitElement({...item,width,height,x,y},{});
}
export function imagesForCanvas(items,oldSize,newSize){
  return items.map(item=>item.type==='image'&&item.aspectLocked!==false
    ?fitImageAspect(item,newSize,item.width*oldSize[0]/newSize[0],true):item);
}
