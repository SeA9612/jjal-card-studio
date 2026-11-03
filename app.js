import { drawShapePath } from './shapes.js?v=20261103-flextext1';
import { DEFAULT, RATIOS, PALETTES, STARTERS, planElementText, validateDocument, validateBackup, validateImage, identifyImage } from './core.js?v=20261103-flextext1';
import { elementsOf, upgradeDocument, fitElement, hitElement, reorderElement } from './elements.js?v=20261103-flextext1';
import { readAll, readSetting, writeSetting, transaction } from './storage.js';

const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const canvas = $('#canvas'), paper = $('.paper'), selection = $('.selection');
let doc = upgradeDocument(DEFAULT), selectedId = null, history = [], future = [], templates = [], library = 'starter', showSelection = true;
let layout, revision = 0, saveTimer, drawTimer, toastTimer, templateEditId = null, confirmCallback, pendingImage = null, creditTarget = 'background', drag;
let uploadRevision = 0, saveQueue = Promise.resolve(), storageReady = false;
const imageCache = new Map(), objectLayouts = new Map();
const shapeNames = {rect:'사각형',ellipse:'원',triangle:'삼각형',star:'별',heart:'하트',bubble:'말풍선',roundrect:'둥근 사각형',diamond:'마름모',arrow:'화살표',hexagon:'육각형'};
const active = () => doc.elements.find(item=>item.id===selectedId);
const labelOf = item => item.type==='text' ? (item.text.trim().split('\n')[0].slice(0,18)||'빈 텍스트') : item.type==='image'?'이미지':shapeNames[item.shape];
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
    imageCache.set(dataUrl, promise); if (imageCache.size > 12) imageCache.delete(imageCache.keys().next().value);
  }
  return imageCache.get(dataUrl);
}
async function renderArtwork(documentState) {
  const c = document.createElement('canvas'), [W,H] = RATIOS[documentState.ratio]; c.width=W;c.height=H;
  const ctx=c.getContext('2d'),pal=PALETTES[documentState.preset],decor=documentState.decorations!==false,plans=new Map();
  ctx.fillStyle=documentState.backgroundColor||pal[0];ctx.fillRect(0,0,W,H);
  if(documentState.image){const img=await imageElement(documentState.image.dataUrl),scale=Math.max(W/img.naturalWidth,H/img.naturalHeight);const w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h);}
  else if(decor){
    ctx.fillStyle=pal[1];ctx.beginPath();ctx.arc(W*.83,H*.80,W*.40,0,Math.PI*2);ctx.fill();ctx.fillStyle=pal[2];ctx.beginPath();ctx.arc(W*.83,H*.80,W*.27,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle=pal[0]+'45';for(let r=120;r<275;r+=22){ctx.beginPath();ctx.arc(W*.83,H*.80,r,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle=pal[0];ctx.beginPath();ctx.arc(W*.83,H*.80,48,0,Math.PI*2);ctx.fill();ctx.fillStyle=pal[1];ctx.beginPath();ctx.arc(W*.83,H*.80,10,0,Math.PI*2);ctx.fill();
  }
  if(decor){ctx.fillStyle=pal[2];ctx.font='500 25px "Segoe UI",sans-serif';ctx.fillText('FRAME  /  EVERYDAY COLLECTION',W*.09,90);ctx.fillRect(W*.09,120,W*.82,2);ctx.font='500 23px "Malgun Gothic",sans-serif';ctx.fillText('나의 일상, 나의 문장.',W*.09,H-83);ctx.font='500 19px "Segoe UI",sans-serif';ctx.fillText('ARCHIVE NO. 001',W*.09,H-47);ctx.textAlign='right';ctx.fillText('MADE BY YOU',W*.91,H-47);ctx.textAlign='left';}
  let overflow=false;
  for(const item of elementsOf(documentState)){
    const x=item.x*W,y=item.y*H,w=item.width*W,h=item.height*H;ctx.save();ctx.globalAlpha=item.opacity;
    if(item.type==='image')ctx.drawImage(await imageElement(item.image.dataUrl),x,y,w,h);
    if(item.type==='shape'){
      ctx.fillStyle=item.color;drawShapePath(ctx,item.shape,x,y,w,h);ctx.fill();
    }
    if(item.type==='text'){
      const family=item.font==='serif'?'"Batang","AppleMyungjo","Georgia",serif':'"Malgun Gothic","Apple SD Gothic Neo","Segoe UI",sans-serif';
      const measure=(text,size)=>{ctx.font=`750 ${size}px ${family}`;return ctx.measureText(text).width;};
      const plan=planElementText(item,documentState.ratio,measure);plan.inkWidth=Math.min(w,Math.max(20,...plan.lines.map(line=>measure(line,plan.size))));plans.set(item.id,plan);overflow ||= item.opacity>0 && !!item.text && plan.overflow;
      const textHeight=item.autoHeight?Math.min(H-y,plan.height):h;
      ctx.beginPath();ctx.rect(x,y,w,textHeight);ctx.clip();ctx.font=`750 ${plan.size}px ${family}`;ctx.textBaseline='top';ctx.fillStyle=item.color;
      plan.lines.forEach((line,i)=>{let px=x;const width=ctx.measureText(line).width;if(item.align==='center')px+=(w-width)/2;if(item.align==='right')px+=w-width;ctx.fillText(line,px,y+i*plan.size*1.34);});
    }
    ctx.restore();
  }
  return {canvas:c,layout:{overflow,plans}};
}
function positionSelection(){const item=active();selection.hidden=!item||!showSelection;if(!item)return;selection.style.left=item.x*100+'%';selection.style.top=item.y*100+'%';selection.style.width=item.width*100+'%';const plan=objectLayouts.get(item.id);const height=item.type==='text'&&item.autoHeight&&plan?Math.min(1-item.y,plan.height/canvas.height):item.height;selection.style.height=height*100+'%';selection.querySelector('span').textContent=(item.type==='text'?'TEXT':item.type==='image'?'IMAGE':'SHAPE')+' · 드래그로 이동';}
async function draw(){
  const token=++revision,current={...doc};
  try{const result=await renderArtwork(current);if(token!==revision)return;canvas.width=result.canvas.width;canvas.height=result.canvas.height;canvas.getContext('2d').drawImage(result.canvas,0,0);layout=result.layout;objectLayouts.clear();layout.plans.forEach((v,k)=>objectLayouts.set(k,v));
    paper.style.width=Math.min(window.innerWidth>1500?400:370,460*canvas.width/canvas.height)+'px';positionSelection();$('#dimensions').textContent=`${canvas.width} × ${canvas.height} px`;
    const item=active(),plan=item&&objectLayouts.get(item.id);if(item?.autoHeight&&plan){const actualHeight=Math.round(Math.min(1-item.y,plan.height/canvas.height)*100);$('#height-output').textContent=actualHeight+'% · 자동';$('#height').value=actualHeight;}$('#layout-note').textContent=layout.overflow?'일부 문구가 상자를 넘습니다. 상자를 키우거나 글을 줄여 주세요.':plan&&plan.size<item.size?`문구가 잘리지 않도록 ${plan.size}px로 자동 맞춤했어요.`:'';
    canvas.setAttribute('aria-label','카드 미리보기: '+doc.elements.filter(e=>e.type==='text').map(e=>e.text).join(' / '));
  }catch(error){toast(safeError(error),true);}
}
function displayLayers(){
  const list=$('#layer-list');list.replaceChildren();$('#element-count').textContent=doc.elements.length+' / 50';
  [...doc.elements].reverse().forEach(item=>{const button=document.createElement('button');button.type='button';button.className='layer-item';button.setAttribute('aria-pressed',String(item.id===selectedId));button.setAttribute('aria-label',labelOf(item)+' 요소 선택');const icon=document.createElement('span');icon.textContent=item.type==='text'?'T':item.type==='image'?'▧':'◇';const text=document.createElement('span');text.textContent=labelOf(item);button.append(icon,text);button.addEventListener('click',()=>select(item.id));list.append(button);});
  if(!doc.elements.length){const p=document.createElement('p');p.className='local-note';p.textContent='요소를 추가해 자유롭게 만들어 보세요.';list.append(p);}
}
function select(id){selectedId=id;sync();}
function sync(){
  const item=active();if(!item)selectedId=null;const text=item?.type==='text';
  $('#selection-hint').hidden=!!item;$('#text-tools').hidden=!text;$('#fill-tools').hidden=!item||item.type==='image';$('#object-tools').hidden=!item;$('#object-actions').hidden=!item;$('#object-credit').hidden=item?.type!=='image';
  $('#selected-label').textContent=item?labelOf(item):'선택한 요소 없음';$('.tag').textContent=item?item.type.toUpperCase():'SELECT';
  $('#aspect-lock').closest('label').hidden=item?.type!=='image';
  if(text){$('#text').value=item.text;$('#font').value=item.font;$('#size').value=item.size;$('#size-output').textContent=item.size+' px';$('#char-count').textContent=item.text.length.toLocaleString()+' / 12,000';}
  if(item){if(item.color)$('#color').value=item.color;for(const name of ['x','y','width','height','opacity']){$('#'+name).value=Math.round(item[name]*100);$('#'+name+'-output').textContent=Math.round(item[name]*100)+'%';}}
  $$('[data-ratio]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ratio===doc.ratio)));
  $('[data-action=undo]').disabled=!history.length;$('[data-action=redo]').disabled=!future.length;
  for(const action of ['align-left','align-center','align-right'])$('[data-action='+action+']').disabled=!text;
  for(const action of ['up','down','forward','backward','duplicate','delete'])$$('[data-action='+action+']').forEach(b=>b.disabled=!item);
  $('#image-info').textContent=doc.image?`${doc.image.width} × ${doc.image.height} · ${doc.image.credit.kind==='own'?'본인 제작':'출처 기록됨'}`:'도형 배경 또는 단색 배경';$('#credit-button').hidden=!doc.image;
  $('#decorations').checked=doc.decorations!==false;$('#background-color').value=doc.backgroundColor||PALETTES[doc.preset][0];
  displayLayers();draw();
}
function change(patch,{record=true,clearSelection=false}={}){if('text' in patch && 'ratio' in patch)patch={...patch,elements:elementsOf(patch),decorations:patch.decorations??true,backgroundColor:patch.backgroundColor||PALETTES[patch.preset][0]};if(record)checkpoint();doc=upgradeDocument({...doc,...patch});if(clearSelection)selectedId=null;sync();markSave();}
function updateSelected(patch,record=true){const item=active();if(!item)return;const next=fitElement(item,patch);change({elements:doc.elements.map(e=>e.id===item.id?next:e)},{record});}
function addElement(item){if(doc.elements.length>=50)throw new Error('요소는 최대 50개까지 추가할 수 있습니다.');const element=fitElement({id:crypto.randomUUID(),opacity:1,...item},{});selectedId=element.id;change({elements:[...doc.elements,element]});}
function addText(){addElement({type:'text',text:'새로운 문구',font:'sans',size:80,color:'#28251f',align:'left',x:.12,y:.35,width:.70,height:.22,autoHeight:true});$('#text').focus();}
function addShape(shape){addElement({type:'shape',shape,color:'#f18a53',x:.25,y:.45,width:.35,height:.25});$('#shape-dialog').close();}
function duplicate(){const item=active();if(item)addElement({...item,id:crypto.randomUUID(),x:item.x+.025,y:item.y+.025});}
function deleteElement(){const id=selectedId;if(!id)return;change({elements:doc.elements.filter(item=>item.id!==id)},{clearSelection:true});}
$('#text').addEventListener('focus',()=>{if(active())checkpoint();});
$('#text').addEventListener('input',e=>{const item=active();if(item?.type!=='text')return;doc={...doc,elements:doc.elements.map(el=>el.id===item.id?{...el,text:e.target.value}:el)};future=[];$('#char-count').textContent=e.target.value.length.toLocaleString()+' / 12,000';clearTimeout(drawTimer);drawTimer=setTimeout(draw,55);displayLayers();$('[data-action=undo]').disabled=!history.length;$('[data-action=redo]').disabled=true;markSave();});
for(const name of ['size','x','y','width','height','opacity']){
  const field=$('#'+name);field.addEventListener('pointerdown',()=>{if(active())checkpoint();});field.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')&&active())checkpoint();});
  field.addEventListener('input',e=>{const item=active();if(!item)return;let patch={[name]:Number(e.target.value)/(name==='size'?1:100)};
    if(item.type==='image'&&$('#aspect-lock').checked&&['width','height'].includes(name)){const factor=patch[name]/item[name];const limit=Math.min(factor,1/item.width,1/item.height);patch={width:item.width*limit,height:item.height*limit};}
    updateSelected(patch,false);
  });
}
$('#font').addEventListener('change',e=>updateSelected({font:e.target.value}));$('#color').addEventListener('change',e=>updateSelected({color:e.target.value}));$$('[data-color]').forEach(b=>b.addEventListener('click',()=>updateSelected({color:b.dataset.color})));
$$('[data-ratio]').forEach(b=>b.addEventListener('click',()=>change({ratio:b.dataset.ratio})));
$('#decorations').addEventListener('change',e=>change({decorations:e.target.checked}));$('#background-color').addEventListener('change',e=>change({backgroundColor:e.target.value,decorations:false,image:null}));
function pointerStart(e,resize=false){
  if(e.button!==0)return;const rect=paper.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;
  const targets=doc.elements.map(item=>{const plan=objectLayouts.get(item.id);if(item.type!=='text'||!plan)return item;const inkWidth=plan.inkWidth/canvas.width;return {...item,x:item.x+(item.align==='right'?item.width-inkWidth:item.align==='center'?(item.width-inkWidth)/2:0),width:inkWidth,height:Math.min(item.autoHeight?1-item.y:item.height,plan.height/canvas.height)};});
  const hit=resize?active():hitElement(targets,x,y),item=hit&&doc.elements.find(el=>el.id===hit.id);select(item?.id||null);if(!item)return;checkpoint();const start={...item};if(resize&&item.type==='text'&&item.autoHeight){const plan=objectLayouts.get(item.id);if(plan)start.height=Math.min(1-item.y,plan.height/canvas.height);}drag={kind:resize?'resize':'move',id:item.id,start,x,y,rect};paper.setPointerCapture(e.pointerId);e.preventDefault();
}
paper.addEventListener('pointerdown',e=>pointerStart(e,e.target.closest('.resize-handle')!==null));
paper.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.rect.left)/drag.rect.width-drag.x,dy=(e.clientY-drag.rect.top)/drag.rect.height-drag.y;let patch;
  if(drag.kind==='move')patch={x:drag.start.x+dx,y:drag.start.y+dy};else{patch={width:Math.max(.02,Math.min(1-drag.start.x,drag.start.width+dx)),height:Math.max(.02,Math.min(1-drag.start.y,drag.start.height+dy))};if(drag.start.type==='image'&&$('#aspect-lock').checked){const factor=Math.min(patch.width/drag.start.width,patch.height/drag.start.height);patch={width:drag.start.width*factor,height:drag.start.height*factor};}}
  doc={...doc,elements:doc.elements.map(item=>item.id===drag.id?fitElement(drag.start,patch):item)};sync();
});
paper.addEventListener('pointerup',()=>{if(drag){drag=null;markSave();}});paper.addEventListener('pointercancel',()=>{drag=null;markSave();});
$('.workarea').addEventListener('pointerdown',e=>{if(e.target===$('.workarea'))select(null);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))select(null);const tag=e.target.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag)||document.querySelector('dialog[open]'))return;if((e.key==='Delete'||e.key==='Backspace')&&active()){e.preventDefault();deleteElement();}});

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
    load.addEventListener('click',()=>{change({...validateDocument(item.doc),elements:elementsOf(item.doc)},{clearSelection:true});toast(item.name+' 템플릿을 불러왔습니다.');});card.append(load);grid.append(card);
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
function attachImageInput(selector,target){
  $(selector).addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;const ticket=++uploadRevision;
    try{const image=await normalizeImage(file);if(ticket!==uploadRevision)return;pendingImage=image;creditTarget=target;creditDialog(image);}
    catch(error){if(ticket===uploadRevision)toast(safeError(error)+' 기존 작업은 유지됩니다.',true);}
  });
}
attachImageInput('#image-input','background');attachImageInput('#object-image-input','new-object');
$('#credit-dialog').addEventListener('close',()=>{pendingImage=null;});
$('#credit-form').addEventListener('submit',e=>{
  e.preventDefault();
  try{
    const existing=creditTarget==='background'?doc.image:doc.elements.find(el=>el.id===creditTarget)?.image;
    const image=pendingImage||existing;if(!image)throw new Error('이미지를 먼저 선택해 주세요.');
    const next=validateImage({...image,credit:{kind:$('#credit-kind').value,url:$('#credit-url').value.trim(),license:$('#credit-license').value.trim()}});
    if(creditTarget==='new-object'){
      const [W,H]=RATIOS[doc.ratio],width=Math.min(.45,.55*H/W*next.width/next.height),height=width*W/H*next.height/next.width;
      addElement({type:'image',image:next,x:.20,y:.25,width,height});
    }else if(creditTarget==='background')change({image:next});
    else change({elements:doc.elements.map(el=>el.id===creditTarget?{...el,image:next}:el)});
    $('#credit-dialog').close();toast('이미지와 제작·출처 기록을 적용했습니다.');
  }catch(error){$('#credit-error').textContent=safeError(error);}
});

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
    for(const t of imported){const images=[t.doc.image,...elementsOf(t.doc).filter(e=>e.type==='image').map(e=>e.image)].filter(Boolean);for(const asset of images){const img=await imageElement(asset.dataUrl);if(img.naturalWidth!==asset.width||img.naturalHeight!==asset.height)throw new Error('이미지의 실제 크기와 기록된 크기가 다릅니다.');}}
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
    case 'image':$('#object-image-input').click();break;
    case 'text':addText();break;
    case 'shape':$('#shape-dialog').showModal();break;
    case 'duplicate':duplicate();break;
    case 'delete':deleteElement();break;
    case 'forward':if(active())change({elements:reorderElement(doc.elements,selectedId,1)});break;
    case 'backward':if(active())change({elements:reorderElement(doc.elements,selectedId,-1)});break;
    case 'deselect':select(null);break;
    case 'templates':$('#library').scrollIntoView({behavior:'smooth',block:'start'});break;
    case 'gallery':await showGallery();break;
    case 'credit':if(doc.image){creditTarget='background';creditDialog(doc.image);}break;
    case 'object-credit':if(active()?.type==='image'){creditTarget=selectedId;creditDialog(active().image);}break;
    case 'remove-image':++uploadRevision;change({image:null});break;
    case 'selection':showSelection=!showSelection;b.setAttribute('aria-pressed',String(showSelection));draw();break;
    case 'align-left':updateSelected({align:'left'});break;
    case 'align-center':updateSelected({align:'center'});break;
    case 'align-right':updateSelected({align:'right'});break;
    case 'up':if(active())updateSelected({y:active().y-.03});break;
    case 'down':if(active())updateSelected({y:active().y+.03});break;
    case 'reset':confirmAction('처음 디자인으로 돌아가기','현재 편집 내용을 기본 디자인으로 바꿀까요? 저장한 템플릿은 유지되며, 되돌리기로 복구할 수 있습니다.',()=>{++uploadRevision;change({...DEFAULT,elements:elementsOf(DEFAULT),decorations:true,backgroundColor:PALETTES[0][0]},{clearSelection:true});});break;
    case 'undo':if(history.length){future.push({...doc});doc=history.pop();sync();markSave();}break;
    case 'redo':if(future.length){history.push({...doc});doc=future.pop();sync();markSave();}break;
    case 'download':await downloadPNG({...doc});toast('PNG 다운로드를 시작했습니다.');break;
  }}catch(error){toast(safeError(error),true);}
});
window.addEventListener('resize',()=>draw());
async function initialize(){
  await document.fonts.ready;
  try{const stored=await readSetting('editor');if(stored)doc=upgradeDocument(validateDocument(stored));await refreshTemplates();storageReady=true;$('#save-state').textContent='● 이 브라우저에 저장됨';}
  catch(error){$('#save-state').textContent='● 저장소 확인 필요';toast(safeError(error),true);}
  sync();await displayLibrary();
}
$$('[data-shape]').forEach(button=>button.addEventListener('click',()=>{try{addShape(button.dataset.shape);}catch(error){toast(safeError(error),true);}}));
initialize();
