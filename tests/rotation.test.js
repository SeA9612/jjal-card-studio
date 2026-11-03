import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRotation, draggedRotation, unrotatePoint, rotateContext, resizeInRotation } from '../rotation.js';
import { hitElement } from '../elements.js';
import { DEFAULT, validateBackup, validateDocument } from '../core.js';
const item={id:'rotated',type:'shape',shape:'rect',x:.3,y:.3,width:.4,height:.1,opacity:1,color:'#f18a53',rotation:90};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('corner drag preserves initial rotation, crosses the angle seam, and snaps to 15 degrees',()=>{
  assert.equal(draggedRotation(20,0,Math.PI/2),110);
  assert.equal(draggedRotation(0,179*Math.PI/180,-179*Math.PI/180),2);
  assert.equal(draggedRotation(-20,0,-Math.PI/4),-65);
  assert.equal(draggedRotation(0,0,22*Math.PI/180,true),15);
});
test('portrait canvas selection follows the rotated object, not its old box',()=>{
  assert.equal(hitElement([item],.5,.46,1080,1920)?.id,item.id);
  assert.equal(hitElement([item],.31,.35,1080,1920),null);
  const p=unrotatePoint(item,.5,.46,1080,1920);near(p.x,.5+.11*1920/1080);near(p.y,.35);
});
test('rotation renders around the same center as hit testing on portrait canvases',()=>{
  const calls=[],ctx={translate:(...v)=>calls.push(v),rotate:a=>calls.push(a)};
  rotateContext(ctx,item,1080,1920);assert.deepEqual(calls[0],[540,672]);near(calls[1],Math.PI/2);assert.deepEqual(calls[2],[-540,-672]);
  calls.length=0;rotateContext(ctx,{...item,rotation:0},1080,1920);assert.equal(calls.length,0);
});
test('rotated resizing follows local axes and keeps opposite corner fixed',()=>{
  const patch=resizeInRotation(item,0,.05,1080,1920);near(patch.width,item.width+.05*1920/1080);near(patch.height,item.height);
  const anchor=e=>{const cx=(e.x+e.width/2)*1080,cy=(e.y+e.height/2)*1920;return [cx+e.height*1920/2,cy-e.width*1080/2];};
  const before=anchor(item),after=anchor({...item,...patch});near(before[0],after[0]);near(before[1],after[1]);
  const locked=resizeInRotation(item,.02,.08,1080,1920,true);near(locked.width/locked.height,item.width/item.height);
});
test('all element types retain angles through JSON and old documents remain unchanged',()=>{
  const text={...item,id:'text',type:'text',text:'회전 문구',font:'sans',size:60,align:'left',rotation:-32};delete text.shape;
  const image={...item,id:'image',type:'image',rotation:180,image:{dataUrl:'data:image/png;base64,iVBORw0KGgoAAA=',width:1,height:1,credit:{kind:'own',url:'',license:''}}};delete image.shape;delete image.color;
  const doc={...DEFAULT,elements:[item,text,image]};
  const backup={app:'jjal-card-studio',version:1,templates:[{id:'rotation-test',name:'회전 저장',updatedAt:'2026-11-03T00:00:00Z',doc}]};
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(backup)))[0].doc,doc);
  const old={...item};delete old.rotation;assert.deepEqual(validateDocument({...DEFAULT,elements:[old]}).elements,[old]);
  for(const rotation of [NaN,Infinity,181,'30',null])assert.throws(()=>validateDocument({...DEFAULT,elements:[{...item,rotation}]}));
  assert.equal(normalizeRotation(270),-90);assert.equal(normalizeRotation(-450),-90);
});
