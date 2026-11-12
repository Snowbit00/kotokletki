// Окна: «Как играть», выбор сложности, настройки, таблица дня.

import { t, formatTime, getLang, setLang, applyTexts } from '../i18n.js';
import { el, openModal, closeModal, iconHtml } from '../ui.js';
import { setSoundEnabled, setMeowEnabled, sfx } from '../audio.js';
import { voiceOf } from '../meow.js';
import { catById } from '../content.js';
import { catSvg } from '../cats.js';
import { dayIndex, decodeScore, visibleStreak } from '../daily.js';
import { DIFFICULTIES } from '../difficulty.js';

const HOWTO_RULES = ['howto.r1', 'howto.r2', 'howto.r3', 'howto.r4', 'howto.r5'];
const TABLE_ROWS = 10;
const MS_IN_SECOND = 1000;
// Цвет сложности (от зелёного к фиолетовому) и цвета клеток значка поля.
const DIFF_COLORS = ['#7BD389', '#5EC8C0', '#F5B041', '#F0736B', '#B48CF2'];
const DIFF_CELLS = [
  ['#D7F2D0', '#BDE8B4', '#E6F7E1', '#A9DDA0'],
  ['#CFF1EE', '#A9E3DE', '#E2F7F5', '#8FD6CF'],
  ['#FFE7B8', '#FBD38A', '#FFF1D4', '#F5BD5C'],
  ['#FBD0CC', '#F5A9A2', '#FDE3E0', '#EE8B83'],
  ['#E7DAFB', '#D2BEF5', '#F1EAFD', '#BEA2EF'],
];

export function openHowto() {
  const list = el(
    'ol',
    { class: 'rules' },
    HOWTO_RULES.map((key) => el('li', { text: t(key) }))
  );
  openModal({
    title: t('howto.title'),
    body: [list],
    actions: [{ label: t('howto.ok'), isPrimary: true, onClick: closeModal }],
    onDismiss: closeModal,
  });
}

// Выбор сложности свободной игры. onPick(id) вызывается после выбора.
export function openDifficultyPicker(app, onPick) {
  const free = app.store.get().free;
  const buttons = DIFFICULTIES.map((difficulty, index) => {
    const level = Math.max(1, Number(free[difficulty.id]) || 1);
    const sizes = difficulty.sizes.map((n) => n + '×' + n).join(', ');
    const stars = el(
      'span',
      { class: 'diff-stars', title: String(index + 1) },
      Array.from({ length: index + 1 }, () => el('span', { class: 'ico', svg: iconHtml('star') }))
    );
    const button = el(
      'button',
      {
        class: 'btn diff-btn',
        type: 'button',
        onClick: () => {
          closeModal();
          onPick(difficulty.id);
        },
      },
      [
        el('span', { class: 'btn-ico', svg: iconHtml('grid', { colors: DIFF_CELLS[index % DIFF_CELLS.length] }) }),
        el('span', { class: 'diff-text' }, [
          el('span', { class: 'diff-name', text: t('diff.' + difficulty.id) }),
          el('small', { text: sizes + ' · ' + t('diff.level', { n: level }) }),
        ]),
        stars,
      ]
    );
    button.style.setProperty('--dc', DIFF_COLORS[index % DIFF_COLORS.length]);
    return button;
  });
  openModal({
    title: t('diff.title'),
    body: [el('div', { class: 'diff-list' }, buttons)],
    onDismiss: closeModal,
  });
}

// Строка настройки с переключателем-«таблеткой» (бегунок вправо — включено).
function toggleRow(label, isOn, onToggle) {
  const button = el('button', {
    class: 'switch' + (isOn ? ' is-on' : ''),
    type: 'button',
    role: 'switch',
    'aria-checked': String(isOn),
    'aria-label': label,
    title: isOn ? t('on') : t('off'),
  });
  button.addEventListener('click', () => {
    const next = !button.classList.contains('is-on');
    button.classList.toggle('is-on', next);
    button.setAttribute('aria-checked', String(next));
    button.title = next ? t('on') : t('off');
    onToggle(next);
  });
  return el('div', { class: 'setting-row' }, [el('span', { text: label }), button]);
}

// onChange вызывается после любой смены настройки (нужно перерисовать экран).
export function openSettings(app, onChange) {
  const settings = app.store.get().settings;
  const patch = (part) => {
    app.store.set({ settings: { ...app.store.get().settings, ...part } });
    onChange();
  };

  const langButton = el('button', { class: 'toggle is-on', type: 'button', text: getLang() === 'ru' ? 'Русский' : 'English' });
  langButton.addEventListener('click', () => {
    const next = getLang() === 'ru' ? 'en' : 'ru';
    setLang(next, app.content.texts);
    applyTexts(document);
    document.title = t('title');
    patch({ lang: next });
    closeModal();
    openSettings(app, onChange);
  });

  openModal({
    title: t('settings.title'),
    body: [
      toggleRow(t('settings.sound'), settings.sound, (value) => {
        setSoundEnabled(value);
        patch({ sound: value });
        sfx.tap();
      }),
      toggleRow(t('settings.meow'), settings.meow !== false, (value) => {
        setMeowEnabled(value);
        patch({ meow: value });
        if (value) sfx.meow(voiceOf(catById(app.store.get().equipped)));
        else sfx.tap();
      }),
      toggleRow(t('settings.autoMark'), settings.autoMark, (value) => patch({ autoMark: value })),
      el('div', { class: 'setting-row' }, [el('span', { text: t('settings.lang') }), langButton]),
    ],
    actions: [{ label: t('settings.close'), isPrimary: true, onClick: closeModal }],
    onDismiss: closeModal,
  });
}

function tableRow(rank, name, seconds, isPlayer) {
  return el('li', { class: 'table-row' + (isPlayer ? ' is-me' : '') }, [
    el('span', { class: 'table-rank', text: String(rank) }),
    el('span', { class: 'table-name', text: name }),
    el('span', { class: 'table-time', text: formatTime(seconds * MS_IN_SECOND) }),
  ]);
}

// Таблица дня: только результаты за дату dateStr, лучшие сверху.
// onClose — что показать после закрытия (по умолчанию окно просто закрывается).
export async function openLeaderboard(app, dateStr, onClose) {
  const close = onClose || closeModal;
  const body = el('div', { class: 'table-box' }, [el('p', { text: t('loading') })]);
  openModal({
    title: t('lb.title'),
    body: [body],
    actions: [{ label: t('lb.close'), isPrimary: true, onClick: close }],
    onDismiss: close,
  });

  let entries = null;
  try {
    entries = await app.platform.getLeaderboard('daily');
  } catch (err) {
    entries = null;
  }

  const today = dayIndex(dateStr);
  const rows = (entries || [])
    .map((entry) => ({ ...entry, ...decodeScore(entry.score) }))
    .filter((entry) => entry.day === today)
    .slice(0, TABLE_ROWS)
    .map((entry, index) => tableRow(index + 1, entry.isPlayer ? t('lb.you') : entry.name, entry.seconds, entry.isPlayer));

  body.textContent = '';
  if (rows.length) {
    body.append(el('ol', { class: 'table' }, rows));
    return;
  }
  const daily = app.store.get().daily;
  if (daily.date === dateStr && daily.solved && daily.firstTry) {
    body.append(el('ol', { class: 'table' }, [tableRow(1, t('lb.you'), Math.floor(daily.timeMs / MS_IN_SECOND), true)]));
    if (entries === null && app.platform.name === 'yandex') body.append(el('p', { class: 'note', text: t('lb.auth') }));
    return;
  }
  const isLateSolve = daily.date === dateStr && daily.solved && !daily.firstTry;
  body.append(el('p', { text: isLateSolve ? t('lb.secondTry') : t('lb.empty') }));
}

const MS_IN_MINUTE = 60000;
const MINUTES_IN_HOUR = 60;

// Время в игре: «12 мин» или «3 ч 05 мин».
function playTime(ms) {
  const minutes = Math.floor(ms / MS_IN_MINUTE);
  if (minutes < MINUTES_IN_HOUR) return t('stats.minutes', { m: minutes });
  return t('stats.hours', { h: Math.floor(minutes / MINUTES_IN_HOUR), m: String(minutes % MINUTES_IN_HOUR).padStart(2, '0') });
}

// Сколько товаров раздела у игрока: купленные и бесплатные (их не нужно «брать»).
function collected(list, owned) {
  const items = list || [];
  const isFree = (item) => !item.event && !(Number(item.price) > 0) && !(Number(item.ads) > 0);
  return items.filter((item) => owned.includes(item.id) || isFree(item)).length + '/' + items.length;
}

// icon — имя значка или готовая SVG-разметка (мордочка котика).
function statTile(icon, value, label) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'ico', svg: icon.startsWith('<') ? icon : iconHtml(icon) }),
    el('span', { class: 'stat-text' }, [el('b', { text: String(value) }), el('small', { text: label })]),
  ]);
}

// Статистика игрока. Своя у каждого аккаунта: хранится в его сохранении (storage.js).
export function openStats(app) {
  const save = app.store.get();
  const stats = save.stats;
  const content = app.content;
  const streakNow = visibleStreak(save.streak, app.today());
  const tiles = [
    ['star', save.level, t('stats.level')],
    ['grid', stats.levelsSolved, t('stats.levels')],
    ['dice', stats.freeSolved, t('stats.free')],
    ['calendar', save.solvedDailies, t('stats.dailies')],
    ['flame', streakNow + ' · ' + (save.streak.best || 0), t('stats.streak')],
    ['trophy', stats.bestDailyMs > 0 ? formatTime(stats.bestDailyMs) : '—', t('stats.bestDaily')],
    ['heart', stats.perfect, t('stats.perfect')],
    [catSvg(catById(save.equipped)), stats.catsSeated, t('stats.cats')],
    ['bulb', stats.hintsUsed, t('stats.hints')],
    ['fish', stats.fishEarned, t('stats.fish')],
    ['bag', collected(content.cats, save.owned), t('stats.collCats')],
    ['grid', collected(content.boards, save.ownedBoards), t('stats.collBoards')],
    ['paw', collected(content.marks, save.ownedMarks), t('stats.collMarks')],
    ['clock', playTime(stats.playMs), t('stats.time')],
  ];
  openModal({
    title: t('stats.title'),
    className: 'modal-stats',
    body: [
      el('div', { class: 'stats-grid' }, tiles.map(([icon, value, label]) => statTile(icon, value, label))),
      el('p', { class: 'note', text: t('stats.note') }),
    ],
    actions: [{ label: t('stats.close'), isPrimary: true, onClick: closeModal }],
    onDismiss: closeModal,
  });
}
