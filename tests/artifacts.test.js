import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for(const [file,width,height] of [['card-1.png',1080,1350],['card-2.png',1080,1080],['card-3.png',1080,1920]]){
  test(`${file}: PNG 구조·크기·위치 메타데이터 검사`,()=>{
    const b=readFileSync(new URL('../examples/'+file,import.meta.url));
    assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(b.readUInt32BE(16),width);assert.equal(b.readUInt32BE(20),height);
    let i=8;const chunks=[];
    while(i<b.length){const len=b.readUInt32BE(i),type=b.toString('ascii',i+4,i+8);assert.ok(i+12+len<=b.length);chunks.push(type);i+=len+12;}
    assert.equal(i,b.length);assert.equal(chunks[0],'IHDR');assert.equal(chunks.at(-1),'IEND');assert.ok(chunks.includes('IDAT'));
    for(const type of chunks)assert.ok(['IHDR','IDAT','IEND','sRGB','cHRM','gAMA','pHYs'].includes(type),`검토가 필요한 메타데이터: ${type}`);
  });
}
