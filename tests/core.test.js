import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, graphemes, wrapText, planText, validateBackup, validateDocument, identifyImage } from '../core.js';
const template = () => ({id:'test-template-1',name:'검사용',updatedAt:'2026-11-03T00:00:00.000Z',doc:{...DEFAULT}});
const backup = () => ({app:'jjal-card-studio',version:1,templates:[template()]});

test('긴 한글은 폭에 맞춰 줄바꿈되며 원문이 보존된다',()=>{const text='길게 이어지는 한글 문구를 검사합니다'.repeat(10);const lines=wrapText(text,10,s=>graphemes(s).length);assert.equal(lines.join(''),text);assert.ok(lines.every(s=>graphemes(s).length<=10));});
test('한영 혼합 문구의 문자 순서가 유지된다',()=>{const text='오늘도 Hello 123 한 장의 FRAME';assert.equal(wrapText(text,8,s=>graphemes(s).length).join(''),text);});
test('명시적인 빈 줄과 마지막 줄바꿈이 보존된다',()=>{assert.deepEqual(wrapText('첫 줄\n\n마지막\n',100,s=>s.length),['첫 줄','','마지막','']);});
test('가족·피부색·국기 이모지를 중간에서 분리하지 않는다',()=>{const text='👨‍👩‍👧‍👦👍🏽🇰🇷';assert.equal(graphemes(text).length,3);assert.deepEqual(wrapText(text,1,s=>graphemes(s).length),['👨‍👩‍👧‍👦','👍🏽','🇰🇷']);});
test('빈 문구도 유효한 편집 데이터다',()=>{assert.equal(validateDocument({...DEFAULT,text:''}).text,'');});
test('세 화면비에서 문구가 영역에 맞게 자동 축소된다',()=>{for(const ratio of ['1:1','4:5','9:16']){const doc={...DEFAULT,ratio,text:'가나다라마바사아자차카타파하'.repeat(30)};const result=planText(doc,(s,size)=>graphemes(s).length*size);assert.ok(result.size<doc.size);assert.equal(result.overflow,false);}});
test('처리 한계를 넘는 문구는 넘침으로 표시한다',()=>{const result=planText({...DEFAULT,text:'가\n'.repeat(500)},(s,size)=>s.length*size);assert.equal(result.overflow,true);});
test('정상 JSON을 검증해 템플릿을 복원한다',()=>{const b=backup();assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(b))),b.templates);});
test('문법이 손상된 JSON은 파싱에 실패한다',()=>{assert.throws(()=>JSON.parse('{"templates":['));});
test('필수 항목 누락을 거부하고 전달된 목록은 바꾸지 않는다',()=>{const b=backup();delete b.templates[0].doc.ratio;const before=JSON.stringify(b);assert.throws(()=>validateBackup(b));assert.equal(JSON.stringify(b),before);});
test('중복 ID와 무효한 좌표·색상을 거부한다',()=>{const b=backup();b.templates.push(template());assert.throws(()=>validateBackup(b));for(const patch of [{x:Infinity},{color:'javascript:bad'},{ratio:'__proto__'},{image:{}}])assert.throws(()=>validateDocument({...DEFAULT,...patch}));});
test('확장자 대신 PNG·JPEG 시그니처로 이미지 형식을 검사한다',()=>{assert.equal(identifyImage(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');assert.equal(identifyImage(new Uint8Array([255,216,255,224])),'image/jpeg');assert.throws(()=>identifyImage(new TextEncoder().encode('<svg></svg>')));});
test('외부 이미지에는 URL과 사용 허가 근거가 필요하다',()=>{const image={dataUrl:'data:image/png;base64,iVBORw0KGgoAAA=',width:1,height:1,credit:{kind:'external',url:'',license:''}};assert.throws(()=>validateDocument({...DEFAULT,image}));});
