export async function encodeImage(canvas,format='png'){
  if(!['png','jpg'].includes(format))throw new Error('PNG 또는 JPG 형식을 선택해 주세요.');
  const mime=format==='jpg'?'image/jpeg':'image/png';
  let output=canvas;
  if(format==='jpg'){
    output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
    const ctx=output.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,output.width,output.height);ctx.drawImage(canvas,0,0);
  }
  const blob=await new Promise(resolve=>output.toBlob(resolve,mime,format==='jpg'?.94:undefined));
  if(!blob||blob.type!==mime)throw new Error('선택한 형식의 이미지 파일을 만들지 못했습니다.');
  return {blob,extension:format,label:format.toUpperCase()};
}
