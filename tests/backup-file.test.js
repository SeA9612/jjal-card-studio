import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_BACKUP_BYTES,checkBackupFileSize,createBackupBlob} from '../backup-file.js';
test('내보내기와 가져오기의 공통 용량 검사는 128MB 경계를 일관되게 적용한다',()=>{
  assert.doesNotThrow(()=>checkBackupFileSize(MAX_BACKUP_BYTES));
  assert.throws(()=>checkBackupFileSize(MAX_BACKUP_BYTES+1),/128MB/);
  for(const invalid of [-1,NaN,Infinity])assert.throws(()=>checkBackupFileSize(invalid));
});
test('이전에 가져오기가 거부되던 40MB 초과 파일을 생성하고 다시 읽을 수 있다',async()=>{
  const content='x'.repeat(41*1024*1024),blob=createBackupBlob({content});
  assert.ok(blob.size>40*1024*1024);assert.doesNotThrow(()=>checkBackupFileSize(blob.size));
  const decoded=JSON.parse(await blob.text());assert.equal(decoded.content.length,content.length);assert.equal(decoded.content,content);
});
test('한글·이모지가 포함된 백업은 문자 수가 아닌 실제 UTF-8 바이트로 계산한다',async()=>{
  const data={text:'한글 👨‍👩‍👧‍👦'},blob=createBackupBlob(data);
  assert.equal(blob.size,new TextEncoder().encode(JSON.stringify(data,null,2)).length);
  assert.deepEqual(JSON.parse(await blob.text()),data);
});
