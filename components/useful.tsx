import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {ArrowUpRight, BookOpen, ChevronRight, FileText, FolderOpen, GraduationCap, Image as ImageIcon, Library, Lock, MessageCircle, Sparkles, UserRound} from 'lucide-react';
import directory from '../public/people.json';
import {DISK_TEACHERS, courseTeachers, diskMentions, lecturersOf} from '../lib/useful-teachers.mjs';

// «Полезное» for the first course, from CSDrive — the students' archive of study materials of ВМК (table goo.gl/YyE6jP).
// public/csdrive.json: the open part (Yandex Disk, synced weekly by scripts/sync-csdrive.mjs);
// public/scsd.json: the list of the closed part for the first and second course (a snapshot; its files need the password).
// Split by semester and stream (1, 2, 3), or by teacher: who teaches the group and the course (from the timetable)
// and which materials on the disk name them. The texts about credits and exams are CSDrive's notes, retold.
const DISK = 'https://disk.yandex.ru/d/uBxTJDaahuSjZA';
const SCSD = 'https://disk.yandex.ru/d/wZ0NoHzZeySMqw';
const TABLE = 'https://docs.google.com/spreadsheets/d/1jPWpbivxCf3xRv-jAueWEF-XmPo1I3kLS2o6UyDBDMU/edit';
const encodePath = (path:string) => path.split('/').map(encodeURIComponent).join('/');
const VIEW = /\.(pdf|djvu|docx?|pptx?|xlsx?|rtf|txt|odt|epub)$/i;
const IMG = /\.(jpe?g|png|gif|heic|webp)$/i;
const USEFUL = /\.(pdf|djvu|docx?|pptx?|xlsx?|rtf|txt|tex|odt|epub|jpe?g|png|gif|heic|webp|zip|7z|rar|gz)$/i;

// p: how many photos a folder holds when their names are left out (the closed part's list).
type Node = {n:string; s?:number; c?:Node[]; code?:boolean; p?:number};
type Drive = {updatedAt:string; publicKey:string; folders:Record<string, Node[]>};
type Closed = {updatedAt:string; tree:Node[]};
// Where links of a tree lead: the open disk (documents in Yandex's viewer, as CSDrive's table does) or the closed one.
type Linker = {folder:(path:string)=>string; file:(path:string, name:string)=>string; locked?:boolean};
const openLinks = (key:string):Linker => ({
  folder:path => `${DISK}/${encodePath(path)}`,
  file:(path, name) => VIEW.test(name) && key ? `https://docs.yandex.ru/docs/view?url=${encodeURIComponent(`ya-disk-public://${key}:/${path}`)}&name=${encodeURIComponent(name)}` : `${DISK}/${encodePath(path)}`,
});
const closedLinks:Linker = {folder:path => `${SCSD}/${encodePath(path)}`, file:path => `${SCSD}/${encodePath(path)}`, locked:true};
const OPEN = openLinks('');

type Flow = '1' | '2' | '3' | 'ФИИТ';        // the stream picked
type Pair = '1' | '2-3';                     // CSDrive keeps the 2nd and 3rd stream together
// ФИИТ learns Pascal with Абрамов, like the 2nd and 3rd stream.
const pairOf = (flow:Flow):Pair => flow === '1' ? '1' : '2-3';
const FLOWS:Flow[] = ['1', '2', '3', 'ФИИТ'];
const flowName = (flow:Flow) => flow === 'ФИИТ' ? 'ФИИТ' : `${flow} поток`;
type Term = 1 | 2;
type Subject = {name:string; match:RegExp; scsd?:RegExp; terms:Term[]; folder:string | Record<Pair, string>; books?:string[] | Record<Pair, string[]>; sites?:[string, string][] | Record<Pair, [string, string][]>};
const pick = <T,>(v:T | Record<Pair, T>, pair:Pair):T => (v && typeof v === 'object' && !Array.isArray(v) && '2-3' in (v as object)) ? (v as Record<Pair, T>)[pair] : v as T;

const SUBJECTS:Subject[] = [
  {name:'Математический анализ', match:/анализ/i, scsd:/матан/i, terms:[1, 2], folder:'1 курс/Математический анализ',
    books:['1. Книги/Демидович (2005).pdf', '1. Книги/[Теория] Ильин Садовничий Сендов (часть 1).djvu', '4. Конспекты/[2020] МАТАН. Лекции.pdf', '1. Книги/[Методички] Садовничая Хорошилова Фоменко']},
  {name:'Алгебра и геометрия', match:/алгебр/i, scsd:/линал/i, terms:[1, 2], folder:'1 курс/Алгебра и геометрия (Линал)',
    books:['1. Книги/[Учебник] Ким, Ильин (Линейная алгебра и аналитическая геометрия).pdf', '1. Книги/Ким, Крицков/[Задачник] 1-1 Ким, Крицков (Алгебра и аналитическая геометрия).pdf',
      '1. Книги/Ким, Крицков/Том 2 (2003)/[Задачник] 2-1 Ким, Крицков (Алгебра и аналитическая геометрия).pdf', '1. Книги/[Учебник] Ильин, Позняк - Линейная алгебра.djvu']},
  {name:'Алгоритмы и алгоритмические языки', match:/алгоритм/i, scsd:/аиая|практикум/i, terms:[1],
    folder:{'1':'1 курс/[1 поток, 1 сем.] Алгоритмы и АЯ', '2-3':'1 курс/[2-3 поток, 1 сем.] Алгоритмы и АЯ'},
    books:{'1':['1. Книги/1. Керниган и Ритчи, Язык программирования Си..pdf', '1. Книги/0. Слайды лекций - 2014 (лектор - Белеванцев А. А.).pdf', '1. Книги/3. Семинары по курсу АиАЯ.pdf'],
      '2-3':['1. Книги/Введение в язык Паскаль. Абрамов Трифонов Трифонова 2021 год.pdf', '1. Книги/Пильщиков - Язык Паскаль, упражнения и задачи.djvu', '1. Книги/Пильщиков - Письменный экзамен по курсу АЯ(методичка).pdf']},
    sites:{'1':[['Сайт курса', 'http://algcourse.cs.msu.ru/']], '2-3':[]}},
  {name:'Архитектура ЭВМ и ассемблер', match:/архитектур/i, scsd:/архитектур/i, terms:[2],
    folder:{'1':'1 курс/[1 поток, 2 сем.] Архитектура ЭВМ и АСМ', '2-3':'1 курс/[2-3 поток, 2 сем.] Архитектуры ЭВМ и АСМ'},
    books:{'1':['1. Книги, пособия/Брайант, Халларон - Комп. системы архитектура и программирование.djvu', '1. Книги, пособия/Семинары по курсу Часть 1 Е.А. Кузьменкова, В.С. Махныче.pdf',
      '1. Книги, пособия/Семинары по курсу Часть 2 Е.А. Кузьменкова, В.А. Падарян.pdf', '1. Книги, пособия/Столяров А.В. - Методичка NASM для ОС Unix.pdf'],
      '2-3':['1.Книги/Введение в архитектуру ЭВМ и системы программирования', '1.Книги/Пильщиков - Assembler. Программирование на языке ассемблера IBM PC.djvu', '1.Книги/Упражнения по языку Ассемблера MASM В.Н.Пильщиков']},
    sites:{'1':[['Сайт курса', 'http://asmcourse.cs.msu.ru/'], ['Справочник команд', 'http://asmworld.ru/spravochnik-komand/']], '2-3':[]}},
  {name:'Дискретная математика', match:/дискретн/i, scsd:/дискр/i, terms:[2], folder:'1 курс/Дискретная математика (2 семестр)',
    books:['Книги/1. Дискретная математика - Алексеев В.Б (курс лекций, 2-ой семестр).pdf', 'Книги/Гаврилов - Задачи и упражнения по дискретной математике.pdf', 'Книги/Вороненко - Задачи и упражнения с решениями.pdf'],
    sites:[['Сайт курса и билеты', 'http://mk.cs.msu.ru/index.php/%D0%94%D0%B8%D1%81%D0%BA%D1%80%D0%B5%D1%82%D0%BD%D0%B0%D1%8F_%D0%BC%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0_(1%D0%B9_%D0%BA%D1%83%D1%80%D1%81)']]},
  {name:'История России', match:/истори/i, terms:[1], folder:'1 курс/Гуманитарий/История'},
  {name:'Безопасность жизнедеятельности', match:/безопасн|бжд/i, terms:[1], folder:'1 курс/Гуманитарий/БЖД'},
  {name:'Английский язык', match:/английск/i, terms:[1, 2], folder:'1 курс/Гуманитарий/Английский'},
  {name:'Библиография', match:/библиограф/i, terms:[1], folder:'1 курс/Гуманитарий/Библиография'},
  {name:'Русский язык и культура речи', match:/русск/i, terms:[2], folder:'1 курс/Гуманитарий/Русский язык и культура речи'},
];

type Course = {name:string; text:string};
const TERMS:Record<Term, {credits:string[]; exams:string[]; creditDates:string; examDates:string; notes:Course[]}> = {
  1:{credits:['Практикум на ЭВМ', 'Алгебра и геометрия', 'Матанализ', 'Библиография', 'БЖД', 'Английский', 'Физкультура'],
    exams:['Алгебра и геометрия', 'Матанализ', 'Алгоритмы и АЯ', 'История'],
    creditDates:'закрыться можно к ~20 декабря, первые комиссии — до конца декабря, ещё две попытки — в феврале', examDates:'январь',
    notes:[
      {name:'Матанализ и линал', text:'Зачёт обычно ставят по сумме контрольных, коллоквиума и зачётной работы; многое зависит от преподавателя, некоторые проверяют домашку. Один коллоквиум — устная теория за половину семестра. Экзамен классический: билет с теорией, ответ устно, дополнительные вопросы и задачи.'},
      {name:'Практикум на ЭВМ', text:'1 поток: оценка по контрольным и домашним контестам, не выше оценки за домашний контест; за опоздание с контестом снижают баллы. 2–3 поток: домашние задания и небольшие самостоятельные, зачётная работа — дорешать то, что не решено за семестр.'},
      {name:'Алгоритмы и АЯ', text:'1 поток: коллоквиумы в конце октября и в начале декабря, всё письменно; итог — 75% экзамен, 10% и 15% коллоквиумы (ориентир: 33% — «3», 53% — «4», 72% — «5»). Возможен автомат. Сходи на апелляцию — там можно поднять оценку. 2–3 поток: коллоквиумов нет, оценка за письменный экзамен.'},
      {name:'История', text:'Баллы набираются докладами, эссе, рефератами и работой на семинарах; чем больше баллов, тем проще устный экзамен, возможен автомат.'},
      {name:'БЖД, английский, библиография', text:'БЖД — посещение, устные опросы и итоговая работа, за реферат возможен автомат. Английский — закрыть все долги по домашним и классным работам. Библиография — одна специальная пара в библиотеке, там же и зачёт.'},
      {name:'Физкультура', text:'В начале сентября распределение по видам спорта. Можно ходить в центральные секции МГУ по вечерам — они дают зачёт вместо обычной физкультуры.'},
    ]},
  2:{credits:['Практикум на ЭВМ', 'Алгебра и геометрия', 'Матанализ', 'Английский', 'Физкультура'],
    exams:['Алгебра и геометрия', 'Матанализ', 'Дискретная математика', 'Архитектура ЭВМ и ассемблер', 'Русский язык'],
    creditDates:'закрыться можно к ~20 мая, первые комиссии — до конца мая, ещё две попытки — в сентябре', examDates:'июнь',
    notes:[
      {name:'Дискретная математика', text:'Контрольные по четырём темам: алгебра логики, графы, кодирование, автоматы. За каждую тему 0, ½ или 1: при «1» задачи на эту тему на экзамене не будет, при «0» — будет точно. На экзамене задачи по несданным темам, затем часть А (определения и понимание, можно с материалами) и часть Б (билет после подготовки). Каждая нерешённая задача — минус балл.'},
      {name:'Архитектура ЭВМ и ассемблер', text:'1 поток: коллоквиумы во второй половине марта и в конце апреля, всё письменно; итог — 60% экзамен и по 20% коллоквиумы, возможен автомат. 2–3 поток: только письменный экзамен.'},
      {name:'Практикум на ЭВМ', text:'Небольшие исследовательские работы с отчётом по образцу: вовремя покажи программу и не затягивай с оформлением.'},
      {name:'Русский язык', text:'Три эссе и «блокнот» напрямую влияют на оценку, просрочки её снижают. Хорошие эссе вовремя — шанс на автомат; сам экзамен устный и не строгий.'},
    ]},
};
const BOOKS = ['Вороненко — Дискретная математика. Задачи и упражнения с решениями', 'Иванников — «Алгоритмы и алгоритмические языки». Варианты письменного экзамена',
  'Садовничая — Предел и непрерывность функции одной переменной', 'Садовничая — Вещественные числа и последовательности', 'Садовничая — Функции многих переменных',
  'Пильщиков — Упражнения по языку ассемблера MASM', 'Хорошилова — Неопределённый интеграл', 'Ильин — Линейная алгебра и аналитическая геометрия',
  'Гаврилов — Задачи и упражнения по дискретной математике', 'Ким — Алгебра и аналитическая геометрия. Теоремы и задачи, тома I и II',
  'Пильщиков — Язык Паскаль: упражнения и задачи', 'Ильин — Математический анализ, часть 1', 'Демидович — Сборник задач и упражнений по математическому анализу',
  'Садовничая — Определённый интеграл', 'Алексеев — Лекции по дискретной математике'];

// ——— Trees ———
// Marked with another semester («1 семестр», «2 сем.», «(2 семестр)») or another stream («3 поток», «[2-3 поток»,
// «1_поток») — left out for the picked ones.
const termOf = (name:string):Term | null => /(^|[^\d])(2|II)[\s.]*сем|\(2 семестр\)/i.test(name) ? 2 : /(^|[^\d])(1|I)[\s.]*сем|\(1 семестр\)/i.test(name) ? 1 : null;
function flowsOf(name:string):Flow[] | null {
  const range = name.match(/(?:^|[^\d])([123])\s*[-–]\s*([123])[\s_]*поток/i);
  if (range) return (['1', '2', '3'] as Flow[]).filter(f => f >= range[1] && f <= range[2]);
  const one = name.match(/(?:^|[^\d])([123])[\s_]*поток/i);
  return one ? [one[1] as Flow] : null;
}
function narrow(nodes:Node[], term:Term, splitTerm:boolean, flow:Flow):Node[] {
  return nodes.filter(n => { const t = splitTerm ? termOf(n.n) : null, f = flowsOf(n.n); return (t === null || t === term) && (!f || f.includes(flow)); })
    .map(n => n.c ? {...n, c:narrow(n.c, term, splitTerm, flow)} : n).filter(n => !n.c || count(n.c) + (n.p || 0) > 0);
}
const count = (nodes:Node[]):number => nodes.reduce((sum, n) => sum + (n.c ? count(n.c) + (n.p || 0) : USEFUL.test(n.n) ? 1 : 0), 0);
const total = (nodes:Node[]):number => nodes.reduce((sum, n) => sum + (n.c ? total(n.c) + (n.p || 0) : 1), 0);
const find = (nodes:Node[] | undefined, path:string):Node | undefined => path.split('/').reduce<Node | undefined>((at, part, i) => (i === 0 ? nodes : at?.c)?.find(n => n.n === part), undefined);
const clean = (name:string) => name.replace(/^\d+\.\s*/, '').replace(/_/g, ' ');
const pretty = (name:string) => clean(name).replace(/\.[a-z0-9]+$/i, '');
const ext = (name:string) => name.match(/\.([a-z0-9]+)$/i)?.[1].toUpperCase() || '';
const size = (bytes = 0) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(bytes > 10485760 ? 0 : 1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
const rank = (name:string) => /экзам|коллокв|подготов/i.test(name) ? 0 : /контрольн|зач[её]т|вариант/i.test(name) ? 1 : /книг|пособ|учебн/i.test(name) ? 2
  : /конспект|лекци|мануал|теори/i.test(name) ? 3 : /самодел|шпаргал/i.test(name) ? 4 : 5;
const byYear = (a:Node, b:Node) => { const ya = a.n.match(/^(19|20)\d\d/)?.[0], yb = b.n.match(/^(19|20)\d\d/)?.[0]; return ya && yb ? yb.localeCompare(ya) || a.n.localeCompare(b.n, 'ru', {numeric:true}) : 0; };

const Out = ({href, children, className}:{href:string; children:ReactNode; className?:string}) =>
  <a className={className} href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a>;

// A folder with an arrow; its contents are drawn only when opened.
function Folder({node, path, links, depth = 0, label}:{node:Node; path:string; links:Linker; depth?:number; label?:ReactNode}) {
  const [open, setOpen] = useState(false);
  if (!node.c) return <FileRow node={node} path={path} links={links}/>;
  const useful = count(node.c) + (node.p || 0), all = total(node.c) + (node.p || 0);
  if (node.code || (all >= 10 && useful / all < .35)) return <Out className="useful-file folder-only" href={links.folder(path)}><FolderOpen size={14}/><span>{clean(node.n)}</span><small>{node.code ? 'программы' : `программы, ${all} файлов`}</small></Out>;
  return <details className="useful-folder" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
    <summary><ChevronRight size={15} className="chev"/><span>{label ?? clean(node.n)}</span>{links.locked && <Lock size={12} className="lock"/>}<small>{useful}</small></summary>
    {open && <FolderBody nodes={node.c} photos={node.p} path={path} links={links} depth={depth + 1}/>}
  </details>;
}
function FileRow({node, path, links}:{node:Node; path:string; links:Linker}) {
  return <Out className="useful-file" href={links.file(path, node.n)}>{IMG.test(node.n) ? <ImageIcon size={14}/> : <FileText size={14}/>}<span>{pretty(node.n)}</span><small>{IMG.test(node.n) ? 'фото' : ext(node.n)} · {size(node.s)}{links.locked ? ' · 🔒' : ''}</small></Out>;
}
function FolderBody({nodes, photos = 0, path, links, depth}:{nodes:Node[]; photos?:number; path:string; links:Linker; depth:number}) {
  const dirs = nodes.filter(n => n.c).sort(byYear), files = nodes.filter(n => !n.c && USEFUL.test(n.n));
  const images = files.filter(f => IMG.test(f.n)), docs = files.filter(f => !IMG.test(f.n));
  return <div className="useful-folder-body">
    {dirs.map(d => <Folder key={d.n} node={d} path={`${path}/${d.n}`} links={links} depth={depth}/>)}
    {docs.map(f => <FileRow key={f.n} node={f} path={`${path}/${f.n}`} links={links}/>)}
    {images.length + photos > 0 && (images.length + photos > 4
      ? <Out className="useful-file" href={links.folder(path)}><ImageIcon size={14}/><span>{images.length + photos} фото</span><small>открыть папку{links.locked ? ' · 🔒' : ''}</small></Out>
      : images.map(f => <FileRow key={f.n} node={f} path={`${path}/${f.n}`} links={links}/>))}
    {!dirs.length && !files.length && !photos && <p className="useful-empty">Пусто</p>}
  </div>;
}

// The closed part keeps «N семестр / M поток (or ФИИТ) / предмет»: the subject's folders of the picked semester and stream.
function closedFor(closed:Closed | null, subject:Subject, term:Term, flow:Flow):{node:Node; path:string}[] {
  if (!closed || !subject.scsd) return [];
  const semester = closed.tree.find(n => n.n.trim() === `${term} семестр`), stream = semester?.c?.find(n => n.n.trim() === flowName(flow));
  return (stream?.c || []).filter(n => n.c && subject.scsd!.test(n.n) && count(n.c) > 0)
    .map(n => ({node:n, path:`SCSD/1 курс/${semester!.n}/${stream!.n}/${n.n}`}));
}

function SubjectCard({subject, flow, term, drive, closed, lecturers, mine}:{subject:Subject; flow:Flow; term:Term; drive:Drive | null; closed:Closed | null; lecturers:string[]; mine:boolean}) {
  const pair = pairOf(flow), folder = pick(subject.folder, pair), books = pick(subject.books, pair) || [], sites = pick(subject.sites, pair) || [];
  const links = drive ? openLinks(drive.publicKey) : OPEN;
  const root = drive ? find(drive.folders['/1 курс'], folder.replace(/^1 курс\//, '')) : undefined;
  const nodes = root?.c ? narrow(root.c, term, subject.terms.length > 1, flow) : [];
  const sections = nodes.filter(n => n.c).sort((a, b) => rank(a.n) - rank(b.n)), loose = nodes.filter(n => !n.c && USEFUL.test(n.n));
  const locked = closedFor(closed, subject, term, flow);
  return <article className="useful-card subject">
    <header><b>{subject.name}</b><span>{term} семестр · {flowName(flow)}{mine ? ' · твой' : ''}</span></header>
    {lecturers.length > 0 && <p className="useful-lecturer"><UserRound size={13}/>Лектор{lecturers.length > 1 ? 'ы' : ''}: {lecturers.join(', ')}</p>}
    {(books.length > 0 || sites.length > 0) && <div className="useful-links">
      {books.map(path => { const node = drive ? find(root?.c, path) : undefined; const name = path.split('/').pop()!;
        return drive && !node ? null : <Out key={path} href={node?.c || !drive ? links.folder(`${folder}/${path}`) : links.file(`${folder}/${path}`, name)}>{node?.c ? <FolderOpen size={13}/> : <BookOpen size={13}/>}{bookTitle(name)}</Out>; })}
      {sites.map(([label, href]) => <Out key={href} href={href}>{label}</Out>)}
    </div>}
    {drive ? <div className="useful-sections">
      {sections.map(s => <Folder key={s.n} node={s} path={`${folder}/${s.n}`} links={links}/>)}
      {loose.length > 0 && <Folder node={{n:'Файлы в папке предмета', c:loose}} path={folder} links={links}/>}
      {locked.map(({node, path}) => <Folder key={path} node={node} path={path} links={closedLinks} label={<>Закрытая часть · {clean(node.n.trim())}</>}/>)}
    </div> : <p className="useful-empty">Загружаем список файлов…</p>}
    <div className="useful-links"><Out className="useful-primary" href={links.folder(folder)}><FolderOpen size={14}/>Вся папка на диске</Out></div>
  </article>;
}
function bookTitle(name:string) {
  const t = pretty(name).replace(/^\[(Теория|Учебник|Задачник|Методички)\]\s*/, '$1: ').replace(/\s*\(Алгебра и аналитическая геометрия\)/, '').replace(/\s*\(Линейная алгебра и аналитическая геометрия\)/, '');
  return t.length > 46 ? t.slice(0, 44).replace(/[\s,.(-]+\S*$/, '') + '…' : t;
}

// ——— By teacher ———
type People = Record<string, {name:string; url:string; position:string}>;
const people = (directory as {people:People}).people;
type Teacher = {key:string; short:string; subjects:Record<string, {lecture:Set<string>; class:Set<string>}>};
const plural = (n:number, f:[string, string, string]) => f[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];

function TeacherCard({teacher, roles, mentions, drive, flow, open = false}:{teacher:{key:string; short:string}; roles:string[]; mentions:{path:string; node:Node}[]; drive:Drive; flow:Flow; open?:boolean}) {
  const [shown, setShown] = useState(open);
  const info = people[teacher.key];
  const links = openLinks(drive.publicKey);
  const subjects = SUBJECTS.filter(s => roles.some(r => s.match.test(r)));
  return <details className="useful-card teacher" open={open} onToggle={e => setShown((e.target as HTMLDetailsElement).open)}>
    <summary><ChevronRight size={16} className="chev"/><span><b>{info?.name || teacher.short}</b><small>{roles.join(' · ')}</small></span>{mentions.length > 0 && <em>{mentions.length}</em>}</summary>
    {shown && <div className="teacher-body">
      {info && <p>{info.position}{info.url && <> · <a href={info.url} target="_blank" rel="noreferrer">страница на сайте ВМК</a></>}</p>}
      {mentions.length > 0 ? <div className="useful-sections">{mentions.map(m => <Folder key={m.path} node={m.node} path={m.path} links={links}/>)}</div>
        : <p className="useful-empty">Материалов с этой фамилией на диске нет — смотри материалы предмета.</p>}
      {subjects.length > 0 && <div className="useful-links">{subjects.map(s => { const folder = pick(s.folder, pairOf(flow)); return <Out key={s.name} href={links.folder(folder)}><FolderOpen size={13}/>{s.name}</Out>; })}</div>}
    </div>}
  </details>;
}

function TeacherView({teachers, group, groupStream, groupFlow, drive}:{teachers:Map<string, Teacher>; group:string; groupStream:string; groupFlow:Flow; drive:Drive}) {
  const all = useMemo(() => [...new Set([...teachers.keys(), ...Object.keys(people), ...DISK_TEACHERS.map(k => k.replace(/ё/g, 'е'))])], [teachers]);
  // A namesake's material (no initials in the file name) is kept only if it is of a subject this teacher teaches.
  const mentions = useMemo(() => {
    const found = diskMentions(drive, all) as Map<string, {path:string; node:Node}[]>;
    for (const [key, list] of found) {
      const taught = teachers.get(key); if (!taught) continue;
      const subjectsTaught = Object.keys(taught.subjects);
      found.set(key, list.filter(m => { const subject = SUBJECTS.find(s => s.match.test(m.path.split('/').slice(0, 2).join('/')));
        return !subject || subjectsTaught.some(t => subject.match.test(t)); }));
    }
    return found;
  }, [drive, all, teachers]);
  const roleOf = (t:Teacher, only?:string) => Object.entries(t.subjects).flatMap(([subject, v]) => [
    ...(v.lecture.size ? [`лекции «${subject}»${only ? '' : ` · ${[...v.lecture].sort().join(', ')} поток`}`] : []),
    ...(v.class.size && (!only || v.class.has(only)) ? [`семинары «${subject}»${only ? '' : ` · ${v.class.size} ${plural(v.class.size, ['группа', 'группы', 'групп'])}`}`] : []),
  ]);
  // The group's own teachers: lectures of its stream, seminars of the group itself.
  const myRoles = (t:Teacher) => Object.entries(t.subjects).flatMap(([subject, v]) => [...(v.lecture.has(groupStream) ? [`лекции «${subject}»`] : []), ...(v.class.has(group) ? [`семинары «${subject}»`] : [])]);
  const mine = [...teachers.values()].filter(t => myRoles(t).length > 0);
  const lecturers = [...teachers.values()].filter(t => !mine.includes(t) && Object.values(t.subjects).some(v => v.lecture.size));
  // Teachers of the course with materials on the disk who are neither, then names known only from the disk.
  const withMaterials = [...teachers.values()].filter(t => !mine.includes(t) && !lecturers.includes(t) && (mentions.get(t.key)?.length || 0) > 0);
  const diskOnly = all.filter(k => !teachers.has(k) && (mentions.get(k)?.length || 0) > 0).sort((a, b) => mentions.get(b)!.length - mentions.get(a)!.length);
  return <>
    <h2 className="useful-h"><UserRound size={18}/>Твоя группа {group}</h2>
    <div className="useful-list">{mine.sort((a, b) => myRoles(a)[0]?.localeCompare(myRoles(b)[0] || '') || 0).map(t =>
      <TeacherCard key={t.key} teacher={t} roles={myRoles(t)} mentions={mentions.get(t.key) || []} drive={drive} flow={groupFlow}/>)}</div>
    <h2 className="useful-h"><GraduationCap size={18}/>Лекторы курса</h2>
    <div className="useful-list">{lecturers.sort((a, b) => a.short.localeCompare(b.short, 'ru')).map(t =>
      <TeacherCard key={t.key} teacher={t} roles={roleOf(t).filter(r => r.startsWith('лекции'))} mentions={mentions.get(t.key) || []} drive={drive} flow={groupFlow}/>)}</div>
    {(diskOnly.length > 0 || withMaterials.length > 0) && <>
      <h2 className="useful-h"><Library size={18}/>Ещё в материалах диска</h2>
      <div className="useful-list">
        {withMaterials.map(t => <TeacherCard key={t.key} teacher={t} roles={roleOf(t)} mentions={mentions.get(t.key) || []} drive={drive} flow={groupFlow}/>)}
        {diskOnly.map(k => <TeacherCard key={k} teacher={{key:k, short:people[k]?.name || k}} roles={['материалы прошлых лет']} mentions={mentions.get(k) || []} drive={drive} flow={groupFlow}/>)}
      </div></>}
  </>;
}

type Stream = {title:string; groups:string[]};
export function UsefulView({table, group, streams}:{table:{groups:Record<string, {page:number; lessons:any[]}>}; group:string; streams:Stream[]}) {
  // Stream of each group by the timetable: «1 поток» → '1'; ФИИТ goes with the 1st stream in CSDrive.
  const flows = useMemo(() => Object.fromEntries(streams.flatMap(s => s.groups.map(g => [g, (s.title.match(/^([123]) поток/)?.[1] || 'ФИИТ') as Flow]))), [streams]);
  const streamOfGroup = (g:string) => streams.find(s => s.groups.includes(g))?.title.match(/^([123]) поток/)?.[1] || 'ФИИТ';
  const teachers = useMemo(() => courseTeachers(table, streamOfGroup) as Map<string, Teacher>, [table, streams]);
  const own = flows[group] || '1';
  const [term, setTerm] = useState<Term>(() => { const m = new Date().getMonth(); return m >= 1 && m <= 6 ? 2 : 1; });
  const [flow, setFlow] = useState<Flow>(own);
  const [mode, setMode] = useState<'subjects' | 'teachers'>('subjects');
  const [drive, setDrive] = useState<Drive | null>(null), [closed, setClosed] = useState<Closed | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const load = (name:string) => fetch(import.meta.env.BASE_URL + name).then(r => r.ok ? r.json() : Promise.reject());
    load('csdrive.json').then(d => { if (live) setDrive(d); }).catch(() => { if (live) setFailed(true); });
    load('scsd.json').then(d => { if (live) setClosed(d); }).catch(() => {});
    return () => { live = false; };
  }, []);
  // The semester's subjects, plus any the closed part has for this semester and stream (ФИИТ: дискретка в 1 семестре).
  const subjects = SUBJECTS.filter(s => s.terms.includes(term) || closedFor(closed, s, term, flow).length > 0);
  const t = TERMS[term];
  const success = find(drive?.folders['/Полезная информация'], 'Как быть успешным студентом');
  return <section className="useful">
    <h1 className="session-title">Полезное</h1>
    <p className="term-sub">Первый курс · материалы CSDrive{drive ? `, список от ${new Date(drive.updatedAt).toLocaleDateString('ru-RU', {day:'numeric', month:'long'})}` : ''}</p>

    <div className="useful-hero useful-card">
      <div><b>CSDrive</b><p>Облачное хранилище учебных материалов, которое с 2011 года собирают студенты ВМК: книги, конспекты, варианты коллоквиумов и экзаменов. Закрытая часть (🔒) — для 1–2 курсов, пароль у старосты.</p></div>
      <div className="useful-actions">
        <Out className="useful-primary" href={`${DISK}/${encodePath('1 курс')}`}><FolderOpen size={16}/>Материалы 1 курса</Out>
        <Out href={SCSD}><Lock size={14}/>Закрытая часть</Out><Out href={TABLE}>Таблица CSDrive</Out>
      </div>
    </div>

    <div className="useful-filters">
      <div className="term-years" role="group" aria-label="Как разделить">
        <button aria-pressed={mode==='subjects'} onClick={()=>setMode('subjects')}>По предметам</button><button aria-pressed={mode==='teachers'} onClick={()=>setMode('teachers')}>По преподавателям</button>
      </div>
      {mode === 'subjects' && <>
        <div className="term-years" role="group" aria-label="Семестр">
          {([1, 2] as Term[]).map(n => <button key={n} aria-pressed={term===n} onClick={()=>setTerm(n)}>{n} сем.</button>)}
        </div>
        <div className="term-years" role="group" aria-label="Поток">
          {FLOWS.map(f => <button key={f} aria-pressed={flow===f} onClick={()=>setFlow(f)}>{f === 'ФИИТ' ? 'ФИИТ' : `${f} поток`}{f===own ? ' ·' : ''}</button>)}
        </div>
      </>}
    </div>
    {failed && <p className="useful-empty">Список файлов не загрузился — открой папки на диске по кнопкам.</p>}

    {mode === 'subjects' ? <>
      <h2 className="useful-h"><BookOpen size={18}/>{term} семестр · {flowName(flow)}</h2>
      <div className="useful-list">
        {subjects.map(s => <SubjectCard key={s.name} subject={s} flow={flow} term={term} drive={drive} closed={closed} mine={flow===own}
          lecturers={lecturersOf(teachers, s.match, flow) as string[]}/>)}
      </div>

      <h2 className="useful-h"><GraduationCap size={18}/>Как сдать {term === 1 ? 'зимнюю' : 'летнюю'} сессию</h2>
      <div className="useful-card">
        <div className="useful-columns">
          <div><small>Зачёты</small><p>{t.credits.join(', ')}</p></div>
          <div><small>Экзамены · {t.examDates}</small><p>{t.exams.join(', ')}</p></div>
        </div>
        <p className="useful-rule"><b>Как устроен зачёт.</b> Его получают в группе у своего преподавателя за работу в семестре, попыток несколько. Не получил — идёшь на комиссию: она общая для потока, на ней три попытки. До комиссий лучше не доводить: они съедают время перед сессией, а на первом курсе чаще всего вылетают из-за линала. По опыту прошлых лет: {t.creditDates}.</p>
        {t.notes.map(n => <details key={n.name} className="useful-note"><summary>{n.name}</summary><p>{n.text}</p></details>)}
        <p className="session-muted">Это опыт студентов прошлых лет: правила зависят от преподавателя и меняются. Даты своей сессии смотри во вкладке «Календарь».</p>
      </div>
    </> : drive ? <TeacherView teachers={teachers} group={group} groupStream={streamOfGroup(group)} groupFlow={own} drive={drive}/> : <p className="useful-empty">Загружаем материалы…</p>}

    <h2 className="useful-h"><Sparkles size={18}/>Ещё полезное</h2>
    <div className="useful-list">
      <article className="useful-card"><header><b>Как учиться и сдавать</b></header><p>Памятка первокурсника, как сдать экзамен, список кафедр ВМК, как писать тексты и требования к диплому.</p>
        {success?.c && drive ? <div className="useful-sections"><FolderBody nodes={success.c} path="Полезная информация/Как быть успешным студентом" links={openLinks(drive.publicKey)} depth={0}/></div> : null}
        <div className="useful-links"><Out href={`${DISK}/${encodePath('Полезная информация/Расписания прошлых лет')}`}>Расписания прошлых лет</Out><Out href={`${DISK}/${encodePath('1 курс/Общая информация')}`}>Общая информация 1 курса</Out></div></article>
      <article className="useful-card"><header><b>МФК — межфакультетские курсы</b></header><p>По средам у большинства факультетов свободны 4-я и 5-я пары: можно слушать курс любого факультета МГУ. К концу 3-го курса нужны зачёты по двум МФК, лучше набрать их заранее. Запись — в личном кабинете, мест около 300 на курс, популярные разбирают быстро. Зачёт обычно за посещение и реферат или эссе.</p>
        <div className="useful-links"><Out href="https://lk.msu.ru/">lk.msu.ru</Out><Out href={`${DISK}/${encodePath('МФК')}`}>Материалы МФК на диске</Out></div></article>
      <article className="useful-card"><header><b>Физкультура в секциях МГУ</b></header><p>Центральные секции занимаются по вечерам и дают зачёт вместо обычной физкультуры.</p>
        <div className="useful-links"><Out href="https://www.sportmsu.ru/sekcii">Список секций</Out></div></article>
      <article className="useful-card"><header><b>Бесплатно для студентов</b></header><p>С университетской почтой: GitHub Student Developer Pack, все IDE JetBrains, частичная или полная оплата курсов Coursera по запросу в поддержку.</p>
        <div className="useful-links"><Out href="https://education.github.com/pack">GitHub Student Pack</Out><Out href="https://www.jetbrains.com/student/">JetBrains</Out></div></article>
      <details className="useful-card useful-books"><summary><Library size={16}/>Книги, которые выдают в библиотеке</summary><ol>{BOOKS.map(b => <li key={b}>{b}</li>)}</ol></details>
    </div>

    <h2 className="useful-h"><MessageCircle size={18}/>CSDrive: связь и помощь</h2>
    <div className="useful-card"><p>Нашёл ошибку или хочешь добавить свои материалы — пришли файлы или папку в zip-архиве, можно стать администратором диска. Все мы учимся по материалам прошлых поколений.</p>
      <div className="useful-links"><Out href="https://vk.com/csdrive_msu">Паблик ВК</Out><Out href="https://vk.com/gim171263993">Написать в ВК</Out><Out href="https://t.me/csdrive_bot">Telegram-бот</Out><Out href="mailto:msu.cmc.materials@yandex.ru">msu.cmc.materials@yandex.ru</Out></div></div>

    <details className="useful-card useful-books"><summary>Другие архивы ВМК</summary>
      <div className="useful-links"><Out href="http://esyr.org/wiki/">esyr wiki</Out><Out href="http://cmcstuff.esyr.org/">cmcstuff</Out><Out href="http://tka4.org/materials/study/">tka4</Out><Out href="http://cmcmsu.no-ip.info/">Практикум на ЭВМ</Out></div></details>
  </section>;
}
