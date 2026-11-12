// Итоги партии: начисление наград, серия, событие, окна «решено» и «попытка закончилась».

import { t, formatTime, localName } from '../i18n.js';
import { el, openModal, toast, iconHtml } from '../ui.js';
import { flyTo, bump } from '../effects.js';
import { sfx } from '../audio.js';
import { catSvg } from '../cats.js';
import { catById, boardById } from '../content.js';
import { nextStreak, encodeScore, activeEvent } from '../daily.js';
import { openLeaderboard } from './dialogs.js';

const FEW_MISTAKES = 2;
const MS_IN_SECOND = 1000;

// Награда из таблицы [без ошибок, 1–2 ошибки, больше].
function pickReward(table, mistakes) {
  if (mistakes === 0) return table[0];
  return mistakes <= FEW_MISTAKES ? table[1] : table[2];
}

// Победа в уровне лестницы или свободной игры. session — описание партии.
export function recordLevelWin(app, game, session) {
  const save = app.store.get();
  const rewards = app.content.rewards;
  const mistakes = game.getMistakes();
  const isFree = session.mode === 'free';
  const table = isFree ? rewards.free[session.difficulty] || rewards.level : rewards.level;
  const reward = pickReward(table, mistakes);
  const progress = isFree
    ? { free: { ...save.free, [session.difficulty]: session.level + 1 } }
    : { level: Math.max(save.level, session.level + 1), tutorialDone: true };
  app.store.set({
    fish: save.fish + reward,
    levelsSinceAd: save.levelsSinceAd + 1,
    current: null,
    ...progress,
  });
  app.store.addStats({
    [isFree ? 'freeSolved' : 'levelsSolved']: 1,
    perfect: mistakes === 0 ? 1 : 0,
    catsSeated: game.getCats(),
    fishEarned: reward,
    playMs: game.getElapsed(),
  });
  app.store.flush();
  return { reward, mistakes, timeMs: game.getElapsed() };
}

// Прогресс события: за нужное число задач дня выдаются награды —
// наряд (reward) и, если указана, тема поля (rewardBoard).
function applyEvent(app, save, dateStr) {
  const none = { events: save.events, owned: save.owned, ownedBoards: save.ownedBoards, newCat: null, newBoard: null };
  const event = activeEvent(app.content.events, dateStr);
  if (!event) return none;
  const count = (save.events[event.id] || 0) + 1;
  const result = { ...none, events: { ...save.events, [event.id]: count } };
  if (count < event.goal) return result;
  const hasCat = app.content.cats.some((cat) => cat.id === event.reward);
  if (hasCat && !save.owned.includes(event.reward)) {
    result.owned = [...save.owned, event.reward];
    result.newCat = catById(event.reward);
  }
  const hasBoard = (app.content.boards || []).some((board) => board.id === event.rewardBoard);
  if (hasBoard && !save.ownedBoards.includes(event.rewardBoard)) {
    result.ownedBoards = [...save.ownedBoards, event.rewardBoard];
    result.newBoard = boardById(event.rewardBoard);
  }
  return result;
}

export function recordDailyWin(app, game, dateStr) {
  const save = app.store.get();
  const rewards = app.content.rewards;
  const isFirstTry = save.daily.attempts === 0;
  const streak = nextStreak(save.streak, dateStr);
  const bonus = Math.min(streak.count, rewards.streakBonusMax) * rewards.streakBonusPerDay;
  const reward = (isFirstTry ? rewards.daily : rewards.dailySecondTry) + bonus;
  const timeMs = game.getElapsed();
  const mistakes = game.getMistakes();
  const eventResult = applyEvent(app, save, dateStr);

  app.store.set({
    fish: save.fish + reward,
    streak,
    solvedDailies: save.solvedDailies + 1,
    events: eventResult.events,
    owned: eventResult.owned,
    ownedBoards: eventResult.ownedBoards,
    daily: { ...save.daily, date: dateStr, solved: true, failed: false, timeMs, mistakes, firstTry: isFirstTry },
    current: null,
  });
  app.store.addStats(
    { perfect: mistakes === 0 ? 1 : 0, catsSeated: game.getCats(), fishEarned: reward, playMs: timeMs },
    isFirstTry ? { bestDailyMs: timeMs } : {}
  );
  app.store.flush();
  // В таблицу идёт только первая попытка.
  if (isFirstTry) {
    app.platform.submitScore('daily', encodeScore(dateStr, timeMs / MS_IN_SECOND)).catch(() => {});
  }
  return { reward, mistakes, timeMs, streak: streak.count, isFirstTry, newCat: eventResult.newCat, newBoard: eventResult.newBoard };
}

export function recordDailyFail(app, dateStr) {
  const save = app.store.get();
  app.store.set({
    daily: { ...save.daily, date: dateStr, failed: true, attempts: save.daily.attempts + 1 },
    current: null,
  });
  app.store.flush();
}

const STAR_FIRST_S = 0.15;
const STAR_STEP_S = 0.28;
const STAR_SOUND_LAG_MS = 220;
const FISH_START_MS = 950;
const MAX_FLYING_FISH = 8;

// Оценка прохождения: без ошибок — 3 звезды, одна ошибка — 2, больше — 1. Только показ.
export function starsFor(mistakes) {
  if (mistakes === 0) return 3;
  return mistakes === 1 ? 2 : 1;
}

function starsRow(count) {
  const stars = [0, 1, 2].map((k) => {
    const node = el('span', { class: 'star ' + (k < count ? 'is-on' : 'is-off'), svg: iconHtml('star') });
    node.style.setProperty('--delay', STAR_FIRST_S + k * STAR_STEP_S + 's');
    return node;
  });
  for (let k = 0; k < count; k++) {
    window.setTimeout(() => sfx.star(k), (STAR_FIRST_S + k * STAR_STEP_S) * 1000 + STAR_SOUND_LAG_MS);
  }
  return el('div', { class: 'stars', title: String(count) }, stars);
}

// stars — 0, если оценку не показывать (задача дня).
function resultBody(app, lines, reward, stars = 0) {
  const cat = catById(app.store.get().equipped);
  return [
    stars > 0 ? starsRow(stars) : null,
    el('div', { class: 'result-cat', svg: catSvg(cat, { pose: 'full', happy: true, effects: true, animate: true }) }),
    ...lines.map((text) => el('p', { class: 'result-line', text })),
    reward > 0
      ? el('p', { class: 'result-reward' }, [el('span', { text: '+0' }), el('span', { class: 'ico', svg: iconHtml('fish') })])
      : null,
  ];
}

// Рыбки слетаются с поля к награде в окне, счёт «+N» растёт с каждой рыбкой.
function collectFish(reward) {
  const target = document.querySelector('.modal .result-reward');
  if (!target || reward <= 0) return;
  const counter = target.firstChild;
  const icon = target.lastChild;
  const count = Math.min(reward, MAX_FLYING_FISH);
  window.setTimeout(() => {
    flyTo(document.getElementById('board'), icon, iconHtml('fish'), count, (k) => {
      const shown = k === count - 1 ? reward : Math.round(((k + 1) * reward) / count);
      counter.textContent = '+' + shown;
      sfx.coin();
      bump(icon);
    });
  }, FISH_START_MS);
}

function mistakesLine(mistakes) {
  return mistakes === 0 ? t('win.clean') : t('win.mistakes', { n: mistakes });
}

// handlers: onNext, onHome.
export function showLevelWin(app, info, handlers) {
  openModal({
    title: t('win.title'),
    className: 'modal-win',
    body: resultBody(app, [mistakesLine(info.mistakes), t('win.time', { t: formatTime(info.timeMs) })], info.reward, starsFor(info.mistakes)),
    actions: [
      { label: t('win.next'), isPrimary: true, onClick: handlers.onNext },
      { label: t('win.home'), onClick: handlers.onHome },
    ],
  });
  collectFish(info.reward);
}

// handlers: onHome.
export function showDailyWin(app, info, dateStr, handlers) {
  const lines = [t('win.time', { t: formatTime(info.timeMs) }), mistakesLine(info.mistakes)];
  if (info.streak > 0) lines.push(t('win.streak', { n: info.streak }));
  openModal({
    title: t('win.title'),
    className: 'modal-win',
    body: resultBody(app, lines, info.reward),
    actions: [
      {
        label: t('win.table'),
        // После закрытия таблицы игрок возвращается к окну с итогом.
        onClick: () =>
          openLeaderboard(app, dateStr, () => showDailyWin(app, { ...info, reward: 0, newCat: null, newBoard: null }, dateStr, handlers)),
      },
      { label: t('win.home'), isPrimary: true, onClick: handlers.onHome },
    ],
  });
  collectFish(info.reward);
  if (info.newCat) toast(t('shop.newCat', { name: localName(info.newCat.name) }));
  else if (info.newBoard) toast(t('shop.newBoard', { name: localName(info.newBoard.name) }));
}

// Три ошибки в уровне. hasAds — есть ли реклама на площадке (без неё попытка
// даётся бесплатно). handlers: onContinue, onRestart, onHome.
export function showLevelFail(hasAds, handlers) {
  openModal({
    title: t('fail.title'),
    body: [el('p', { class: 'result-line', text: t('fail.levelText') })],
    actions: [
      {
        label: t(hasAds ? 'fail.continue' : 'fail.continueFree'),
        icon: hasAds ? 'video' : null,
        isPrimary: true,
        onClick: handlers.onContinue,
      },
      { label: t('fail.restart'), onClick: handlers.onRestart },
      { label: t('fail.home'), onClick: handlers.onHome },
    ],
  });
}

// handlers: onRetry, onHome.
export function showDailyFail(canRetry, hasAds, handlers) {
  const actions = [];
  if (canRetry) {
    actions.push({
      label: t(hasAds ? 'fail.retry' : 'fail.retryFree'),
      icon: hasAds ? 'video' : null,
      isPrimary: true,
      onClick: handlers.onRetry,
    });
  }
  actions.push({ label: t('fail.home'), isPrimary: !canRetry, onClick: handlers.onHome });
  openModal({
    title: t('fail.title'),
    body: [el('p', { class: 'result-line', text: canRetry ? t('fail.text') : t('fail.used') })],
    actions,
  });
}
