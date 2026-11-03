import { DEFAULT, RATIOS, PALETTES, STARTERS, planText, validateDocument, validateBackup, identifyImage } from './core.js';
import { readAll, readSetting, writeSetting, transaction } from './storage.js';

const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const canvas = $('#canvas'), paper = $('.paper'), selection = $('.selection');
let doc = { ...DEFAULT }, history = [], future = [], templates = [], library = 'starter', showSelection = true;
let layout, revision = 0, saveTimer, drawTimer, toastTimer, templateEditId = null, confirmCallback, pendingImage = null, drag;
let uploadRevision = 0, saveQueue = Promise.resolve(), storageReady = false;
const imageCache = new Map();
const safeError = error => error?.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다. JSON으로 백업한 뒤 불필요한 템플릿을 정리해 주세요.' : (error?.message || '처리하지 못했습니다. 다시 시도해 주세요.');
function toast(message, error = false) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.toggle('error', error); $('#toast').hidden = false;
  $('#toast').setAttribute('role', error ? 'alert' : 'status');
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 8500 : 4800);
}
function checkpoint() { history.push({ ...doc }); if (history.length > 25) history.shift(); future = []; }
function markSave() {
  clearTimeout(saveTimer); $('#save-state').textContent = '● 변경 사항 저장 중…';
  saveTimer = setTimeout(() => {
    const saved = { ...doc };
    saveQueue = saveQueue.catch(() => {}).then(() => writeSetting('editor', saved)).then(() => { $('#save-state').textContent = '● 이 브라우저에 저장됨'; }).catch(error => { $('#save-state').textContent = '● 자동 저장 실패 · JSON 백업 권장'; toast(safeError(error), true); });
  }, 300);
}
function imageElement(dataUrl) {
  if (!imageCache.has(dataUrl)) {
    const promise = new Promise((resolve,reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('이미지를 해석하지 못했습니다.')); img.src = dataUrl; });
    imageCache.set(dataUrl, promise); if (imageCache.size > 8) imageCache.delete(imageCache.keys().next().value);
  }
  return imageCache.get(dataUrl);
}
async function renderArtwork(documentState) {
  const c = document.createElement('canvas'), [W,H] = RATIOS[documentState.ratio]; c.width = W; c.height = H;
  const ctx = c.getContext('2d'), pal = PALETTES[documentState.preset];
  ctx.fillStyle = pal[0]; ctx.fillRect(0,0,W,H);
  if (documentState.image) {
    const img = await imageElement(documentState.image.dataUrl), scale = Math.max(W/img.naturalWidth,H/img.naturalHeight);
    const w = img.naturalWidth*scale, h = img.naturalHeight*scale; ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h);
  } else {
    ctx.fillStyle=pal[1]; ctx.beginPath();ctx.arc(W*.83,H*.80,W*.40,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=pal[2]; ctx.beginPath();ctx.arc(W*.83,H*.80,W*.27,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle=pal[0]+'45';for(let r=120;r<275;r+=22){ctx.beginPath();ctx.arc(W*.83,H*.80,r,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle=pal[0];ctx.beginPath();ctx.arc(W*.83,H*.80,48,0,Math.PI*2);ctx.fill();ctx.fillStyle=pal[1];ctx.beginPath();ctx.arc(W*.83,H*.80,10,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle=pal[2];ctx.font='500 25px "Segoe UI",sans-serif';ctx.fillText('FRAME  /  EVERYDAY COLLECTION',W*.09,90);ctx.fillRect(W*.09,120,W*.82,2);
  const family = documentState.font === 'serif' ? '"Batang","AppleMyungjo","Georgia",serif' : '"Malgun Gothic","Apple SD Gothic Neo","Segoe UI",sans-serif';
  const measure = (text,size) => { ctx.font=`750 ${size}px ${family}`; return ctx.measureText(text).width; };
  const plan = planText(documentState,measure);
  ctx.save();ctx.beginPath();ctx.rect(0,0,W,H*.91);ctx.clip();
  ctx.font=`750 ${plan.size}px ${family}`;ctx.textBaseline='top';ctx.fillStyle=documentState.color;
  plan.lines.forEach((line,i) => { let x=plan.x; const w=ctx.measureText(line).width; if(documentState.align==='center') x+=(plan.width-w)/2; if(documentState.align==='right')x+=plan.width-w; ctx.fillText(line,x,plan.y+i*plan.size*1.34); });ctx.restore();
  ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle=pal[2];ctx.font='500 23px "Malgun Gothic",sans-serif';ctx.fillText('나의 일상, 나의 문장.',W*.09,H-83);ctx.font='500 19px "Segoe UI",sans-serif';ctx.fillText('ARCHIVE NO. 001',W*.09,H-47);ctx.textAlign='right';ctx.fillText('MADE BY YOU',W*.91,H-47);
  return { canvas:c, layout:plan };
}
async function draw() {
  const token=++revision, current={...doc};
  try {
    const result=await renderArtwork(current);if(token!==revision)return;
    canvas.width=result.canvas.width;canvas.height=result.canvas.height;canvas.getContext('2d').drawImage(result.canvas,0,0);layout=result.layout;
    paper.style.width=Math.min(window.innerWidth>1500?400:370,460*canvas.width/canvas.height)+'px';
    selection.style.left=(layout.x/canvas.width*100)+'%';selection.style.top=(layout.y/canvas.height*100)+'%';selection.style.width=(layout.width/canvas.width*100)+'%';selection.style.height=(layout.height/canvas.height*100)+'%';selection.hidden=!showSelection||!doc.text;
    $('#dimensions').textContent=`${canvas.width} × ${canvas.height} px`;
    $('#layout-note').textContent=layout.overflow?'文구가 영역을 넘습니다. 글을 줄이거나 위치를 위로 옮겨 주세요.':layout.size<doc.size?`문구가 잘리지 않도록 ${layout.size}px로 자동 맞춤했어요.`:'';
    canvas.setAttribute('aria-label','카드 미리보기: '+(doc.text||'빈 문구'));
  } catch(error){toast(safeError(error),true);}
}
function sync() {
  $('#text').value=doc.text;$('#font').value=doc.font;$('#size').value=doc.size;$('#size-output').textContent=doc.size+' px';$('#color').value=doc.color;
  $('#x').value=Math.round(doc.x*100);$('#y').value=Math.round(doc.y*100);$('#x-output').textContent=Math.round(doc.x*100)+'%';$('#y-output').textContent=Math.round(doc.y*100)+'%';$('#char-count').textContent=doc.text.length.toLocaleString()+' / 12,000';
  $$('[data-ratio]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ratio===doc.ratio)));
  $('[data-action=undo]').disabled=!history.length;$('[data-action=redo]').disabled=!future.length;
  $('#image-info').textContent=doc.image?`${doc.image.width} × ${doc.image.height} · ${doc.image.credit.kind==='own'?'본인 제작':'출처 기록됨'}`:'직접 구성한 도형 배경';$('#credit-button').hidden=!doc.image;
  draw();
}
function change(patch,{record=true}={}){if(record)checkpoint();doc={...doc,...patch};sync();markSave();}
$('#text').addEventListener('focus',checkpoint);
$('#text').addEventListener('input',e=>{doc={...doc,text:e.target.value};future=[];$('#char-count').textContent=doc.text.length.toLocaleString()+' / 12,000';$('[data-action=undo]').disabled=!history.length;$('[data-action=redo]').disabled=true;clearTimeout(drawTimer);drawTimer=setTimeout(draw,55);markSave();});
for(const name of ['size','x','y']){
  const field=$('#'+name);field.addEventListener('pointerdown',checkpoint);field.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow'))checkpoint();});
  field.addEventListener('input',e=>change({[name]:Number(e.target.value)/(name==='size'?1:100)},{record:false}));
}
$('#font').addEventListener('change',e=>change({font:e.target.value}));$('#color').addEventListener('change',e=>change({color:e.target.value}));
$$('[data-color]').forEach(b=>b.addEventListener('click',()=>change({color:b.dataset.color})));
$$('[data-ratio]').forEach(b=>b.addEventListener('click',()=>change({ratio:b.dataset.ratio})));
paper.addEventListener('pointerdown',e=>{if(e.button!==0)return;checkpoint();const r=paper.getBoundingClientRect();drag={x:doc.x,y:doc.y,px:e.clientX,py:e.clientY,w:r.width,h:r.height};paper.setPointerCapture(e.pointerId);});
paper.addEventListener('pointermove',e=>{if(!drag)return;doc={...doc,x:Math.max(.04,Math.min(.70,drag.x+(e.clientX-drag.px)/drag.w)),y:Math.max(.14,Math.min(.80,drag.y+(e.clientY-drag.py)/drag.h))};sync();});
paper.addEventListener('pointerup',()=>{if(drag){drag=null;markSave();}});paper.addEventListener('pointercancel',()=>{drag=null;markSave();});
function confirmAction(title,description,callback){$('#confirm-title').textContent=title;$('#confirm-description').textContent=description;confirmCallback=callback;$('#confirm-dialog').showModal();}
$('#confirm-button').addEventListener('click',async()=>{const fn=confirmCallback;$('#confirm-dialog').close();try{await fn?.();}catch(error){toast(safeError(error),true);}});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
function openTemplate(id=null){templateEditId=id;const item=templates.find(t=>t.id===id);$('#template-dialog-title').textContent=item?'템플릿 수정':'내 템플릿 저장';$('#template-name').value=item?.name||'';$('#template-error').textContent='';$('#template-dialog').showModal();}
$('#template-form').addEventListener('submit',async e=>{
  e.preventDefault();const name=$('#template-name').value.trim();if(!name){$('#template-error').textContent='이름을 입력해 주세요.';return;}
  try{
    if(!templateEditId&&templates.length>=30)throw new Error('템플릿은 최대 30개까지 보관할 수 있습니다.');
    const item={id:templateEditId||crypto.randomUUID(),name,updatedAt:new Date().toISOString(),doc:validateDocument(doc)};
    await transaction('templates',store=>store.put(item));await refreshTemplates();library='mine';await displayLibrary();$('#template-dialog').close();toast(templateEditId?'현재 편집 내용으로 템플릿을 수정했습니다.':'이미지까지 포함해 템플릿을 저장했습니다.');
  }catch(error){$('#template-error').textContent=safeError(error);}
});
async function refreshTemplates(){templates=(await readAll('templates')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));$('#template-count').textContent=templates.length;}
async function displayLibrary(){
  const grid=$('#template-grid');grid.replaceChildren();$$('[data-library]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.library===library)));
  const items=library==='starter'?STARTERS:templates;
  if(!items.length){const empty=document.createElement('div');empty.className='empty-templates';const p=document.createElement('p');p.textContent='아직 나만의 템플릿이 없어요.';const b=document.createElement('button');b.textContent='＋ 현재 디자인 저장';b.addEventListener('click',()=>openTemplate());empty.append(p,b);grid.append(empty);return;}
  for(const item of items){
    const card=document.createElement('article');card.className='template-card';const load=document.createElement('button');load.className='template-load';load.setAttribute('aria-label',item.name+' 불러오기');
    const img=document.createElement('img');img.className='template-preview';img.alt=item.name+' 미리보기';const caption=document.createElement('span');caption.className='template-caption';const name=document.createElement('strong');name.textContent=item.name;const ratio=document.createElement('span');ratio.textContent=item.doc.ratio;caption.append(name,ratio);load.append(img,caption);
    load.addEventListener('click',()=>{change(validateDocument(item.doc));toast(item.name+' 템플릿을 불러왔습니다.');});card.append(load);grid.append(card);
    renderArtwork(item.doc).then(r=>{img.src=r.canvas.toDataURL('image/jpeg',.65);}).catch(()=>{img.alt='미리보기를 읽지 못했습니다.';});
    if(library==='mine'){
      const actions=document.createElement('div');actions.className='template-actions';const edit=document.createElement('button');edit.textContent='수정';edit.setAttribute('aria-label',item.name+' 수정');edit.addEventListener('click',()=>openTemplate(item.id));
      const remove=document.createElement('button');remove.textContent='삭제';remove.setAttribute('aria-label',item.name+' 삭제');remove.addEventListener('click',()=>confirmAction('템플릿 삭제',`‘${item.name}’을 삭제할까요? 현재 편집 중인 카드는 유지됩니다.`,async()=>{await transaction('templates',s=>s.delete(item.id));await refreshTemplates();await displayLibrary();toast('템플릿을 삭제했습니다.');}));actions.append(edit,remove);card.append(actions);
    }
  }
  const add=document.createElement('button');add.className='template-add';const plus=document.createElement('span');plus.textContent='＋';add.append(plus,document.createTextNode('현재 디자인 저장'));add.addEventListener('click',()=>openTemplate());grid.append(add);
}
$$('[data-library]').forEach(b=>b.addEventListener('click',()=>{library=b.dataset.library;displayLibrary();}));
async function normalizeImage(file){
  if(file.size>15*1024*1024)throw new Error('이미지는 15MB 이하로 선택해 주세요.');
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer()),type=identifyImage(bytes);
  if(file.type&&file.type!==type)throw new Error('파일 형식과 실제 내용이 다릅니다. PNG·JPEG 파일을 다시 선택해 주세요.');
  const url=URL.createObjectURL(file);
  try{
    const img=await imageElement(url);if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('이미지가 너무 큽니다. 4천만 화소 이하로 줄여 주세요.');
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return {dataUrl:c.toDataURL('image/png'),width:c.width,height:c.height,credit:{kind:'own',url:'',license:''}};
  }finally{URL.revokeObjectURL(url);imageCache.delete(url);}
}
function creditDialog(image){const credit=image.credit;$('#credit-kind').value=credit.kind;$('#credit-url').value=credit.url;$('#credit-license').value=credit.license;$('#credit-error').textContent='';$('#credit-dialog').showModal();}
$('#image-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;const ticket=++uploadRevision;
  try{const image=await normalizeImage(file);if(ticket!==uploadRevision)return;pendingImage=image;creditDialog(image);}
  catch(error){if(ticket===uploadRevision)toast(safeError(error)+' 기존 작업은 유지됩니다.',true);}
});
$('#credit-dialog').addEventListener('close',()=>{pendingImage=null;});
$('#credit-form').addEventListener('submit',e=>{e.preventDefault();try{const image=pendingImage||doc.image;if(!image)throw new Error('이미지를 먼저 선택해 주세요.');const next={...image,credit:{kind:$('#credit-kind').value,url:$('#credit-url').value.trim(),license:$('#credit-license').value.trim()}};validateDocument({...doc,image:next});change({image:next});$('#credit-dialog').close();toast('이미지와 제작·출처 기록을 적용했습니다.');}catch(error){$('#credit-error').textContent=safeError(error);}});
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function downloadPNG(documentState,name='frame-card'){
  await document.fonts.ready;const result=await renderArtwork(validateDocument(documentState));if(result.layout.overflow)throw new Error('문구가 영역을 넘습니다. 글을 줄이거나 위치를 조정한 뒤 저장해 주세요.');
  const blob=await new Promise(resolve=>result.canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG 파일을 만들지 못했습니다.');downloadBlob(blob,name+'-'+documentState.ratio.replace(':','x')+'.png');
  const credit=documentState.image?.credit||{kind:'own',url:'',license:'직접 구성한 도형 배경'};
  $('#save-state').textContent='● PNG 생성 완료 · '+(credit.kind==='own'?'본인 제작 배경':'외부 이미지 출처 기록됨');
}
async function exportJSON(){await refreshTemplates();const backup={app:'jjal-card-studio',version:1,exportedAt:new Date().toISOString(),templates};downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),'jjal-card-templates.json');$('#backup-result').textContent=`템플릿 ${templates.length}개를 JSON으로 내보냈습니다.`;}
$('#json-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const result=$('#backup-result');result.textContent='가져올 파일을 검사하고 있습니다…';
  try{
    if(file.size>40*1024*1024)throw new Error('JSON 파일은 40MB 이하여야 합니다.');
    let data;try{data=JSON.parse(await file.text());}catch{throw new Error('JSON 문법이 손상되었습니다.');}
    const imported=validateBackup(data);await refreshTemplates();if(imported.length+templates.length>30)throw new Error('가져온 뒤 템플릿 수가 30개를 넘습니다. 먼저 기존 목록을 정리해 주세요.');
    for(const t of imported){if(t.doc.image){const img=await imageElement(t.doc.image.dataUrl);if(img.naturalWidth!==t.doc.image.width||img.naturalHeight!==t.doc.image.height)throw new Error('이미지의 실제 크기와 기록된 크기가 다릅니다.');}}
    const ids=new Set(templates.map(t=>t.id));const additions=imported.map(t=>{const next={...t};if(ids.has(next.id)){next.id=crypto.randomUUID();next.name=(next.name+' (복사본)').slice(0,50);}ids.add(next.id);return next;});
    await transaction('templates',store=>additions.forEach(t=>store.put(t)));await refreshTemplates();library='mine';await displayLibrary();result.textContent=`템플릿 ${additions.length}개를 복원했습니다. 기존 템플릿도 유지됩니다.`;
  }catch(error){result.textContent=safeError(error)+' 기존 템플릿과 편집 내용은 변경하지 않았습니다.';toast(result.textContent,true);}
});
async function showGallery(){const grid=$('#gallery-grid');grid.replaceChildren();for(let i=0;i<STARTERS.length;i++){const item=STARTERS[i],article=document.createElement('article');article.className='gallery-item';const img=document.createElement('img');img.src=`./examples/card-${i+1}.png`;img.alt=item.name+' 완성 이미지';const title=document.createElement('h3');title.textContent=item.name+' · '+item.doc.ratio;const button=document.createElement('button');button.textContent='PNG 다운로드';button.addEventListener('click',()=>downloadPNG(item.doc,'example-'+(i+1)).catch(error=>toast(safeError(error),true)));article.append(img,title,button);grid.append(article);}$('#gallery-dialog').showModal();}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  try{switch(b.dataset.action){
    case 'help':$('#help-dialog').showModal();break;
    case 'backup':$('#backup-result').textContent='';$('#backup-dialog').showModal();break;
    case 'export-json':await exportJSON();break;
    case 'save-template':openTemplate();break;
    case 'image':$('#image-input').click();break;
    case 'text':$('#text').focus();break;
    case 'templates':$('#library').scrollIntoView({behavior:'smooth',block:'start'});break;
    case 'gallery':await showGallery();break;
    case 'credit':if(doc.image)creditDialog(doc.image);break;
    case 'remove-image':++uploadRevision;change({image:null});break;
    case 'selection':showSelection=!showSelection;b.setAttribute('aria-pressed',String(showSelection));draw();break;
    case 'align-left':change({align:'left'});break;
    case 'align-center':change({align:'center'});break;
    case 'align-right':change({align:'right'});break;
    case 'up':change({y:Math.max(.14,doc.y-.03)});break;
    case 'down':change({y:Math.min(.80,doc.y+.03)});break;
    case 'reset':confirmAction('처음 디자인으로 돌아가기','현재 편집 내용을 기본 디자인으로 바꿀까요? 저장한 템플릿은 유지되며, 되돌리기로 복구할 수 있습니다.',()=>{++uploadRevision;change({...DEFAULT});});break;
    case 'undo':if(history.length){future.push({...doc});doc=history.pop();sync();markSave();}break;
    case 'redo':if(future.length){history.push({...doc});doc=future.pop();sync();markSave();}break;
    case 'download':await downloadPNG({...doc});toast('PNG 다운로드를 시작했습니다.');break;
  }}catch(error){toast(safeError(error),true);}
});
window.addEventListener('resize',()=>draw());
async function initialize(){
  await document.fonts.ready;
  try{const stored=await readSetting('editor');if(stored)doc=validateDocument(stored);await refreshTemplates();storageReady=true;$('#save-state').textContent='● 이 브라우저에 저장됨';}
  catch(error){$('#save-state').textContent='● 저장소 확인 필요';toast(safeError(error),true);}
  sync();await displayLibrary();
}
initialize();
