import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, validateDocument, validateBackup, planElementText, graphemes } from '../core.js';
import { upgradeDocument, elementsOf, fitElement, hitElement, reorderElement, SHAPES } from '../elements.js';
const shape=(id='shape-1')=>({id,type:'shape',shape:'rect',x:.2,y:.3,width:.3,height:.2,color:'#f18a53',opacity:1});
const text=()=>({id:'text-2',type:'text',text:'두 번째 문구 👨‍👩‍👧‍👦',font:'sans',size:72,color:'#28251f',align:'center',x:.1,y:.1,width:.8,height:.2,opacity:.7});
const image=()=>({id:'image-1',type:'image',x:0,y:0,width:.2,height:.2,opacity:1,image:{dataUrl:'data:image/png;base64,iVBORw0KGgoAAA=',width:1,height:1,credit:{kind:'own',url:'',license:''}}});
test('기존 문서와 백업을 텍스트 요소로 이관하며 원문을 보존한다',()=>{const old={...DEFAULT};const upgraded=upgradeDocument(old);assert.equal(upgraded.elements.length,1);assert.equal(upgraded.elements[0].text,old.text);assert.equal(upgradeDocument(upgraded).elements.length,1);assert.equal(old.elements,undefined);});
test('텍스트·이미지·도형이 JSON 백업 왕복 뒤 같은 순서로 유지된다',()=>{const doc={...DEFAULT,elements:[text(),image(),shape()],decorations:false,backgroundColor:'#ffffff'};const backup={app:'jjal-card-studio',version:1,templates:[{id:'template-1',name:'혼합 요소',updatedAt:'2026-11-03T00:00:00Z',doc}]};assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(backup)))[0].doc,doc);});
test('요소가 없는 카드도 저장할 수 있다',()=>{assert.deepEqual(validateDocument({...DEFAULT,elements:[]}).elements,[]);assert.deepEqual(elementsOf({...DEFAULT,text:''}),[]);});
test('이관한 문구를 삭제하면 이전 형식의 숨은 복사본이 남지 않는다',()=>{const upgraded=upgradeDocument(DEFAULT);assert.equal(upgraded.text,'');const deleted=validateDocument({...upgraded,elements:[]});assert.equal(deleted.text,'');assert.deepEqual(deleted.elements,[]);});
test('중복 ID·알 수 없는 도형·누락된 이미지·화면 밖 요소는 전체 가져오기를 거부한다',()=>{for(const elements of [[shape(),shape()],[{...shape(),shape:'script'}],[{...image(),image:null}],[{...shape(),x:.9}]])assert.throws(()=>validateDocument({...DEFAULT,elements}));});
test('요소 50개 한도를 검사한다',()=>{assert.throws(()=>validateDocument({...DEFAULT,elements:Array.from({length:51},(_,i)=>shape('shape-'+i))}));});
test('크기·위치 조절은 다른 요소를 바꾸지 않고 캔버스 안으로 제한한다',()=>{const original=shape();const moved=fitElement(original,{x:2,y:-1,width:.6,height:.4});assert.equal(moved.x,.4);assert.equal(moved.y,0);assert.equal(original.x,.2);assert.equal(original.width,.3);});
test('겹친 요소는 맨 앞을 선택하고 빈 곳에서는 선택이 해제된다',()=>{const a=shape('back'),b=shape('front');assert.equal(hitElement([a,b],.25,.35).id,'front');assert.equal(hitElement([a,b],.99,.99),null);assert.equal(hitElement([{...a,shape:'ellipse'}],.2,.3),null);});
test('앞뒤 순서를 바꿔도 ID와 나머지 요소의 순서가 유지된다',()=>{const items=[shape('a'),shape('b'),shape('c')];assert.deepEqual(reorderElement(items,'b',1).map(x=>x.id),['a','c','b']);assert.deepEqual(items.map(x=>x.id),['a','b','c']);assert.equal(hitElement(reorderElement(items,'a',2),.25,.35).id,'a');});
test('오른쪽으로 이동하는 텍스트는 멈추지 않고 폭을 줄여 재배치하며 돌아오면 폭이 복원된다',()=>{
 const original={...text(),text:'가나다라마바사아자차카타파하',x:.1,width:.82,size:64,autoHeight:true};
 const moved=fitElement(original,{x:.72});assert.equal(moved.x,.72);assert.ok(Math.abs(moved.width-.28)<1e-9);assert.equal(moved.preferredWidth,.82);
 const measure=(s,size)=>graphemes(s).length*size;
 const before=planElementText(original,'4:5',measure),after=planElementText(moved,'4:5',measure);
 assert.ok(after.lines.length>before.lines.length);assert.equal(after.size,64);assert.equal(after.overflow,false);assert.ok(after.height>before.height);
 assert.equal(fitElement(moved,{x:.1}).width,.82);assert.equal(original.width,.82);
});
test('사용자가 텍스트 상자 크기를 직접 바꾸면 그 폭이 새 기준이 되고 높이는 수동 설정된다',()=>{
 const resized=fitElement({...text(),preferredWidth:.8,autoHeight:true},{width:.5,height:.3});assert.equal(resized.preferredWidth,.5);assert.equal(resized.autoHeight,false);
 const moved=fitElement(resized,{x:.8});assert.equal(moved.autoHeight,true);assert.ok(moved.width<.5);assert.equal(fitElement(moved,{x:0}).width,.5);
 assert.deepEqual(validateDocument({...DEFAULT,elements:[moved]}).elements[0],moved);
});
test('하트와 말풍선을 포함한 열 가지 도형을 JSON으로 보관할 수 있다',()=>{
 assert.equal(SHAPES.length,10);assert.ok(SHAPES.includes('heart'));assert.ok(SHAPES.includes('bubble'));
 const elements=SHAPES.map((kind,i)=>({...shape('shape-'+i),shape:kind}));assert.deepEqual(validateDocument({...DEFAULT,elements}).elements,elements);
});
