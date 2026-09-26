// Session PDFs of VMK: the list of exams, and two timetables drawn as grids (dates × groups).
// Cells are found by the PDF's own border lines, as in public/parser.mjs.
import {borders} from '../public/parser.mjs';

const clean = s => s.replace(/\s+/g,' ').replace(/\s+([,.])/g,'$1').trim();
// Superscript minutes sit a few points higher than the hour: a line is a band of ±5pt.
function linesOf(items, tolerance = 5) {
  const lines = [];
  for (const item of [...items].sort((a,b) => a.y-b.y || a.x-b.x)) {
    let line = lines.find(l => Math.abs(l.y-item.y) < tolerance);
    if (!line) { line = {y:item.y, items:[]}; lines.push(line); }
    line.items.push(item);
  }
  // Pieces of one word come back as separate items with no gap between them.
  const join = items => items.sort((a,b) => a.x-b.x).reduce((s,i,k,all) => s+(k && i.x-(all[k-1].x+all[k-1].width) > 1 ? ' ' : '')+i.str, '');
  return lines.map(l => ({y:l.y, text:clean(join(l.items))}));
}

async function pages(pdfjs, data) {
  const doc = await pdfjs.getDocument({data:new Uint8Array(data), isEvalSupported:false, useSystemFonts:true, verbosity:0}).promise;
  try {
    const out = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), height = page.view[3];
      const items = (await page.getTextContent()).items.filter(i => i.str?.trim()).map(i => ({str:i.str, x:i.transform[4], y:height-i.transform[5], width:i.width, cx:i.transform[4]+i.width/2}));
      out.push({items, ...borders(await page.getOperatorList(), pdfjs.OPS, height)});
    }
    return out;
  } finally { await doc.destroy(); }
}

// The box around a point: nearest border lines on each side.
function boxAt({horizontal, vertical}, x, y) {
  const left = Math.max(...vertical.filter(v => v.x0 < x-1 && v.y0 <= y && v.y1 >= y).map(v => v.x0));
  const right = Math.min(...vertical.filter(v => v.x0 > x+1 && v.y0 <= y && v.y1 >= y).map(v => v.x0));
  const top = Math.max(...horizontal.filter(h => h.y0 < y-1 && h.x0 <= x && h.x1 >= x).map(h => h.y0));
  const bottom = Math.min(...horizontal.filter(h => h.y0 > y+1 && h.x0 <= x && h.x1 >= x).map(h => h.y0));
  return [left, right, top, bottom].every(Number.isFinite) ? {left, right, top, bottom} : null;
}
const inside = (item, box) => item.cx > box.left && item.cx < box.right && item.y > box.top && item.y < box.bottom + 2;

// Group numbers of the header row; a number may be split into pieces ("1" "07").
function groupColumns(page) {
  const found = [];
  for (const item of page.items.filter(i => /^1\d{0,2}$/.test(i.str.trim()))) {
    const box = boxAt(page, item.cx, item.y-2);
    if (!box || box.right-box.left > 700 || found.some(c => Math.abs(c.left-box.left) < 2 && Math.abs(c.top-box.top) < 2)) continue;
    const text = page.items.filter(i => inside(i, box)).sort((a,b) => a.x-b.x).map(i => i.str.trim()).join('');
    if (/^1\d\d$/.test(text)) found.push({group:text, ...box, x:(box.left+box.right)/2});
  }
  return found;
}

// Dates in the first column: "01.06", "09. 06", "20.05 среда".
function dateRows(page, year, leftOf) {
  const rows = [];
  for (const line of linesOf(page.items.filter(i => i.cx < leftOf), 3)) {
    const m = line.text.match(/^(\d{1,2})\s*\.\s*(\d{2})\b/);
    if (!m) continue;
    const x = page.items.find(i => i.cx < leftOf && Math.abs(i.y-line.y) < 3).cx;
    const box = boxAt(page, x, line.y-2);
    if (!box || rows.some(r => Math.abs(r.top-box.top) < 2)) continue;
    const month = Number(m[2]);
    // Winter session crosses the new year: December belongs to the first year, January to the second.
    rows.push({date:`${month >= 8 ? year : year+1}-${m[2]}-${m[1].padStart(2,'0')}`, top:box.top, bottom:box.bottom});
  }
  return rows;
}

function academicYear(text) {
  const full = text.match(/(20\d{2})\s*[\/-]\s*(20\d{2})/);
  if (full) return Number(full[1]);
  // "Расписание зачетов с 21.05.26 по 28.05.26"
  const short = text.match(/с\s+\d{1,2}\.(\d{2})\.(\d{2})\b/);
  return short ? 2000+Number(short[2])-(Number(short[1]) >= 8 ? 0 : 1) : 0;
}
const TIME = /^(\d{1,2})[.:]?(\d{2})(?!\d)/;
const ROOM = /^(?:ауд\.?\s*)?(?:П\s*-\s*\d{1,2}|МЗ(?:\s*-\s*\d)?|\d{2,3}(?:\s*-?\s*[а-я])?)$/i;
const room = s => s.replace(/^ауд\.?\s*/i,'').replace(/\s+/g,'').replace(/[–—]/g,'-');
const NAME = /[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁа-яё]\.\s*[А-ЯЁ](?:\.+|(?=[\s,]|$))/g;

// Lines of one cell → [{time, room, subject, teachers}]. A line starting with a time opens a new entry.
export function entriesOf(lines, defaultTime = '') {
  const raw = [];
  for (let text of lines) {
    const t = text.match(TIME);
    if (t && Number(t[1]) >= 8 && Number(t[1]) <= 21 && Number(t[2]) < 60) {
      raw.push({time:`${t[1].padStart(2,'0')}:${t[2]}`, parts:[]});
      text = text.slice(t[0].length).trim();
      if (!text) continue;
    }
    if (!raw.length) raw.push({time:defaultTime, parts:[]});
    raw.at(-1).parts.push(text);
  }
  return raw.map(({time, parts}) => {
    let where = '';
    const rest = [];
    for (const p of parts) {
      const lead = p.match(/^ауд\.?\s*(\S+(?:\s*-\s*[а-я])?)\s*(.*)$/i);
      if (!where && lead) { where = room(lead[1]); if (lead[2]) rest.push(lead[2]); }
      else if (!where && ROOM.test(p)) where = room(p);
      else rest.push(p);
    }
    const text = clean(rest.join(' '));
    const names = [...text.matchAll(NAME)];
    let subject = clean(names.length ? text.slice(0, names[0].index) : text).replace(/[,.]$/, '');
    // A room may close the subject line: "Практикум на ЭВМ МЗ-3", "… языки 526б".
    const tail = !where && subject.match(/\s(П\s*-\s*\d{1,2}|МЗ(?:\s*-\s*\d)?|\d{3}[а-я]?)$/);
    if (tail) { where = room(tail[1]); subject = subject.slice(0, tail.index).trim(); }
    const teachers = names.map(n => clean(n[0]).replace(/\.{2,}$/, '.'));
    return {time, room:where, subject, teachers};
  }).filter(e => e.subject);
}

// Times are printed with superscript minutes ("15" and a raised "00"): glue them into "15:00" first.
function withTimes(items) {
  const used = new Set(), out = [];
  const raised = (hour, m) => !used.has(m) && m !== hour && /^\d{2}$/.test(m.str.trim()) && m.x > hour.x && m.x-(hour.x+hour.width) < 6 && hour.y-m.y > 2 && hour.y-m.y < 10;
  for (const hour of items) {
    // "10.00" printed with a stray raised "00" next to it.
    if (/^\d{1,2}[.:]\d{2}$/.test(hour.str.trim())) { const extra = items.find(m => raised(hour, m)); if (extra) used.add(extra); continue; }
    if (used.has(hour) || !/^\d{1,2}$/.test(hour.str.trim())) continue;
    const min = items.find(m => !used.has(m) && m !== hour && /^\d{2}$/.test(m.str.trim()) && m.x > hour.x && m.x-(hour.x+hour.width) < 6 && hour.y-m.y > 2 && hour.y-m.y < 10);
    if (!min) continue;
    used.add(hour); used.add(min);
    out.push({...hour, str:hour.str.trim()+":"+min.str.trim(), width:min.x+min.width-hour.x});
  }
  return [...items.filter(i => !used.has(i)), ...out];
}

// Timetable grid → {year, entries:{group:[{date, time, room, subject, teachers}]}}.
// Several tables may stand one under another, each with its own row of group numbers.
export async function parseGrid(pdfjs, data) {
  const all = await pages(pdfjs, data);
  const text = all.flatMap(p => p.items.map(i => i.str)).join(' ');
  const year = academicYear(text);
  if (!year) throw Error('Не удалось определить учебный год расписания сессии.');
  const defaultTime = (text.match(/НАЧАЛО\s+ЭКЗАМЕНОВ\s+(\d{1,2})[.:](\d{2})/i) || []).slice(1).map((s,i) => i ? s : s.padStart(2,'0')).join(':');
  const entries = {};
  for (const page of all) {
    const cols = groupColumns(page);
    if (!cols.length) continue;
    for (const col of cols) {
      // The table of this header: its dates stand left of its first group, down to the next header.
      const block = cols.filter(c => Math.abs(c.top-col.top) < 3);
      const next = Math.min(...cols.filter(c => c.top > col.bottom+5 && c.left < col.right && c.right > col.left).map(c => c.top));
      const mine = dateRows(page, year, Math.min(...block.map(c => c.left))).filter(r => r.top >= col.bottom-2 && r.top < next);
      const seen = new Set();
      for (const row of mine) {
        // A day may hold several entries one under another, split by lines inside the column.
        const cuts = [row.top];
        for (const h of page.horizontal.filter(h => h.x0 <= col.x && h.x1 >= col.x && h.y0 > row.top+3 && h.y0 < row.bottom-3).map(h => h.y0).sort((p,q) => p-q))
          if (h-cuts.at(-1) > 3) cuts.push(h);
        cuts.push(row.bottom);
        for (let k = 0; k < cuts.length-1; k++) {
        const y = (cuts[k]+cuts[k+1])/2;
        // A wide header may cover sub-cells (time and room | subject and teacher): read them together.
        const inner = page.vertical.filter(v => v.y0 <= y && v.y1 >= y && v.x0 > col.left+2 && v.x0 < col.right-2).map(v => v.x0).sort((p,q) => p-q);
        const edges = [col.left]; for (const x of inner) if (x-edges.at(-1) > 3) edges.push(x); edges.push(col.right);
        const boxes = edges.slice(1).map((x,k) => boxAt(page, (edges[k]+x)/2, y)).filter(bx => bx && bx.right-bx.left <= 700);
        if (!boxes.length) continue;
        const key = boxes.map(bx => [bx.left, bx.top].map(Math.round).join(":")).join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const perBox = boxes.map(bx => withTimes(page.items.filter(i => inside(i, bx))));
        const items = perBox.flat();
        if (!items.length) continue;
        const mid = items.reduce((s,i) => s+i.y, 0)/items.length;
        const at = mine.find(r => mid >= r.top-1 && mid <= r.bottom+1) || row;
        // Sub-cells are read left to right.
        for (const e of entriesOf(perBox.flatMap(list => linesOf(list).map(l => l.text)), defaultTime)) {
          const list = (entries[col.group] ||= []);
          if (!list.some(o => o.date === at.date && o.time === e.time && o.subject === e.subject)) list.push({date:at.date, ...e});
        }
        }
      }
    }
  }
  for (const list of Object.values(entries)) list.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return {year, entries};
}

// "ПЕРЕЧЕНЬ ЭКЗАМЕНОВ": groups → [{short, name, lecturer, position}].
export async function parseExamList(pdfjs, data) {
  const all = await pages(pdfjs, data);
  const out = [];
  let groups = null;
  for (const page of all) for (const line of linesOf(page.items, 3)) {
    const g = line.text.match(/Экзаменационные группы:\s*([\d,\s–-]+)/i);
    if (g) { groups = expandGroups(g[1]); continue; }
    // The module for foreign students follows the programme and is not ours.
    if (/Языковый модуль/i.test(line.text)) groups = null;
    if (!groups) continue;
    const items = page.items.filter(i => Math.abs(i.y-line.y) < 3).sort((a,b) => a.x-b.x).map(i => clean(i.str));
    if (items.length < 3) continue;
    // Spring format: short name | subject | lecturer | position.
    const [short, name, lecturer, position = ''] = items;
    if (/[А-ЯЁа-яё]/.test(name) && /[А-ЯЁ]\.\s*[А-ЯЁ]\./.test(lecturer)) {
      for (const group of groups) out.push({group, short, name, lecturer, position, control:['экзамен']});
      continue;
    }
    // Winter format: № | subject | hours | forms of control ("зач.", "з/оц", "экз.").
    const control = items.slice(2).flatMap(s => s==='экз.' ? ['экзамен'] : s==='зач.' ? ['зачёт'] : s==='з/оц' ? ['зачёт с оценкой'] : []);
    if (/^\d+$/.test(items[0]) && /[А-ЯЁа-яё]/.test(items[1]) && control.length)
      for (const group of groups) out.push({group, short:'', name:items[1], lecturer:'', position:'', control});
  }
  return out;
}
function expandGroups(text) {
  const out = [];
  for (const part of text.split(',')) {
    const [a, b] = part.split(/[–-]/).map(s => Number(s.trim()));
    if (!a) continue;
    for (let n = a; n <= (b || a); n++) out.push(String(n));
  }
  return out;
}

// Plain lines of text of every page, for simple documents such as the week parity table.
export async function textLines(pdfjs, data) {
  return (await pages(pdfjs, data)).flatMap(page => linesOf(page.items, 3).map(l => l.text));
}
