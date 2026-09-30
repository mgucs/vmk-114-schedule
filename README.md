# Расписание ВМК

Расписание первого курса ВМК МГУ (все группы) и карта корпуса. Работает без интернета, ставится на экран «Домой».

**Сайт:** https://mgucs.github.io/vmk-114-schedule/

## Как обновляется расписание

- Каждые 15 минут GitHub Actions скачивает PDF с [cs.msu.ru/studies/schedule](https://cs.msu.ru/studies/schedule), разбирает пары всех групп и публикует их вместе с сайтом.
- Если ВМК что-то поменял, в приложении видно, что именно: аудиторию, преподавателя, время, даты — по всем группам, своя первой. Над днём висит баннер, отметки можно убрать.
- Каждый заменённый PDF сохраняется в `public/archive/`, в истории изменений на него есть ссылка.
- Телефон забирает новую версию при открытии сайта и хранит её для работы без сети.
- `watch.yml` запускает проверку `pages.yml` каждые 15 минут.

## Разработка

```sh
npm ci
npm run dev      # локальный запуск
npm run check    # TypeScript
npm test         # парсер, изменения, маршруты по карте
npm run build
```

Браузерные тесты (`tests/browser.mjs`) проверяют готовую сборку в Chromium через Playwright. Перед запуском соберите сайт с `VITE_BASE=/vmk-schedule/ npm run build`, затем:

```sh
PLAYWRIGHT_MODULE=<путь к playwright/index.mjs> BROWSER_CHANNEL=chromium node tests/browser.mjs
```

## Устройство

| Файл | Что делает |
| --- | --- |
| `scripts/sync-schedule.mjs`, `scripts/source-check.mjs` | проверка сайта ВМК, история изменений |
| `public/parser.mjs` | разбор PDF по границам ячеек |
| `app/page.tsx` | интерфейс расписания |
| `scripts/faculty.mjs` | чётность недель, объявления со страницы расписания, учебная часть 1 курса, сессия; прошлые сессии уходят в архив |
| `scripts/session-parser.mjs` | разбор PDF сессии: перечень экзаменов, таблицы экзаменов и зачётов |
| `scripts/sync-people.mjs` | карточки преподавателей из справочника cs.msu.ru (раз в неделю) |
| `scripts/archive-session.mjs` | добавить в архив прошлую сессию по сохранённой странице (например, из Wayback Machine) |
| `lib/term.mjs` | праздники, недели занятий, чётность (у ФИИТ верхняя запись клетки — нечётная неделя) |
| `components/session.tsx`, `components/term-calendar.tsx` | вкладки «Сессия» и «Календарь» |
| `lib/term-stats.mjs`, `components/term-stats.tsx` | «Сколько пар»: неделя или семестр, по предметам у группы и сравнение всех групп (только отличающиеся) |
| `components/teacher.tsx`, `components/onboarding.tsx` | карточка преподавателя, первый вход |
| `lib/search.mjs`, `components/search.tsx` | поиск по всем группам: преподаватель, предмет, аудитория, группа |
| `lib/calendar.mjs` | экспорт пар группы в `.ics` для календаря телефона |
| `app/globals.css` | цвета тем и стили оформления (`data-style`: журнал, минимал, лента, карточки, стекло) |
| `components/day-pager.tsx` | дни листаются пальцем: соседний день въезжает вслед за жестом |
| `app/glass.css` | изолированное оформление «Стекло», светлые/тёмные поверхности и доступные упрощённые эффекты |
| `components/wallpaper.tsx` | фон «Стекла»: локальная фотография МГУ под спокойной дымкой |
| `components/glass-optics.tsx` | преломление кромок панелей в Chromium; в Safari/Firefox — CSS-стекло |
| `components/campus-map.tsx`, `components/map-scene.ts` | карта корпуса (three.js) |
| `tools/build_map.py` | разметка кабинетов по планам этажей из `tools/floor-plans.pdf` |
| `tools/build-map-models.mjs` | объёмные модели этажей из разметки (см. `tools/map-models.md`) |

Пересобрать карту после правки разметки:

```sh
pip install pymupdf pillow numpy
python3 tools/build_map.py --check
```
