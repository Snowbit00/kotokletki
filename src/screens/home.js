// Домашний экран: рыбки, серия, кнопки режимов, событие.
// Котик отзывается на касание: «мяу» своим голосом, прыжок и сердечки (или искры).
// По фону медленно плывут облачка, лапки и рыбки.

import { t, formatTime, localName } from '../i18n.js';
import { showScreen, iconHtml } from '../ui.js';
import { catSvg } from '../cats.js';
import { catById } from '../content.js';
import { visibleStreak, activeEvent } from '../daily.js';
import { levelSpec } from '../difficulty.js';
import { voiceOf } from '../meow.js';
import { burst } from '../effects.js';
import { openHowto, openSettings, openDifficultyPicker, openStats } from './dialogs.js';
import { sfx } from '../audio.js';

const DECOR_COUNT = 12;
const CAT_TAP_PAUSE_MS = 800;
const CAT_HOP_MS = 650;
const CAT_BURST_COUNT = 10;
// Какие частицы выпускает котик: по его эффекту, по умолчанию сердечки.
const CAT_BURST = { sparkle: 'stars', glow: 'stars', snow: 'snow', hearts: 'hearts' };
const CLOUD_SVG =
  '<svg viewBox="0 0 60 30"><path d="M12 27a9 9 0 0 1 .8-18A12.5 12.5 0 0 1 36 6.6a10 10 0 0 1 16.4 8.6A6.2 6.2 0 0 1 50 27z" fill="#FFFFFF"/></svg>';
// Фон: вид, место по горизонтали и вертикали (%), размер (px), время проплыва (с).
const AMBIENT = [
  ['cloud', 6, 12, 120, 70],
  ['fish', 80, 22, 34, 46],
  ['paw', 14, 46, 26, 58],
  ['cloud', 62, 60, 90, 84],
  ['fish', 30, 78, 28, 52],
  ['paw', 88, 70, 22, 64],
  ['cloud', 40, 30, 70, 96],
  ['paw', 56, 90, 24, 60],
];
const THEME_KEY_RE = /^--[a-z0-9-]+$/;
const THEME_VALUE_RE = /^#[0-9a-fA-F]{3,8}$/;
const MAX_ATTEMPTS = 2;

function byId(id) {
  return document.getElementById(id);
}

// Тема события: цвета через CSS-переменные и падающий декор.
function applyEventTheme(event) {
  const rootStyle = document.documentElement.style;
  const applied = (document.documentElement.dataset.themeKeys || '').split(',').filter(Boolean);
  applied.forEach((key) => rootStyle.removeProperty(key));
  const keys = [];
  const theme = (event && event.theme) || {};
  for (const key of Object.keys(theme)) {
    if (!THEME_KEY_RE.test(key) || !THEME_VALUE_RE.test(String(theme[key]))) continue;
    rootStyle.setProperty(key, theme[key]);
    keys.push(key);
  }
  document.documentElement.dataset.themeKeys = keys.join(',');

  const decor = byId('decor');
  const symbol = event && typeof event.decor === 'string' ? event.decor : '';
  if (decor.dataset.symbol === symbol) return;
  decor.dataset.symbol = symbol;
  decor.textContent = '';
  if (!symbol) return;
  for (let i = 0; i < DECOR_COUNT; i++) {
    const item = document.createElement('span');
    item.textContent = symbol;
    item.style.left = ((i * 97) % 100) + '%';
    item.style.animationDuration = 7 + (i % 5) * 1.7 + 's';
    item.style.animationDelay = -(i * 1.3) + 's';
    item.style.fontSize = 18 + (i % 4) * 6 + 'px';
    decor.append(item);
  }
}

function dailyStatus(daily, today) {
  if (daily.date !== today) return t('home.dailyNew');
  if (daily.solved) return daily.firstTry ? t('home.dailyDone', { t: formatTime(daily.timeMs) }) : t('home.dailyDoneLate');
  if (daily.failed) return daily.attempts < MAX_ATTEMPTS ? t('home.dailyRetry') : t('home.dailyFailed');
  return t('home.dailyNew');
}

function eventText(event, save) {
  if (!event) return '';
  const name = localName(event.name);
  if ((save.events[event.id] || 0) >= event.goal) return t('event.done', { name });
  const solved = Math.min(event.goal, save.events[event.id] || 0);
  return t('event.progress', { name, n: solved, m: event.goal });
}

// Фоновые облачка, лапки и рыбки (один раз при запуске).
function mountAmbient() {
  const layer = byId('ambient');
  if (!layer || layer.childElementCount) return;
  AMBIENT.forEach(([kind, x, y, size, seconds], k) => {
    const item = document.createElement('span');
    item.className = 'amb amb-' + kind;
    item.innerHTML = kind === 'cloud' ? CLOUD_SVG : iconHtml(kind);
    item.style.left = x + '%';
    item.style.top = y + '%';
    item.style.width = size + 'px';
    item.style.height = (kind === 'cloud' ? size / 2 : size) + 'px';
    item.style.animationDuration = seconds + 's, ' + (5 + (k % 3)) + 's';
    item.style.animationDelay = -(k * 7) + 's, ' + -(k * 0.9) + 's';
    layer.append(item);
  });
}

export function createHomeScreen(app) {
  let lastCatTap = 0;

  function refresh() {
    const save = app.store.get();
    const today = app.today();
    const event = activeEvent(app.content.events, today);

    byId('fish-count').textContent = String(save.fish);
    byId('streak-count').textContent = String(visibleStreak(save.streak, today));
    byId('home-streak').title = t('home.streak', { n: visibleStreak(save.streak, today) });
    byId('btn-stats').title = t('stats.title');
    byId('level-label').textContent = t('home.level', { n: save.level });
    const size = levelSpec(save.level).n;
    byId('level-note').textContent = t('home.levelNote', { n: size });
    byId('daily-ico').innerHTML = iconHtml('calendar', { day: Number(today.slice(8)) });
    byId('daily-status').textContent = dailyStatus(save.daily, today);
    byId('btn-daily').classList.toggle('is-done', save.daily.date === today && save.daily.solved);
    byId('home-cat').innerHTML = catSvg(catById(save.equipped), { pose: 'full', effects: true, animate: true });

    const banner = byId('event-banner');
    banner.textContent = eventText(event, save);
    banner.hidden = !event;
    applyEventTheme(event);
  }

  function show() {
    refresh();
    showScreen('home');
  }

  // Котик: «мяу», прыжок, сердечки. Частые касания не наслаиваются.
  function petCat() {
    const now = Date.now();
    if (now - lastCatTap < CAT_TAP_PAUSE_MS) return;
    lastCatTap = now;
    const cat = catById(app.store.get().equipped);
    sfx.meow(voiceOf(cat));
    const node = byId('home-cat');
    node.classList.remove('is-hop');
    void node.offsetWidth;
    node.classList.add('is-hop');
    window.setTimeout(() => node.classList.remove('is-hop'), CAT_HOP_MS);
    const rect = node.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.35, size: rect.width * 0.6 };
    burst(CAT_BURST[cat.effect] || 'hearts', origin, { count: CAT_BURST_COUNT });
  }

  mountAmbient();
  byId('home-cat').addEventListener('click', petCat);
  byId('home-cat').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') petCat();
  });
  byId('btn-level').addEventListener('click', () => {
    sfx.tap();
    app.go('play', { mode: 'level' });
  });
  byId('btn-daily').addEventListener('click', () => {
    sfx.tap();
    app.go('play', { mode: 'daily' });
  });
  byId('btn-free').addEventListener('click', () => {
    sfx.tap();
    openDifficultyPicker(app, (difficulty) => app.go('play', { mode: 'free', difficulty }));
  });
  byId('btn-shop').addEventListener('click', () => {
    sfx.tap();
    app.go('shop');
  });
  byId('btn-howto').addEventListener('click', () => {
    sfx.tap();
    openHowto();
  });
  byId('btn-stats').addEventListener('click', () => {
    sfx.tap();
    openStats(app);
  });
  byId('btn-settings').addEventListener('click', () => {
    sfx.tap();
    openSettings(app, refresh);
  });

  return { show, refresh };
}
