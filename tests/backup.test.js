import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,createBackup,validateBackupContents} from '../core.js';
const template=i=>({id:'backup-'+i,name:'저장 카드 '+i,updatedAt:'2026-11-04T00:00:00Z',doc:{...DEFAULT,text:'저장한 문구 '+i}});
test('템플릿을 저장하지 않아도 현재 편집 작업은 파일에 포함되고 복원된다',()=>{
  const editor={...DEFAULT,text:'아직 템플릿에 저장하지 않은 문구'};
  const backup=createBackup(editor,[]);assert.equal(backup.version,2);
  const restored=validateBackupContents(JSON.parse(JSON.stringify(backup)));
  assert.equal(restored.editor.text,editor.text);assert.deepEqual(restored.templates,[]);
});
test('과거의 템플릿 0개 백업은 성공으로 표시하지 않고 이유를 안내한다',()=>{
  assert.throws(()=>validateBackupContents({app:'jjal-card-studio',version:1,templates:[]}),/복원할 카드가 없습니다/);
});
test('기존 템플릿 백업은 새 형식에서도 그대로 읽는다',()=>{
  const templates=[template(1)];assert.deepEqual(validateBackupContents({app:'jjal-card-studio',version:1,templates}),{templates,editor:null});
});
test('템플릿 30개와 별도의 현재 작업을 한 파일에 보관한다',()=>{
  const backup=createBackup(DEFAULT,Array.from({length:30},(_,i)=>template(i)));
  assert.equal(validateBackupContents(backup).templates.length,30);assert.equal(backup.editor.text,DEFAULT.text);
});
test('새 형식에서 현재 작업이 없거나 손상되면 모든 복원을 거부한다',()=>{
  for(const editor of [undefined,null,{...DEFAULT,ratio:'bad'}]){
    const backup={app:'jjal-card-studio',version:2,templates:[template(1)],editor};const original=JSON.stringify(backup);
    assert.throws(()=>validateBackupContents(backup));assert.equal(JSON.stringify(backup),original);
  }
});
