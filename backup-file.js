// Export and import must accept the same UTF-8 file size.
export const MAX_BACKUP_BYTES=128*1024*1024;
export function checkBackupFileSize(bytes){
  if(!Number.isSafeInteger(bytes)||bytes<0)throw new Error('백업 파일 크기를 확인하지 못했습니다.');
  if(bytes>MAX_BACKUP_BYTES)throw new Error('백업 파일은 최대 128MB까지 지원합니다. 이미지나 템플릿을 줄인 뒤 다시 시도해 주세요.');
}
export function createBackupBlob(backup){
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  checkBackupFileSize(blob.size);
  return blob;
}
