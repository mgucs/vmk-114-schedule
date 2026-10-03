import {useEffect, useState, type ReactNode} from 'react';
import {ArrowUpRight, BookOpen, ChevronRight, FileText, FolderOpen, GraduationCap, Image as ImageIcon, Library, Lock, MessageCircle, Sparkles} from 'lucide-react';

// «Полезное» for the first course, from CSDrive — the students' archive of study materials of ВМК
// (table: goo.gl/YyE6jP, folder: disk.yandex.ru/d/uBxTJDaahuSjZA). public/csdrive.json is its folder tree
// (scripts/sync-csdrive.mjs); here it is split by semester and stream, down to single files.
// The texts about credits and exams are CSDrive's first-course notes, retold as experience of past years.
const DISK = 'https://disk.yandex.ru/d/uBxTJDaahuSjZA';
const TABLE = 'https://docs.google.com/spreadsheets/d/1jPWpbivxCf3xRv-jAueWEF-XmPo1I3kLS2o6UyDBDMU/edit';
const encodePath = (path:string) => path.split('/').map(encodeURIComponent).join('/');
const folderUrl = (path:string) => `${DISK}/${encodePath(path)}`;
// Documents open in Yandex's viewer (the same links CSDrive's table uses); other files in the disk itself.
const VIEW = /\.(pdf|djvu|docx?|pptx?|xlsx?|rtf|txt|odt|epub)$/i;
const IMG = /\.(jpe?g|png|gif|heic|webp)$/i;
const USEFUL = /\.(pdf|djvu|docx?|pptx?|xlsx?|rtf|txt|tex|odt|epub|jpe?g|png|gif|heic|webp|zip|7z|rar|gz)$/i;
const fileUrl = (path:string, name:string, key:string) => VIEW.test(name) && key
  ? `https://docs.yandex.ru/docs/view?url=${encodeURIComponent(`ya-disk-public://${key}:/${path}`)}&name=${encodeURIComponent(name)}` : folderUrl(path);

type Node = {n:string; s?:number; c?:Node[]};
type Drive = {updatedAt:string; publicKey:string; folders:Record<string, Node[]>};
type Stream = '1' | '2-3';
type Term = 1 | 2;
type Subject = {name:string; terms:Term[]; folder:string | Record<Stream, string>; books?:string[] | Record<Stream, string[]>; sites?:[string, string][] | Record<Stream, [string, string][]>};

const SUBJECTS:Subject[] = [
  {name:'Математический анализ', terms:[1, 2], folder:'1 курс/Математический анализ',
    books:['1. Книги/Демидович (2005).pdf', '1. Книги/[Теория] Ильин Садовничий Сендов (часть 1).djvu', '4. Конспекты/[2020] МАТАН. Лекции.pdf', '1. Книги/[Методички] Садовничая Хорошилова Фоменко']},
  {name:'Алгебра и геометрия', terms:[1, 2], folder:'1 курс/Алгебра и геометрия (Линал)',
    books:['1. Книги/[Учебник] Ким, Ильин (Линейная алгебра и аналитическая геометрия).pdf', '1. Книги/Ким, Крицков/[Задачник] 1-1 Ким, Крицков (Алгебра и аналитическая геометрия).pdf',
      '1. Книги/Ким, Крицков/Том 2 (2003)/[Задачник] 2-1 Ким, Крицков (Алгебра и аналитическая геометрия).pdf', '1. Книги/[Учебник] Ильин, Позняк - Линейная алгебра.djvu']},
  {name:'Алгоритмы и алгоритмические языки', terms:[1],
    folder:{'1':'1 курс/[1 поток, 1 сем.] Алгоритмы и АЯ', '2-3':'1 курс/[2-3 поток, 1 сем.] Алгоритмы и АЯ'},
    books:{'1':['1. Книги/1. Керниган и Ритчи, Язык программирования Си..pdf', '1. Книги/0. Слайды лекций - 2014 (лектор - Белеванцев А. А.).pdf', '1. Книги/3. Семинары по курсу АиАЯ.pdf'],
      '2-3':['1. Книги/Введение в язык Паскаль. Абрамов Трифонов Трифонова 2021 год.pdf', '1. Книги/Пильщиков - Язык Паскаль, упражнения и задачи.djvu', '1. Книги/Пильщиков - Письменный экзамен по курсу АЯ(методичка).pdf']},
    sites:{'1':[['Сайт курса', 'http://algcourse.cs.msu.ru/']], '2-3':[]}},
  {name:'Архитектура ЭВМ и ассемблер', terms:[2],
    folder:{'1':'1 курс/[1 поток, 2 сем.] Архитектура ЭВМ и АСМ', '2-3':'1 курс/[2-3 поток, 2 сем.] Архитектуры ЭВМ и АСМ'},
    books:{'1':['1. Книги, пособия/Брайант, Халларон - Комп. системы архитектура и программирование.djvu', '1. Книги, пособия/Семинары по курсу Часть 1 Е.А. Кузьменкова, В.С. Махныче.pdf',
      '1. Книги, пособия/Семинары по курсу Часть 2 Е.А. Кузьменкова, В.А. Падарян.pdf', '1. Книги, пособия/Столяров А.В. - Методичка NASM для ОС Unix.pdf'],
      '2-3':['1.Книги/Введение в архитектуру ЭВМ и системы программирования', '1.Книги/Пильщиков - Assembler. Программирование на языке ассемблера IBM PC.djvu', '1.Книги/Упражнения по языку Ассемблера MASM В.Н.Пильщиков']},
    sites:{'1':[['Сайт курса', 'http://asmcourse.cs.msu.ru/'], ['Справочник команд', 'http://asmworld.ru/spravochnik-komand/']], '2-3':[]}},
  {name:'Дискретная математика', terms:[2], folder:'1 курс/Дискретная математика (2 семестр)',
    books:['Книги/1. Дискретная математика - Алексеев В.Б (курс лекций, 2-ой семестр).pdf', 'Книги/Гаврилов - Задачи и упражнения по дискретной математике.pdf', 'Книги/Вороненко - Задачи и упражнения с решениями.pdf'],
    sites:[['Сайт курса и билеты', 'http://mk.cs.msu.ru/index.php/%D0%94%D0%B8%D1%81%D0%BA%D1%80%D0%B5%D1%82%D0%BD%D0%B0%D1%8F_%D0%BC%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0_(1%D0%B9_%D0%BA%D1%83%D1%80%D1%81)']]},
  {name:'История России', terms:[1], folder:'1 курс/Гуманитарий/История'},
  {name:'Безопасность жизнедеятельности', terms:[1], folder:'1 курс/Гуманитарий/БЖД'},
  {name:'Английский язык', terms:[1, 2], folder:'1 курс/Гуманитарий/Английский'},
  {name:'Библиография', terms:[1], folder:'1 курс/Гуманитарий/Библиография'},
  {name:'Русский язык и культура речи', terms:[2], folder:'1 курс/Гуманитарий/Русский язык и культура речи'},
];
const pick = <T,>(v:T | Record<Stream, T>, stream:Stream):T => (v && typeof v === 'object' && !Array.isArray(v) && '1' in (v as object)) ? (v as Record<Stream, T>)[stream] : v as T;

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

// ——— The folder tree ———
// A folder or file marked with the other semester («1 семестр», «2 сем.», «(2 семестр)») is left out.
const termOf = (name:string):Term | null => /(^|[^\d])(2|II)[\s.]*сем|\(2 семестр\)/i.test(name) ? 2 : /(^|[^\d])(1|I)[\s.]*сем|\(1 семестр\)/i.test(name) ? 1 : null;
function forTerm(nodes:Node[], term:Term, split:boolean):Node[] {
  if (!split) return nodes;
  return nodes.filter(n => { const t = termOf(n.n); return t === null || t === term; })
    .map(n => n.c ? {...n, c:forTerm(n.c, term, true)} : n).filter(n => !n.c || count(n.c) > 0);
}
const count = (nodes:Node[]):number => nodes.reduce((sum, n) => sum + (n.c ? count(n.c) : USEFUL.test(n.n) ? 1 : 0), 0);
const total = (nodes:Node[]):number => nodes.reduce((sum, n) => sum + (n.c ? total(n.c) : 1), 0);
const find = (nodes:Node[] | undefined, path:string):Node | undefined => path.split('/').reduce<Node | undefined>((at, part, i) => (i === 0 ? nodes : at?.c)?.find(n => n.n === part), undefined);
const clean = (name:string) => name.replace(/^\d+\.\s*/, '').replace(/_/g, ' ');
const pretty = (name:string) => clean(name).replace(/\.[a-z0-9]+$/i, '');
const ext = (name:string) => name.match(/\.([a-z0-9]+)$/i)?.[1].toUpperCase() || '';
const size = (bytes = 0) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(bytes > 10485760 ? 0 : 1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
// Sections of a subject: exams first, then tests, books, notes, homemade summaries, the rest.
const rank = (name:string) => /экзам|коллокв|подготов/i.test(name) ? 0 : /контрольн|зач[её]т|вариант/i.test(name) ? 1 : /книг|пособ|учебн/i.test(name) ? 2
  : /конспект|лекци|мануал|теори/i.test(name) ? 3 : /самодел|шпаргал/i.test(name) ? 4 : 5;
// Years newest first ("2024", "2018_1", "2014 (2)").
const byYear = (a:Node, b:Node) => { const ya = a.n.match(/^(19|20)\d\d/)?.[0], yb = b.n.match(/^(19|20)\d\d/)?.[0]; return ya && yb ? yb.localeCompare(ya) || a.n.localeCompare(b.n, 'ru', {numeric:true}) : 0; };

const Out = ({href, children, className}:{href:string; children:ReactNode; className?:string}) =>
  <a className={className} href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a>;

function Folder({node, path, drive, depth = 0}:{node:Node; path:string; drive:Drive; depth?:number}) {
  const [open, setOpen] = useState(false);
  const kids = node.c || [], useful = count(kids), all = total(kids);
  // Mostly programs and system files (Pascal, assembler projects): the folder itself, not a list.
  if (all >= 10 && useful / all < .35) return <Out className="useful-file folder-only" href={folderUrl(path)}><FolderOpen size={14}/><span>{clean(node.n)}</span><small>программы, {all} файлов</small></Out>;
  return <details className="useful-folder" style={{'--depth':depth} as React.CSSProperties} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
    <summary><ChevronRight size={15} className="chev"/><span>{clean(node.n)}</span><small>{useful}</small></summary>
    {open && <FolderBody nodes={kids} path={path} drive={drive} depth={depth + 1}/>}
  </details>;
}
function FolderBody({nodes, path, drive, depth}:{nodes:Node[]; path:string; drive:Drive; depth:number}) {
  const dirs = nodes.filter(n => n.c).sort(byYear), files = nodes.filter(n => !n.c && USEFUL.test(n.n));
  const images = files.filter(f => IMG.test(f.n)), docs = files.filter(f => !IMG.test(f.n));
  return <div className="useful-folder-body">
    {dirs.map(d => <Folder key={d.n} node={d} path={`${path}/${d.n}`} drive={drive} depth={depth}/>)}
    {docs.map(f => <Out key={f.n} className="useful-file" href={fileUrl(`${path}/${f.n}`, f.n, drive.publicKey)}><FileText size={14}/><span>{pretty(f.n)}</span><small>{ext(f.n)} · {size(f.s)}</small></Out>)}
    {images.length > 0 && (images.length > 4
      ? <Out className="useful-file" href={folderUrl(path)}><ImageIcon size={14}/><span>{images.length} фото</span><small>открыть папку</small></Out>
      : images.map(f => <Out key={f.n} className="useful-file" href={folderUrl(`${path}/${f.n}`)}><ImageIcon size={14}/><span>{pretty(f.n)}</span><small>фото · {size(f.s)}</small></Out>))}
    {!dirs.length && !files.length && <p className="useful-empty">Пусто</p>}
  </div>;
}

function SubjectCard({subject, stream, term, drive, mine}:{subject:Subject; stream:Stream; term:Term; drive:Drive | null; mine:boolean}) {
  const folder = pick(subject.folder, stream), books = pick(subject.books, stream) || [], sites = pick(subject.sites, stream) || [];
  const root = drive ? find(drive.folders['/1 курс'], folder.replace(/^1 курс\//, '')) : undefined;
  const nodes = root?.c ? forTerm(root.c, term, subject.terms.length > 1) : [];
  const sections = nodes.filter(n => n.c).sort((a, b) => rank(a.n) - rank(b.n)), loose = nodes.filter(n => !n.c && USEFUL.test(n.n));
  const streamed = typeof subject.folder !== 'string';
  return <article className="useful-card subject">
    <header><b>{subject.name}</b><span>{subject.terms.length > 1 ? `${term} семестр` : `${subject.terms[0]} семестр`}{streamed ? ` · ${stream === '1' ? '1 поток' : '2–3 поток'}` : ''}{streamed && mine ? ' · твой' : ''}</span></header>
    {(books.length > 0 || sites.length > 0) && <div className="useful-links">
      {books.map(path => { const node = drive ? find(root?.c, path) : undefined; const name = path.split('/').pop()!;
        return drive && !node ? null : <Out key={path} href={node?.c || !drive ? folderUrl(`${folder}/${path}`) : fileUrl(`${folder}/${path}`, name, drive.publicKey)}>{node?.c ? <FolderOpen size={13}/> : <BookOpen size={13}/>}{bookTitle(name)}</Out>; })}
      {sites.map(([label, href]) => <Out key={href} href={href}>{label}</Out>)}
    </div>}
    {drive ? <div className="useful-sections">
      {sections.map(s => <Folder key={s.n} node={s} path={`${folder}/${s.n}`} drive={drive}/>)}
      {loose.length > 0 && <Folder node={{n:'Файлы в папке предмета', c:loose}} path={folder} drive={drive}/>}
    </div> : <p className="useful-empty">Загружаем список файлов…</p>}
    <div className="useful-links"><Out className="useful-primary" href={folderUrl(folder)}><FolderOpen size={14}/>Вся папка на диске</Out></div>
  </article>;
}
// Short names for the textbook buttons.
function bookTitle(name:string) {
  const t = pretty(name).replace(/^\[(Теория|Учебник|Задачник|Методички)\]\s*/, '$1: ').replace(/\s*\(Алгебра и аналитическая геометрия\)/, '').replace(/\s*\(Линейная алгебра и аналитическая геометрия\)/, '');
  return t.length > 46 ? t.slice(0, 44).replace(/[\s,.(-]+\S*$/, '') + '…' : t;
}

export function UsefulView({stream:streamTitle}:{stream:string}) {
  const own:Stream = /^1 /.test(streamTitle) ? '1' : /^[23] /.test(streamTitle) ? '2-3' : '1';
  const [term, setTerm] = useState<Term>(() => { const m = new Date().getMonth(); return m >= 1 && m <= 6 ? 2 : 1; });
  const [stream, setStream] = useState<Stream>(own);
  const [drive, setDrive] = useState<Drive | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(import.meta.env.BASE_URL + 'csdrive.json').then(r => r.ok ? r.json() : Promise.reject()).then(d => { if (live) setDrive(d); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  const subjects = SUBJECTS.filter(s => s.terms.includes(term));
  const t = TERMS[term];
  const info = drive?.folders['/Полезная информация'];
  const success = find(info, 'Как быть успешным студентом');
  return <section className="useful">
    <h1 className="session-title">Полезное</h1>
    <p className="term-sub">Первый курс · материалы CSDrive{drive ? `, список от ${new Date(drive.updatedAt).toLocaleDateString('ru-RU', {day:'numeric', month:'long'})}` : ''}</p>

    <div className="useful-hero useful-card">
      <div><b>CSDrive</b><p>Облачное хранилище учебных материалов, которое с 2011 года собирают студенты ВМК: книги, конспекты, варианты коллоквиумов и экзаменов.</p></div>
      <div className="useful-actions">
        <Out className="useful-primary" href={folderUrl('1 курс')}><FolderOpen size={16}/>Материалы 1 курса</Out>
        <Out href={DISK}>Весь диск</Out><Out href={TABLE}>Таблица CSDrive</Out>
      </div>
    </div>

    <div className="useful-filters">
      <div className="term-years" role="group" aria-label="Семестр">
        {([1, 2] as Term[]).map(n => <button key={n} aria-pressed={term===n} onClick={()=>setTerm(n)}>{n} семестр</button>)}
      </div>
      <div className="term-years" role="group" aria-label="Поток">
        {(['1', '2-3'] as Stream[]).map(s => <button key={s} aria-pressed={stream===s} onClick={()=>setStream(s)}>{s === '1' ? '1 поток' : '2–3 поток'}{s===own ? ' ·' : ''}</button>)}
      </div>
    </div>

    <h2 className="useful-h"><BookOpen size={18}/>Предметы {term} семестра</h2>
    {failed && <p className="useful-empty">Список файлов не загрузился — открой папки на диске по кнопкам.</p>}
    <div className="useful-list">
      {subjects.map(s => <SubjectCard key={s.name} subject={s} stream={stream} term={term} drive={drive} mine={stream===own}/>)}
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

    <h2 className="useful-h"><Sparkles size={18}/>Ещё полезное</h2>
    <div className="useful-list">
      <article className="useful-card"><header><b>Как учиться и сдавать</b></header><p>Памятка первокурсника, как сдать экзамен, список кафедр ВМК, как писать тексты и требования к диплому.</p>
        {success?.c && drive ? <div className="useful-sections"><FolderBody nodes={success.c} path="Полезная информация/Как быть успешным студентом" drive={drive} depth={0}/></div> : null}
        <div className="useful-links"><Out href={folderUrl('Полезная информация/Расписания прошлых лет')}>Расписания прошлых лет</Out><Out href={folderUrl('1 курс/Общая информация')}>Общая информация 1 курса</Out></div></article>
      <article className="useful-card"><header><b>МФК — межфакультетские курсы</b></header><p>По средам у большинства факультетов свободны 4-я и 5-я пары: можно слушать курс любого факультета МГУ. К концу 3-го курса нужны зачёты по двум МФК, лучше набрать их заранее. Запись — в личном кабинете, мест около 300 на курс, популярные разбирают быстро. Зачёт обычно за посещение и реферат или эссе.</p>
        <div className="useful-links"><Out href="https://lk.msu.ru/">lk.msu.ru</Out><Out href={folderUrl('МФК')}>Материалы МФК на диске</Out></div></article>
      <article className="useful-card"><header><b>Физкультура в секциях МГУ</b></header><p>Центральные секции занимаются по вечерам и дают зачёт вместо обычной физкультуры.</p>
        <div className="useful-links"><Out href="https://www.sportmsu.ru/sekcii">Список секций</Out></div></article>
      <article className="useful-card"><header><b>Бесплатно для студентов</b></header><p>С университетской почтой: GitHub Student Developer Pack, все IDE JetBrains, частичная или полная оплата курсов Coursera по запросу в поддержку.</p>
        <div className="useful-links"><Out href="https://education.github.com/pack">GitHub Student Pack</Out><Out href="https://www.jetbrains.com/student/">JetBrains</Out></div></article>
      <details className="useful-card useful-books"><summary><Library size={16}/>Книги, которые выдают в библиотеке</summary><ol>{BOOKS.map(b => <li key={b}>{b}</li>)}</ol></details>
    </div>

    <h2 className="useful-h"><Lock size={18}/>Закрытая часть диска</h2>
    <div className="useful-card"><p>SCSD — материалы только для 1–2 курсов, под паролем. Пароль CSDrive передаёт группам напрямую: спроси у старосты или в чате группы.</p>
      <div className="useful-links"><Out className="useful-primary" href="https://disk.yandex.ru/d/wZ0NoHzZeySMqw"><Lock size={14}/>Открыть SCSD</Out></div></div>

    <h2 className="useful-h"><MessageCircle size={18}/>CSDrive: связь и помощь</h2>
    <div className="useful-card"><p>Нашёл ошибку или хочешь добавить свои материалы — пришли файлы или папку в zip-архиве, можно стать администратором диска. Все мы учимся по материалам прошлых поколений.</p>
      <div className="useful-links"><Out href="https://vk.com/csdrive_msu">Паблик ВК</Out><Out href="https://vk.com/gim171263993">Написать в ВК</Out><Out href="https://t.me/csdrive_bot">Telegram-бот</Out><Out href="mailto:msu.cmc.materials@yandex.ru">msu.cmc.materials@yandex.ru</Out></div></div>

    <details className="useful-card useful-books"><summary>Другие архивы ВМК</summary>
      <div className="useful-links"><Out href="http://esyr.org/wiki/">esyr wiki</Out><Out href="http://cmcstuff.esyr.org/">cmcstuff</Out><Out href="http://tka4.org/materials/study/">tka4</Out><Out href="http://cmcmsu.no-ip.info/">Практикум на ЭВМ</Out></div></details>
  </section>;
}
