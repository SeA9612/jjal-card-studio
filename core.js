import { validateElements } from './elements.js?v=20261104-image-ratio1';
export const RATIOS = { '1:1': [1080, 1080], '4:5': [1080, 1350], '9:16': [1080, 1920] };
export const DEFAULT = { text: '오늘을\n기록하는\n작은 취향.', ratio: '4:5', font: 'sans', size: 100, color: '#28251f', x: .09, y: .23, align: 'left', preset: 0, image: null };
export const PALETTES = [['#eadfcf', '#e58a54', '#28251f'], ['#bdd1d3', '#6988a9', '#233a46'], ['#eddc91', '#83945d', '#2f3522']];
export const STARTERS = [
  { name: '에디토리얼 노트', doc: { ...DEFAULT } },
  { name: '블루 모먼트', doc: { ...DEFAULT, text: '조금 느려도,\n괜찮아.', ratio: '1:1', preset: 1, color: '#233a46' } },
  { name: '데일리 포스터', doc: { ...DEFAULT, text: '좋아하는 걸\n좋아해.', ratio: '9:16', preset: 2, color: '#2f3522' } }
];
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export const graphemes = text => Array.from(segmenter.segment(text), s => s.segment);
export function wrapText(text, maxWidth, measure) {
  const result = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const part of graphemes(paragraph)) {
      if (line && measure(line + part) > maxWidth) { result.push(line); line = part; }
      else line += part;
    }
    result.push(line);
  }
  return result;
}
export function planText(doc, measureAtSize) {
  const [width, height] = RATIOS[doc.ratio];
  const maxWidth = Math.max(1, Math.min(width * (doc.boxWidth ?? .82), width * ((doc.boxWidth === undefined ? .96 : 1) - doc.x)));
  const maxHeight = Math.max(1, height * (doc.boxHeight ?? (.90 - doc.y)));
  const plan = size => {
    const lines = wrapText(doc.text, maxWidth, text => measureAtSize(text, size));
    return { size, lines, width: maxWidth, height: lines.length * size * 1.34, x: doc.x * width, y: doc.y * height };
  };
  let layout = plan(doc.size);
  if (layout.height > maxHeight || layout.lines.some(line => measureAtSize(line, layout.size) > maxWidth)) {
    let low = 12, high = doc.size;
    for (let i = 0; i < 9; i++) {
      const mid = (low + high) / 2, test = plan(mid);
      if (test.height <= maxHeight && test.lines.every(line => measureAtSize(line, mid) <= maxWidth)) low = mid;
      else high = mid;
    }
    layout = plan(Math.floor(low));
  }
  layout.overflow = layout.height > maxHeight || layout.lines.some(line => measureAtSize(line, layout.size) > maxWidth);
  return layout;
}
export function planElementText(item,ratio,measure) {
  return planText({...item,ratio,boxWidth:item.width,boxHeight:item.autoHeight?1-item.y:item.height},measure);
}
const fail = message => { throw new Error(message); };
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const number = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
export function validateDocument(input) {
  if (!object(input)) fail('편집 데이터가 올바르지 않습니다.');
  if (typeof input.text !== 'string' || input.text.length > 12000) fail('문구는 12,000자 이하여야 합니다.');
  if (!Object.hasOwn(RATIOS, input.ratio)) fail('지원하지 않는 화면비입니다.');
  if (!['sans', 'serif'].includes(input.font) || !['left', 'center', 'right'].includes(input.align)) fail('글꼴 또는 정렬 항목이 올바르지 않습니다.');
  if (!number(input.size, 12, 180) || !number(input.x, .04, .70) || !number(input.y, .14, .80)) fail('문구 크기 또는 위치가 올바르지 않습니다.');
  if (!/^#[0-9a-f]{6}$/i.test(input.color) || ![0, 1, 2].includes(input.preset)) fail('색상 또는 배경 항목이 올바르지 않습니다.');
  const image = validateImage(input.image);
  const result = { text: input.text, ratio: input.ratio, font: input.font, size: input.size, color: input.color.toLowerCase(), x: input.x, y: input.y, align: input.align, preset: input.preset, image };
  if (input.elements !== undefined) result.elements = validateElements(input.elements, validateImage);
  if (input.decorations !== undefined) { if (typeof input.decorations !== "boolean") fail("배경 장식 설정이 올바르지 않습니다."); result.decorations = input.decorations; }
  if (input.backgroundColor !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(input.backgroundColor)) fail("배경색이 올바르지 않습니다."); result.backgroundColor = input.backgroundColor; }
  return result;
}
export function validateImage(input) {
  if (input === null) return null;
  const img = input;
    if (!object(img) || typeof img.dataUrl !== 'string' || img.dataUrl.length > 14000000 || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(img.dataUrl)) fail('이미지 데이터는 유효한 PNG여야 합니다.');
    if (!Number.isInteger(img.width) || !Number.isInteger(img.height) || !number(img.width, 1, 1600) || !number(img.height, 1, 1600)) fail('이미지 크기가 올바르지 않습니다.');
    if (!object(img.credit) || !['own', 'external'].includes(img.credit.kind)) fail('이미지 제작·출처 항목이 필요합니다.');
    const { kind, url = '', license = '' } = img.credit;
    if (typeof url !== 'string' || typeof license !== 'string' || url.length > 2000 || license.length > 300) fail('출처 정보가 올바르지 않습니다.');
    if (kind === 'external' && (!/^https?:\/\//i.test(url) || !license.trim())) fail('외부 이미지는 원본 URL과 사용 허가 근거가 필요합니다.');
  return { dataUrl: img.dataUrl, width: img.width, height: img.height, credit: { kind, url, license } };
}

export function validateBackup(input) {
  if (!object(input) || input.app !== 'jjal-card-studio' || ![1,2].includes(input.version) || !Array.isArray(input.templates)) fail('백업 형식 또는 버전이 올바르지 않습니다.');
  if(input.version===2)validateDocument(input.editor);
  if (input.templates.length > 30) fail('한 번에 가져올 수 있는 템플릿은 최대 30개입니다.');
  const ids = new Set();
  return input.templates.map((t, i) => {
    if (!object(t) || typeof t.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(t.id) || ids.has(t.id)) fail(`${i + 1}번 템플릿의 ID가 없거나 중복됩니다.`);
    if (typeof t.name !== 'string' || !t.name.trim() || t.name.length > 50) fail(`${i + 1}번 템플릿 이름이 필요합니다.`);
    if (typeof t.updatedAt !== 'string' || !Number.isFinite(Date.parse(t.updatedAt))) fail(`${i + 1}번 템플릿의 수정 일시가 올바르지 않습니다.`);
    ids.add(t.id);
    return { id: t.id, name: t.name.trim(), updatedAt: t.updatedAt, doc: validateDocument(t.doc) };
  });
}
export function validateBackupContents(input){
  const templates=validateBackup(input),editor=input.version===2?validateDocument(input.editor):null;
  if(!editor&&!templates.length)fail('이 파일에는 복원할 카드가 없습니다(템플릿 0개). 이전 백업에는 편집 중인 카드가 포함되지 않았습니다. 원래 작업이 있는 브라우저에서 새 백업을 만들어 주세요.');
  return {templates,editor};
}
export function createBackup(editor,templates,exportedAt=new Date().toISOString()){
  const backup={app:'jjal-card-studio',version:2,exportedAt,editor:validateDocument(editor),templates};
  const checked=validateBackupContents(backup);
  return {...backup,...checked};
}
export function identifyImage(bytes) {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  throw new Error('지원하지 않는 파일입니다. 실제 PNG 또는 JPEG 이미지를 선택해 주세요.');
}
