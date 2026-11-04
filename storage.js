let connection;
export function openDatabase() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('jjal-card-studio', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('templates', { keyPath: 'id' });
      request.result.createObjectStore('settings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('브라우저 저장소를 열지 못했습니다. 브라우저의 저장 공간 설정을 확인해 주세요.'));
    request.onblocked = () => reject(new Error('다른 탭을 닫고 다시 시도해 주세요.'));
  });
  return connection;
}
export async function readAll(store) {
  const db = await openDatabase();
  return new Promise((resolve,reject) => { const req = db.transaction(store).objectStore(store).getAll(); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
}
export async function readSetting(key) {
  const db = await openDatabase();
  return new Promise((resolve,reject) => { const req = db.transaction('settings').objectStore('settings').get(key); req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error); });
}
export async function transaction(store, perform) {
  const db = await openDatabase();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error || new Error('저장이 취소되었습니다.'));
    try { perform(tx.objectStore(store)); } catch(error) { tx.abort(); reject(error); }
  });
}
export const writeSetting = (key,value) => transaction('settings',store=>store.put(value,key));
export async function restoreBackupItems(items,editor){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['templates','settings'],'readwrite');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('복원이 취소되었습니다.'));
    try{for(const item of items)tx.objectStore('templates').put(item);if(editor)tx.objectStore('settings').put(editor,'backup-editor');}
    catch(error){tx.abort();reject(error);}
  });
}
