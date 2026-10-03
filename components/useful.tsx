import {useState, type ReactNode} from 'react';
import {ArrowUpRight, BookOpen, FolderOpen, GraduationCap, Library, Lock, MessageCircle, Sparkles} from 'lucide-react';

// «Полезное» for the first course, from CSDrive — the students' archive of study materials of ВМК
// (table: goo.gl/YyE6jP, folder: disk.yandex.ru/d/uBxTJDaahuSjZA). The texts about credits and exams are its
// first-course notes, retold; terms and rules change, so they are given as experience of past years.
const DISK = 'https://disk.yandex.ru/d/uBxTJDaahuSjZA';
const folder = (path:string) => `${DISK}/${path.split('/').map(encodeURIComponent).join('/')}`;
const TABLE = 'https://docs.google.com/spreadsheets/d/1jPWpbivxCf3xRv-jAueWEF-XmPo1I3kLS2o6UyDBDMU/edit';

type Link = [label:string, href:string];
type Subject = {name:string; when:string; streams?:string[]; folder:string; inside:string; links:Link[]};
const SUBJECTS:Subject[] = [
  {name:'Математический анализ', when:'1–2 семестр', folder:'1 курс/Математический анализ',
    inside:'Методички Садовничей и Хорошиловой, конспект лекций, варианты контрольных и зачёта, вопросы к коллоквиуму, подготовка к экзамену',
    links:[['Демидович — задачник', 'https://clck.ru/SbkE7'], ['Ильин, Садовничий, Сендов — учебник', 'https://clck.ru/SbkL5']]},
  {name:'Алгебра и геометрия', when:'1–2 семестр', folder:'1 курс/Алгебра и геометрия (Линал)',
    inside:'Ильин и Позняк, Тыртышников, конспекты семинаров Руднева, «МиниКим», задачи с решениями, подготовка к коллоквиуму и экзамену',
    links:[['Ким — учебник', 'https://clck.ru/RBmQN'], ['Ким — задачник, том 1', 'https://clck.ru/RBmRu'], ['Ким — задачник, том 2', 'https://clck.ru/RBmTK']]},
  {name:'Алгоритмы и алгоритмические языки', when:'1 семестр', streams:['1 поток'], folder:'1 курс/[1 поток, 1 сем.] Алгоритмы и АЯ',
    inside:'Язык Си: Керниган и Ритчи, слайды лекций Белеванцева, семинары, варианты коллоквиумов и экзамена',
    links:[['Сайт курса', 'http://algcourse.cs.msu.ru/']]},
  {name:'Алгоритмы и алгоритмические языки', when:'1 семестр', streams:['2 поток', '3 поток'], folder:'1 курс/[2-3 поток, 1 сем.] Алгоритмы и АЯ',
    inside:'Паскаль: Пильщиков, Абрамов и Трифонов, задания практикума, методичка к письменному экзамену, варианты экзамена', links:[]},
  {name:'Архитектура ЭВМ и ассемблер', when:'2 семестр', streams:['1 поток'], folder:'1 курс/[1 поток, 2 сем.] Архитектура ЭВМ и АСМ',
    inside:'NASM, Брайант и О’Халларон, семинары Кузьменковой, справочник команд, варианты коллоквиумов и экзамена',
    links:[['Сайт курса', 'http://asmcourse.cs.msu.ru/'], ['Справочник команд', 'http://asmworld.ru/spravochnik-komand/']]},
  {name:'Архитектура ЭВМ и ассемблер', when:'2 семестр', streams:['2 поток', '3 поток'], folder:'1 курс/[2-3 поток, 2 сем.] Архитектуры ЭВМ и АСМ',
    inside:'MASM: Пильщиков, Баула, учебные машины, вопросы и варианты экзамена', links:[]},
  {name:'Дискретная математика', when:'2 семестр', folder:'1 курс/Дискретная математика (2 семестр)',
    inside:'Лекции Алексеева, Яблонский, Вороненко, конспекты, вопросы к экзамену и теормин',
    links:[['Гаврилов — задачник', 'https://clck.ru/RFftE'], ['Сайт курса и билеты', 'https://clck.ru/NxYP2']]},
  {name:'Английский, история, БЖД, русский язык', when:'1–2 семестр', folder:'1 курс/Гуманитарий',
    inside:'Destination, грамматика Дроздовой, English Reader in Computer Science, материалы по истории, БЖД, русскому языку и библиографии', links:[]},
];

type Course = {name:string; text:string};
const TERMS:Record<'1'|'2', {credits:string[]; exams:string[]; creditDates:string; examDates:string; notes:Course[]}> = {
  '1':{credits:['Практикум на ЭВМ', 'Алгебра и геометрия', 'Матанализ', 'Библиография', 'БЖД', 'Английский', 'Физкультура'],
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
  '2':{credits:['Практикум на ЭВМ', 'Алгебра и геометрия', 'Матанализ', 'Английский', 'Физкультура'],
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

const Out = ({href, children, className}:{href:string; children:ReactNode; className?:string}) =>
  <a className={className} href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a>;

export function UsefulView({stream}:{stream:string}) {
  const [term, setTerm] = useState<'1'|'2'>(() => { const m = new Date().getMonth(); return m >= 1 && m <= 6 ? '2' : '1'; });
  // Materials of the user's stream first; subjects of the other streams follow, marked with theirs.
  const subjects = [...SUBJECTS].sort((a, b) => Number(!!b.streams?.includes(stream)) - Number(!!a.streams?.includes(stream)) || Number(!!a.streams && !a.streams.includes(stream)) - Number(!!b.streams && !b.streams.includes(stream)));
  const t = TERMS[term];
  return <section className="useful">
    <h1 className="session-title">Полезное</h1>
    <p className="term-sub">Для первого курса · по материалам CSDrive</p>

    <div className="useful-hero useful-card">
      <div><b>CSDrive</b><p>Облачное хранилище учебных материалов, которое с 2011 года собирают студенты ВМК: книги, конспекты, варианты коллоквиумов и экзаменов.</p></div>
      <div className="useful-actions">
        <Out className="useful-primary" href={folder('1 курс')}><FolderOpen size={16}/>Материалы 1 курса</Out>
        <Out href={DISK}>Весь диск</Out><Out href={TABLE}>Таблица CSDrive</Out>
      </div>
    </div>

    <h2 className="useful-h"><BookOpen size={18}/>По предметам</h2>
    <div className="useful-list">
      {subjects.map(s => {
        const mine = !s.streams || s.streams.includes(stream);
        return <article className={`useful-card subject ${mine ? '' : 'other'}`} key={s.folder}>
          <header><b>{s.name}</b><span>{s.when}{s.streams ? ` · ${s.streams.join(', ')}` : ''}{s.streams && s.streams.includes(stream) ? ' · твой поток' : ''}</span></header>
          <p>{s.inside}</p>
          <div className="useful-links"><Out className="useful-primary" href={folder(s.folder)}><FolderOpen size={14}/>Папка</Out>{s.links.map(([label, href]) => <Out key={href} href={href}>{label}</Out>)}</div>
        </article>;
      })}
    </div>

    <h2 className="useful-h"><GraduationCap size={18}/>Как сдать сессию</h2>
    <div className="term-years useful-terms" role="group" aria-label="Семестр">
      <button aria-pressed={term==='1'} onClick={()=>setTerm('1')}>1 семестр</button><button aria-pressed={term==='2'} onClick={()=>setTerm('2')}>2 семестр</button>
    </div>
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
      <article className="useful-card"><header><b>Как учиться и сдавать</b></header><p>Памятка первокурсника, «Как сдать экзамен», список кафедр ВМК, требования к диплому.</p>
        <div className="useful-links"><Out className="useful-primary" href={folder('Полезная информация/Как быть успешным студентом')}><FolderOpen size={14}/>Папка</Out><Out href={folder('Полезная информация/Расписания прошлых лет')}>Расписания прошлых лет</Out></div></article>
      <article className="useful-card"><header><b>МФК — межфакультетские курсы</b></header><p>По средам у большинства факультетов свободны 4-я и 5-я пары: можно слушать курс любого факультета МГУ. К концу 3-го курса нужны зачёты по двум МФК, лучше набрать их заранее. Запись — в личном кабинете, мест около 300 на курс, популярные разбирают быстро. Зачёт обычно за посещение и реферат или эссе.</p>
        <div className="useful-links"><Out href="https://lk.msu.ru/">lk.msu.ru</Out></div></article>
      <article className="useful-card"><header><b>Физкультура в секциях МГУ</b></header><p>Центральные секции занимаются по вечерам и дают зачёт вместо обычной физкультуры.</p>
        <div className="useful-links"><Out href="https://www.sportmsu.ru/sekcii">Список секций</Out></div></article>
      <article className="useful-card"><header><b>Бесплатно для студентов</b></header><p>С университетской почтой: GitHub Student Developer Pack, все IDE JetBrains, частичная или полная оплата курсов Coursera по запросу в поддержку.</p>
        <div className="useful-links"><Out href="https://education.github.com/pack">GitHub Student Pack</Out><Out href="https://www.jetbrains.com/student/">JetBrains</Out></div></article>
      <details className="useful-card useful-books"><summary><Library size={16}/>Книги, которые выдают в библиотеке</summary><ol>{BOOKS.map(b => <li key={b}>{b}</li>)}</ol></details>
    </div>

    <h2 className="useful-h"><Lock size={18}/>Закрытая часть диска</h2>
    <div className="useful-card"><p>SCSD — материалы только для 1–2 курсов. Пароль CSDrive передаёт группам напрямую: спроси у старосты или в чате группы.</p>
      <div className="useful-links"><Out className="useful-primary" href="https://disk.yandex.ru/d/wZ0NoHzZeySMqw"><Lock size={14}/>Открыть SCSD</Out></div></div>

    <h2 className="useful-h"><MessageCircle size={18}/>CSDrive: связь и помощь</h2>
    <div className="useful-card"><p>Нашёл ошибку или хочешь добавить свои материалы — пришли файлы или папку в zip-архиве, можно стать администратором диска. Все мы учимся по материалам прошлых поколений.</p>
      <div className="useful-links"><Out href="https://vk.com/csdrive_msu">Паблик ВК</Out><Out href="https://vk.com/gim171263993">Написать в ВК</Out><Out href="https://t.me/csdrive_bot">Telegram-бот</Out><Out href="mailto:msu.cmc.materials@yandex.ru">msu.cmc.materials@yandex.ru</Out></div></div>

    <details className="useful-card useful-books"><summary>Другие архивы ВМК</summary>
      <div className="useful-links"><Out href="http://esyr.org/wiki/">esyr wiki</Out><Out href="http://cmcstuff.esyr.org/">cmcstuff</Out><Out href="http://tka4.org/materials/study/">tka4</Out><Out href="http://cmcmsu.no-ip.info/">Практикум на ЭВМ</Out></div></details>
  </section>;
}
