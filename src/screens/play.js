// Экран игры: запуск уровня, свободной игры или задачи дня, ввод, подсказки,
// реклама, итоги.
//
// Режимы (session.mode):
//   'level' — лестница уровней, сложность растёт сама;
//   'free'  — свободная игра, уровень выбранной сложности (session.difficulty);
//   'daily' — задача дня (session.date).

import { createGame, MARK } from '../game.js';
import { createBoardView } from '../board.js';
import { makeLevel, makeDaily, makeFree } from '../generator.js';
import { dailySpec, levelSpec, freeSpec } from '../difficulty.js';
import { t, formatTime } from '../i18n.js';
import { showScreen, toast, closeModal, isModalOpen, iconHtml } from '../ui.js';
import { sfx, setMuted } from '../audio.js';
import { catSvg } from '../cats.js';
import { voiceOf } from '../meow.js';
import { markShapeCss, resolveMark } from '../marks.js';
import { catById, boardById } from '../content.js';
import { visibleStreak } from '../daily.js';
import { burst } from '../effects.js';
import { mountScenery } from '../scenery.js';
import * as results from './results.js';

const TUTORIAL_LEVEL = 1;
const TIMER_TICK_MS = 500;
const CACHE_LIMIT = 6;
const MAX_DAILY_ATTEMPTS = 2;
const WIN_DELAY_MS = 1000;
const PREGEN_DELAY_MS = 400;
const PREPARE_DELAY_MS = 60;
const SLOW_BOARD_SIZE = 9;
const VIBRATE_MS = 12;
const CAT_SPARKS = 6;
// «Прятки»: над клеткой всплывает «Нашёл!» (по очереди три варианта) или «Мимо!».
const FOUND_KEYS = ['find.found1', 'find.found2', 'find.found3'];
const TAG_MS = 950;
const REASON_TEXT = { row: 'msg.row', col: 'msg.col', room: 'msg.room', near: 'msg.near', wrong: 'msg.wrong' };
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function byId(id) {
  return document.getElementById(id);
}

function pause(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function createPlayScreen(app) {
  const els = {
    screen: byId('screen-game'),
    title: byId('game-title'),
    lives: byId('game-lives'),
    timer: byId('game-timer'),
    coach: byId('coach'),
    wrap: byId('board-wrap'),
    board: byId('board'),
    undo: byId('btn-undo'),
    hint: byId('btn-hint'),
    hintBadge: byId('hint-badge'),
    modeSwitch: byId('mode-switch'),
    catsCount: byId('game-cats-count'),
    catsIco: byId('game-cats-ico'),
    modeCatIco: byId('mode-cat-ico'),
  };
  const boardCache = new Map();
  let session = null;
  let board = null;
  let game = null;
  let inputMode = 'cat';
  let isPainting = true;
  let timerId = 0;
  let isBusy = false;
  let foundCount = 0; // какой вариант «Нашёл!» показать следующим
  let theme = null;
  let catVoice = null; // голос выбранного котика для «мяу» (meow.js)
  let shownLives = -1; // сколько жизней-лапок было на экране (для «отлёта» потерянной)

  const view = createBoardView(els.board, { onTap, onLongPress, onDragStart, onDragOver, onDragEnd });

  function isActive() {
    return els.screen.classList.contains('is-active');
  }

  function byWeekday() {
    return app.content.daily.byWeekday;
  }

  function levelSession(level) {
    return { mode: 'level', id: 'L' + level, level };
  }

  function freeSession(difficulty, level) {
    return { mode: 'free', id: difficulty + ':' + level, difficulty, level };
  }

  function specOf(s) {
    if (s.mode === 'daily') return dailySpec(s.date, byWeekday());
    return s.mode === 'free' ? freeSpec(s.difficulty, s.level) : levelSpec(s.level);
  }

  // Поле для одного и того же уровня всегда одинаковое, поэтому готовые поля
  // держатся в памяти.
  function boardFor(s) {
    const key = s.mode + '|' + s.id;
    if (!boardCache.has(key)) {
      const built = s.mode === 'daily' ? makeDaily(s.date, specOf(s)) : s.mode === 'free' ? makeFree(s.difficulty, s.level) : makeLevel(s.level);
      boardCache.set(key, built);
      if (boardCache.size > CACHE_LIMIT) boardCache.delete(boardCache.keys().next().value);
    }
    return boardCache.get(key);
  }

  function isReady(s) {
    return boardCache.has(s.mode + '|' + s.id);
  }

  function nextSession(s) {
    return s.mode === 'free' ? freeSession(s.difficulty, s.level + 1) : levelSession(s.level + 1);
  }

  // Запуск партии. Большое поле строится заметное время, поэтому сначала
  // показывается сообщение «Готовим уровень…».
  async function launch(next) {
    if (isBusy) return;
    if (!isReady(next) && specOf(next).n >= SLOW_BOARD_SIZE) {
      isBusy = true;
      toast(t('preparing'));
      await pause(PREPARE_DELAY_MS);
      isBusy = false;
    }
    session = next;
    board = boardFor(next);
    start(true);
  }

  function open(params) {
    const save = app.store.get();
    if (params && params.mode === 'daily') {
      openDaily();
    } else if (params && params.mode === 'free') {
      launch(freeSession(params.difficulty, Math.max(1, Number(save.free[params.difficulty]) || 1)));
    } else {
      launch(levelSession(save.level));
    }
  }

  function openDaily() {
    const dateStr = app.today();
    let daily = app.store.get().daily;
    if (daily.date !== dateStr) {
      daily = { date: dateStr, attempts: 0, solved: false, failed: false, timeMs: 0, mistakes: 0, firstTry: false };
      app.store.set({ daily });
    }
    const dailySession = { mode: 'daily', id: dateStr, date: dateStr };
    if (daily.solved) {
      const save = app.store.get();
      const info = { reward: 0, mistakes: daily.mistakes, timeMs: daily.timeMs, streak: visibleStreak(save.streak, dateStr), newCat: null };
      results.showDailyWin(app, info, dateStr, { onHome: closeModal });
      return;
    }
    if (daily.failed) {
      session = dailySession;
      showDailyFail();
      return;
    }
    launch(dailySession);
  }

  function isTutorial() {
    return session.mode === 'level' && session.level === TUTORIAL_LEVEL && !app.store.get().tutorialDone;
  }

  // Сколько ошибок допускается: в обучении лимита нет.
  function mistakeLimit() {
    if (session.mode === 'daily') return app.content.daily.maxMistakes;
    return isTutorial() ? 0 : app.content.levels.maxMistakes;
  }

  // canResume — продолжить ли незаконченную партию из сохранения.
  function start(canResume) {
    const save = app.store.get();
    const current = save.current;
    const saved = canResume && current && current.mode === session.mode && current.id === session.id ? current : null;
    game = createGame(board, { maxMistakes: mistakeLimit(), autoMark: save.settings.autoMark, saved });
    theme = boardById(save.boardTheme);
    applyGameBackground(theme);
    view.setTheme(theme, save.markStyle);
    showMarkIcon(markShapeCss(resolveMark(save.markStyle, theme)));
    view.render(board);
    const cat = catById(save.equipped);
    view.setCat(catSvg(cat));
    catVoice = voiceOf(cat);
    // Мордочка выбранного котика — на кнопке «Кот» и в счётчике котов.
    els.modeCatIco.innerHTML = catSvg(cat);
    els.catsIco.innerHTML = catSvg(cat);
    shownLives = -1;
    setInputMode('cat');
    showScreen('game');
    layout();
    refresh();
    if (game.isFailed()) {
      fail();
      return;
    }
    game.resume();
    startTimer();
    app.platform.gameplayStart();
  }

  function layout() {
    if (isActive()) view.layout(els.wrap);
  }

  // Фон экрана игры из темы поля. Сам класс in-game ставит showScreen.
  function applyGameBackground(current) {
    const style = document.body.style;
    const bg = current && current.background ? current.background : null;
    const isOk = (value) => typeof value === 'string' && COLOR_RE.test(value);
    if (bg && isOk(bg.from) && isOk(bg.to)) {
      style.setProperty('--gbg1', bg.from);
      style.setProperty('--gbg2', bg.to);
    } else {
      style.removeProperty('--gbg1');
      style.removeProperty('--gbg2');
    }
    document.body.classList.toggle('game-dark', Boolean(bg && bg.dark));
    // Рисованный фон темы (пейзаж и частицы) — src/scenery.js.
    const scenery = document.getElementById('scenery');
    if (scenery) mountScenery(scenery, current);
  }

  // На кнопке «Пусто» — та же метка, что ставится на поле (точка — обычный значок).
  function showMarkIcon(shape) {
    const icon = els.modeSwitch.querySelector('[data-mode="mark"] .ico');
    if (!shape) {
      icon.innerHTML = iconHtml('dot');
      return;
    }
    const span = document.createElement('span');
    span.className = 'mark-ico';
    span.style.setProperty('--mark-shape', shape);
    icon.textContent = '';
    icon.append(span);
  }

  function setInputMode(mode) {
    inputMode = mode;
    els.modeSwitch.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('is-on', button.dataset.mode === mode);
    });
  }

  function titleText() {
    if (session.mode === 'daily') return t('game.daily');
    if (session.mode === 'free') return t('diff.' + session.difficulty) + ' · ' + session.level;
    return t('game.level', { n: session.level });
  }

  function refreshHud() {
    const save = app.store.get();
    const limit = game.maxMistakes;
    els.title.textContent = titleText();
    els.lives.hidden = limit <= 0;
    els.timer.hidden = session.mode !== 'daily';
    if (limit > 0) {
      const left = Math.min(limit, game.getLives());
      let paws = '';
      for (let k = 0; k < limit; k++) {
        const state = k < left ? '' : k === left && shownLives > left ? ' is-losing' : ' is-lost';
        paws += `<span class="ico paw${state}">${iconHtml('paw')}</span>`;
      }
      shownLives = left;
      els.lives.innerHTML = paws;
      els.lives.title = t('game.tries', { n: left });
    }
    if (session.mode === 'daily') els.timer.textContent = formatTime(game.getElapsed());
    els.hintBadge.hidden = save.hints <= 0 && !app.platform.canShowAds;
    if (save.hints > 0) els.hintBadge.textContent = String(save.hints);
    else els.hintBadge.innerHTML = iconHtml('video');
    els.undo.disabled = !game.canUndo();
    els.catsCount.textContent = game.getCats() + '/' + board.n;
  }

  function hintText(hint) {
    const n = board.n;
    if (hint.house < 0) return t('hint.any');
    if (hint.house < n) return t('hint.room');
    return hint.house < 2 * n ? t('hint.row') : t('hint.col');
  }

  // Обучение на первом уровне: мигает клетка, которую можно вывести, и объясняется почему.
  function refreshCoach() {
    const hint = isTutorial() ? game.peekHint() : null;
    if (!hint) {
      els.coach.hidden = true;
      view.setHint(-1);
      return;
    }
    view.setHint(hint.cell);
    els.coach.textContent = game.getCats() === 0 ? t('tut.start') : hintText(hint);
    const wasHidden = els.coach.hidden;
    els.coach.hidden = false;
    if (wasHidden) layout();
  }

  function refresh() {
    view.update(game.getCells());
    refreshHud();
    refreshCoach();
  }

  // Незаконченная партия сохраняется после каждого хода. Проигранный уровень
  // тоже: иначе третью ошибку можно было бы «отменить» перезагрузкой страницы.
  function persist() {
    if (!game || game.isWon()) return;
    if (session.mode === 'daily' && game.isFailed()) return;
    app.store.set({ current: { mode: session.mode, id: session.id, ...game.snapshot() } });
  }

  function afterMove() {
    refresh();
    persist();
  }

  function onTap(i) {
    if (!game || isBusy) return;
    if (inputMode === 'mark') {
      if (game.setMark(i)) {
        sfx.mark();
        afterMove();
      }
      return;
    }
    const result = game.tapCat(i);
    if (result.type === 'cat') {
      sfx.catSits(catVoice);
      afterMove();
      celebrateCat(i);
      if (result.isWon) win();
    } else if (result.type === 'wrong') {
      sfx.wrong();
      afterMove();
      view.flash(i, 'is-wrong');
      findTag(i, t('find.miss'), true);
      if (result.conflictCell >= 0) view.flash(result.conflictCell, 'is-conflict');
      toast(t(REASON_TEXT[result.reason] || 'msg.wrong'), 'paw');
      if (result.isFailed) fail();
    } else if (result.type === 'clear') {
      sfx.mark();
      afterMove();
    } else if (result.type === 'locked') {
      view.flash(i, 'is-locked');
    }
  }

  // Кот найден: выглядывает из клетки (CSS peek), комната вспыхивает, вокруг — искорки,
  // над клеткой — «Нашёл!».
  function celebrateCat(i) {
    view.flashMany(game.houseCells(board.regions[i]), 'is-room-done');
    burst('stars', view.cellCenter(i), { count: CAT_SPARKS });
    findTag(i, t(FOUND_KEYS[foundCount % FOUND_KEYS.length]));
    foundCount += 1;
  }

  // Короткая надпись над клеткой, всплывает и тает.
  function findTag(i, text, isMiss = false) {
    const c = view.cellCenter(i);
    if (!c) return;
    const tag = document.createElement('div');
    tag.className = 'find-tag' + (isMiss ? ' is-miss' : '');
    tag.textContent = text;
    tag.style.left = c.x + 'px';
    tag.style.top = c.y - c.size * 0.3 + 'px';
    document.body.append(tag);
    window.setTimeout(() => tag.remove(), TAG_MS);
  }

  function onLongPress(i) {
    if (!game || isBusy) return;
    if (!game.setMark(i)) return;
    sfx.mark();
    if (window.navigator.vibrate) window.navigator.vibrate(VIBRATE_MS);
    afterMove();
  }

  // Протяжка пальцем ставит (или стирает) отметки «пусто» во всех клетках по пути.
  function onDragStart(i, isAfterLongPress) {
    if (!game || isBusy) return;
    const isMarked = game.getCells()[i] === MARK;
    isPainting = isAfterLongPress ? isMarked : !isMarked;
    game.beginGroup();
    if (!isAfterLongPress && game.setMark(i, isPainting)) view.update(game.getCells());
  }

  function onDragOver(i) {
    if (!game || isBusy) return;
    if (game.setMark(i, isPainting)) {
      sfx.mark();
      view.update(game.getCells());
    }
  }

  function onDragEnd() {
    if (!game) return;
    game.endGroup();
    afterMove();
  }

  function startTimer() {
    stopTimer();
    timerId = window.setInterval(() => {
      if (game && session.mode === 'daily') els.timer.textContent = formatTime(game.getElapsed());
    }, TIMER_TICK_MS);
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = 0;
  }

  function stopRound() {
    game.pause();
    stopTimer();
    app.platform.gameplayStop();
    els.coach.hidden = true;
    view.setHint(-1);
  }

  function resumeRound() {
    game.resume();
    startTimer();
    app.platform.gameplayStart();
  }

  function win() {
    const finished = session;
    stopRound();
    view.setWon(true);
    sfx.win();
    burst(theme && theme.win, view.center());
    const isDaily = finished.mode === 'daily';
    const info = isDaily ? results.recordDailyWin(app, game, finished.date) : results.recordLevelWin(app, game, finished);
    isBusy = true;
    window.setTimeout(() => {
      isBusy = false;
      if (isDaily) {
        results.showDailyWin(app, info, finished.date, { onHome: goHome });
        return;
      }
      results.showLevelWin(app, info, { onNext: nextLevel, onHome: goHome });
      // Пока игрок читает итог, готовится следующее поле.
      window.setTimeout(() => boardFor(nextSession(finished)), PREGEN_DELAY_MS);
    }, WIN_DELAY_MS);
  }

  function fail() {
    stopRound();
    if (session.mode === 'daily') {
      results.recordDailyFail(app, session.date);
      showDailyFail();
      return;
    }
    persist();
    results.showLevelFail(app.platform.canShowAds, { onContinue: continueLevel, onRestart: restartLevel, onHome: goHome });
  }

  function showDailyFail() {
    const canRetry = app.store.get().daily.attempts < MAX_DAILY_ATTEMPTS;
    results.showDailyFail(canRetry, app.platform.canShowAds, { onRetry: retryDaily, onHome: goHome });
  }

  // Задача дня: вторая попытка за ролик, поле решается с начала.
  async function retryDaily() {
    if (isBusy) return;
    const isWatched = await watchRewarded();
    if (!isWatched) {
      toast(t('msg.noAd'));
      return;
    }
    closeModal();
    app.store.set({ daily: { ...app.store.get().daily, failed: false }, current: null });
    board = boardFor(session);
    start(false);
  }

  // Уровень: ещё одна ошибка за ролик, партия продолжается с того же места.
  async function continueLevel() {
    if (isBusy || !game) return;
    const isWatched = await watchRewarded();
    if (!isWatched) {
      toast(t('msg.noAd'));
      return;
    }
    closeModal();
    game.addLife();
    afterMove();
    resumeRound();
  }

  function restartLevel() {
    if (isBusy) return;
    closeModal();
    app.store.set({ current: null });
    start(false);
  }

  // Ролик за награду. На время рекламы время партии не идёт.
  // На площадке без рекламы (VK Play) награда даётся сразу.
  async function watchRewarded() {
    if (!app.platform.canShowAds) return true;
    isBusy = true;
    if (game) game.pause();
    const isWatched = await app.watchAd();
    isBusy = false;
    if (game && isActive() && !isModalOpen()) game.resume();
    return isWatched;
  }

  // Межстраничная реклама — не чаще раза в несколько уровней.
  async function maybeInterstitial() {
    if (!app.platform.canShowAds) return;
    if (app.store.get().levelsSinceAd < app.content.ads.interstitialEveryLevels) return;
    isBusy = true;
    setMuted(true);
    try {
      await app.platform.showInterstitial();
    } catch (err) {
      // Реклама не показалась — игра просто идёт дальше.
    } finally {
      setMuted(false);
      isBusy = false;
    }
    app.store.set({ levelsSinceAd: 0 });
  }

  async function nextLevel() {
    if (isBusy) return;
    const finished = session;
    closeModal();
    await maybeInterstitial();
    launch(nextSession(finished));
  }

  async function onHint() {
    if (!game || isBusy || game.isOver()) return;
    const save = app.store.get();
    if (save.hints > 0) {
      app.store.set({ hints: save.hints - 1 });
    } else {
      const isWatched = await watchRewarded();
      if (!isWatched) {
        toast(t('msg.noAd'));
        return;
      }
    }
    const hint = game.useHint();
    if (!hint) return;
    app.store.addStats({ hintsUsed: 1 });
    sfx.hint();
    afterMove();
    if (hint.house >= 0) view.flashMany(game.houseCells(hint.house), 'is-house');
    toast(hintText(hint), 'bulb');
    if (hint.isWon) win();
  }

  function onUndo() {
    if (!game || isBusy) return;
    if (game.undo()) {
      sfx.mark();
      afterMove();
    }
  }

  function goHome() {
    if (isBusy) return;
    if (game && !game.isOver()) {
      game.pause();
      persist();
    }
    stopTimer();
    app.platform.gameplayStop();
    closeModal();
    game = null;
    app.go('home');
  }

  function onHidden() {
    if (!game || !isActive() || game.isOver()) return;
    game.pause();
    persist();
  }

  function onVisible() {
    if (game && isActive() && !game.isOver() && !isBusy && !isModalOpen()) game.resume();
  }

  byId('btn-back').addEventListener('click', () => {
    sfx.tap();
    goHome();
  });
  els.undo.addEventListener('click', onUndo);
  els.hint.addEventListener('click', onHint);
  els.modeSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    sfx.tap();
    setInputMode(button.dataset.mode);
  });

  return { open, layout, onHidden, onVisible };
}
