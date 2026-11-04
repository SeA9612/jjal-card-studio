import test from 'node:test';
import assert from 'node:assert/strict';
import {fitImageAspect,imagesForCanvas} from '../image-layout.js';
import {DEFAULT,RATIOS,createBackup,validateBackupContents,validateDocument} from '../core.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const image=(w=600,h=600)=>({id:'image-test',type:'image',x:.2,y:.25,width:Math.min(.45,.55*1350/1080*w/h),height:Math.min(.45,.55*1350/1080*w/h)*1080/1350*h/w,opacity:1,rotation:25,aspectLocked:true,image:{width:w,height:h,dataUrl:'data:image/png;base64,iVBORw0KGgoAAA=',credit:{kind:'own',url:'',license:''}}});
test('이전 버전에서 이미 찌그러진 잠금 이미지는 같은 화면비로 열어도 원본 비율로 보정한다',()=>{
  const old={...image(),height:.36};delete old.aspectLocked;
  const [fixed]=imagesForCanvas([old],RATIOS['9:16'],RATIOS['9:16']);
  near(fixed.width*1080/(fixed.height*1920),1);assert.equal(old.height,.36);
});
test('정사각·가로·세로 이미지는 세 화면비에서 원본 비율과 중심을 유지한다',()=>{
  for(const [w,h] of [[600,600],[1200,400],[400,1200]]){
    let item=image(w,h),size=RATIOS['4:5'];
    for(const next of Object.values(RATIOS)){
      const old=item;[item]=imagesForCanvas([item],size,next);
      near(item.width*next[0]/(item.height*next[1]),w/h);
      near(item.x+item.width/2,old.x+old.width/2);near(item.y+item.height/2,old.y+old.height/2);
      assert.equal(item.rotation,25);assert.equal(item.id,old.id);size=next;
    }
  }
});
test('잠기지 않은 이미지와 텍스트·도형의 자유 배치는 화면비 변경 때 그대로 둔다',()=>{
  const free={...image(),aspectLocked:false},text={id:'t',type:'text'},shape={id:'s',type:'shape'};
  assert.deepEqual(imagesForCanvas([free,text,shape],RATIOS['4:5'],RATIOS['9:16']),[free,text,shape]);
});
test('여러 이미지 모두 선택 여부와 관계없이 보정하며 과거의 비율 설정 없는 이미지도 지원한다',()=>{
  const a=image(),b={...image(1200,400),id:'other'};delete b.aspectLocked;
  const items=imagesForCanvas([a,b],RATIOS['4:5'],RATIOS['9:16']);
  near(items[0].width*1080/(items[0].height*1920),1);near(items[1].width*1080/(items[1].height*1920),3);
});
test('큰 세로 이미지와 얇은 이미지를 비율 왜곡 없이 카드 안에 맞춰 저장할 수 있다',()=>{
  for(const [w,h] of [[400,1200],[1,1600],[1600,1]]){
    const item=fitImageAspect({...image(w,h),x:.95,y:.95},RATIOS['1:1'],.9,true);
    near(item.width/item.height,w/h);assert.ok(item.x>=0&&item.y>=0&&item.x+item.width<=1.000001&&item.y+item.height<=1.000001);
    assert.doesNotThrow(()=>validateDocument({...DEFAULT,elements:[item]}));
  }
});
test('이미지별 비율 잠금 설정은 백업 왕복에서 보존되고 잘못된 설정은 거부한다',()=>{
  const elements=[image(),{...image(),id:'unlocked',aspectLocked:false}];
  const restored=validateBackupContents(JSON.parse(JSON.stringify(createBackup({...DEFAULT,elements},[]))));
  assert.deepEqual(restored.editor.elements,elements);
  assert.throws(()=>validateDocument({...DEFAULT,elements:[{...image(),aspectLocked:'yes'}]}));
});
