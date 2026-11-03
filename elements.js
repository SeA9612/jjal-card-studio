import { unrotatePoint } from './rotation.js?v=20261103-handle1';
const finite = (n,min,max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export const SHAPES = ['rect','ellipse','triangle','star','heart','bubble','roundrect','diamond','arrow','hexagon'];

export function validateElements(items, validateImage) {
  if (!Array.isArray(items) || items.length > 50) throw new Error('카드 한 장에는 최대 50개 요소를 사용할 수 있습니다.');
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new Error('요소의 ID가 없거나 중복됩니다.');
    ids.add(item.id);
    if (!['text','image','shape'].includes(item.type)) throw new Error('지원하지 않는 요소입니다.');
    if (!finite(item.x,0,.98) || !finite(item.y,0,.98) || !finite(item.width,.02,1) || !finite(item.height,.02,1) || !finite(item.opacity,0,1)) throw new Error('요소의 위치·크기·투명도가 올바르지 않습니다.');
    if (item.x + item.width > 1.001 || item.y + item.height > 1.001) throw new Error('요소가 캔버스 영역을 넘습니다.');
    const base = { id:item.id, type:item.type, x:item.x, y:item.y, width:item.width, height:item.height, opacity:item.opacity };
    if(item.rotation!==undefined){if(!finite(item.rotation,-180,180))throw new Error('회전 각도가 올바르지 않습니다.');base.rotation=item.rotation;}
    if (item.type === 'text') {
      if (typeof item.text !== 'string' || item.text.length > 12000 || !['sans','serif'].includes(item.font) || !finite(item.size,12,240) || !color(item.color) || !['left','center','right'].includes(item.align)) throw new Error('텍스트 요소가 올바르지 않습니다.');
      const result={ ...base, text:item.text, font:item.font, size:item.size, color:item.color, align:item.align };
      if(item.preferredWidth!==undefined){if(!finite(item.preferredWidth,.02,1))throw new Error('텍스트의 기준 너비가 올바르지 않습니다.');result.preferredWidth=item.preferredWidth;}
      if(item.autoHeight!==undefined){if(typeof item.autoHeight!=='boolean')throw new Error('텍스트 높이 설정이 올바르지 않습니다.');result.autoHeight=item.autoHeight;}
      return result;
    }
    if (item.type === 'shape') {
      if (!SHAPES.includes(item.shape) || !color(item.color)) throw new Error('도형 종류 또는 색상이 올바르지 않습니다.');
      const result={ ...base, shape:item.shape, color:item.color };
      for(const key of ['fillOpacity','strokeOpacity'])if(item[key]!==undefined){if(!finite(item[key],0,1))throw new Error('도형 내부 또는 테두리 불투명도가 올바르지 않습니다.');result[key]=item[key];}
      if(item.strokeWidth!==undefined){if(!finite(item.strokeWidth,0,80))throw new Error('테두리 두께가 올바르지 않습니다.');result.strokeWidth=item.strokeWidth;}
      if(item.strokeColor!==undefined){if(!color(item.strokeColor))throw new Error('테두리 색상이 올바르지 않습니다.');result.strokeColor=item.strokeColor;}
      return result;
    }
    if (!item.image) throw new Error('이미지 요소의 이미지가 없습니다.');
    return { ...base, image:validateImage(item.image) };
  });
}

export function elementsOf(doc) {
  if (doc.elements) return doc.elements;
  if (!doc.text) return [];
  const canvasHeight={'1:1':1080,'4:5':1350,'9:16':1920}[doc.ratio];
  const estimatedLines=doc.text.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(Array.from(line).length/(1080*.82/doc.size))),0);
  const height=Math.min(.90-doc.y,Math.max(.12,estimatedLines*doc.size*1.34/canvasHeight+.025));
  return [{id:'original-text',type:'text',text:doc.text,font:doc.font,size:doc.size,color:doc.color,align:doc.align,x:doc.x,y:doc.y,width:Math.min(.82,1-doc.x),height,opacity:1}];
}
export function upgradeDocument(doc) { return { ...doc, text:'', elements:elementsOf(doc).map(item=>({...item})) }; }
export function fitElement(element,patch) {
  const next={...element,...patch};
  next.width=Math.max(.02,Math.min(1,next.width));next.height=Math.max(.02,Math.min(1,next.height));
  if(next.type==='text'){
    next.preferredWidth=Math.max(.02,Math.min(1,patch.width??element.preferredWidth??element.width));
    next.x=Math.max(0,Math.min(.98,next.x));next.y=Math.max(0,Math.min(.98,next.y));
    next.width=Math.min(next.preferredWidth,1-next.x);next.height=Math.min(next.height,1-next.y);
    if(Object.hasOwn(patch,'height'))next.autoHeight=false;
    else if(['x','y','width'].some(key=>Object.hasOwn(patch,key)))next.autoHeight=true;
    return next;
  }
  next.x=Math.max(0,Math.min(1-next.width,next.x));next.y=Math.max(0,Math.min(1-next.height,next.y));
  return next;
}
export function hitElement(items,x,y,W=1,H=1) {
  for (let i=items.length-1;i>=0;i--) {
    const e=items[i],p=unrotatePoint(e,x,y,W,H);if(e.opacity===0 || p.x<e.x || p.y<e.y || p.x>e.x+e.width || p.y>e.y+e.height)continue;
    if(e.type==='shape'&&e.shape==='ellipse'&&((p.x-e.x)/e.width-.5)**2*4+((p.y-e.y)/e.height-.5)**2*4>1)continue;
    return e;
  }
  return null;
}
export function reorderElement(items,id,offset) {
  const result=[...items],index=result.findIndex(e=>e.id===id);if(index<0)return result;
  const next=Math.max(0,Math.min(result.length-1,index+offset));const [item]=result.splice(index,1);result.splice(next,0,item);return result;
}
