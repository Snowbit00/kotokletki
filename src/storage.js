// Сохранения: облако площадки + localStorage как запасной вариант.
// Состояние не изменяется на месте: store.set() собирает новый объект.
//
// У каждого игрока своё сохранение. В облаке Яндекса и VK оно и так своё у аккаунта,
// а копия на устройстве хранится под ключом с номером игрока (platform.playerId()):
// если в одном браузере играют двое под разными аккаунтами, прогресс не смешивается.
// В самом сохранении записан номер владельца (owner) — чужая копия не подхватывается.
//
// Старое общее сохранение (ключ LEGACY_KEY, до разделения) переносится один раз и
// только там, где облака нет (VK Play, локально): на Яндексе и в VK прогресс и так
// лежит в облаке аккаунта, а общая копия могла принадлежать другому игроку.

const LEGACY_KEY = 'kotokletki.save';
const LOCAL_PREFIX = 'kotokletki.save.';
const ADOPTED_KEY = 'kotokletki.legacyAdoptedBy';
const GUEST_ID = 'guest';
const ID_SAFE_RE = /[^A-Za-z0-9_-]/g;
const ID_MAX_LENGTH = 64;
const SAVE_VERSION = 1;
// Облако площадки ограничивает частоту записи (Яндекс: 100 запросов за 5 минут),
// поэтому изменения копятся и уходят не чаще раза в 5 секунд.
const CLOUD_DELAY_MS = 5000;
const FIRST_CAT = 'ginger';
const FIRST_BOARD = 'pastel';
// Метка «как у поля»: своей формы нет, берётся отметка выбранной темы.
const FIRST_MARK = 'theme';

export function defaultSave(startHints) {
  return {
    v: SAVE_VERSION,
    updatedAt: 0,
    level: 1,
    free: {},
    fish: 0,
    hints: startHints,
    owned: [FIRST_CAT],
    equipped: FIRST_CAT,
    ownedBoards: [FIRST_BOARD],
    boardTheme: FIRST_BOARD,
    ownedMarks: [FIRST_MARK],
    markStyle: FIRST_MARK,
    adProgress: {}, // «cat:id», «board:id» или «mark:id» → сколько роликов уже просмотрено
    streak: { count: 0, last: '', best: 0 },
    daily: { date: '', attempts: 0, solved: false, failed: false, timeMs: 0, mistakes: 0, firstTry: false },
    solvedDailies: 0,
    events: {},
    settings: { lang: '', sound: true, meow: true, autoMark: true },
    tutorialDone: false,
    levelsSinceAd: 0,
    current: null,
    owner: '',
    stats: defaultStats(),
  };
}

// Статистика игрока (экран «Статистика»).
export function defaultStats() {
  return {
    levelsSolved: 0, // пройдено уровней лестницы
    freeSolved: 0, // решено полей свободной игры
    perfect: 0, // побед без ошибок
    catsSeated: 0, // котов посажено на поля
    hintsUsed: 0, // подсказок взято
    fishEarned: 0, // рыбок заработано за всё время
    bestDailyMs: 0, // лучшее время задачи дня с первой попытки (0 — ещё нет)
    playMs: 0, // время в решённых партиях
  };
}

// Статистика из сохранения. Если её ещё не было (сохранение старой версии),
// то, что можно, восстанавливается из прогресса.
function normalizeStats(raw, save, num) {
  const base = defaultStats();
  if (!isObject(raw)) {
    const freeDone = Object.keys(save.free).reduce((sum, id) => sum + Math.max(0, (Number(save.free[id]) || 1) - 1), 0);
    return { ...base, levelsSolved: Math.max(0, save.level - 1), freeSolved: freeDone };
  }
  const out = {};
  for (const key of Object.keys(base)) out[key] = num(raw[key], base[key]);
  return out;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Приводит прочитанные данные к ожидаемому виду: чужим данным не доверяем.
function normalize(raw, startHints) {
  const base = defaultSave(startHints);
  if (!isObject(raw) || raw.v !== SAVE_VERSION) return base;
  const num = (value, fallback) => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback);
  const idList = (value, first) => {
    const list = Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
    return list.includes(first) ? list : [first, ...list];
  };
  const owned = idList(raw.owned, FIRST_CAT);
  const result = {
    ...base,
    updatedAt: num(raw.updatedAt, 0),
    level: Math.max(1, num(raw.level, 1)),
    free: isObject(raw.free) ? { ...raw.free } : {},
    fish: num(raw.fish, 0),
    hints: num(raw.hints, startHints),
    owned,
    equipped: typeof raw.equipped === 'string' ? raw.equipped : FIRST_CAT,
    ownedBoards: idList(raw.ownedBoards, FIRST_BOARD),
    boardTheme: typeof raw.boardTheme === 'string' ? raw.boardTheme : FIRST_BOARD,
    ownedMarks: idList(raw.ownedMarks, FIRST_MARK),
    markStyle: typeof raw.markStyle === 'string' ? raw.markStyle : FIRST_MARK,
    adProgress: isObject(raw.adProgress) ? { ...raw.adProgress } : {},
    streak: isObject(raw.streak) ? { ...base.streak, ...raw.streak } : base.streak,
    daily: isObject(raw.daily) ? { ...base.daily, ...raw.daily } : base.daily,
    solvedDailies: num(raw.solvedDailies, 0),
    events: isObject(raw.events) ? { ...raw.events } : {},
    settings: isObject(raw.settings) ? { ...base.settings, ...raw.settings } : base.settings,
    tutorialDone: raw.tutorialDone === true,
    levelsSinceAd: num(raw.levelsSinceAd, 0),
    current: isObject(raw.current) ? raw.current : null,
    owner: typeof raw.owner === 'string' ? raw.owner : '',
  };
  result.stats = normalizeStats(raw.stats, result, num);
  return result;
}

// Ключ копии на устройстве для игрока: kotokletki.save.<номер> или .guest.
function playerKey(playerId) {
  const id = String(playerId || '').replace(ID_SAFE_RE, '').slice(0, ID_MAX_LENGTH);
  return LOCAL_PREFIX + (id || GUEST_ID);
}

function readLocal(key) {
  try {
    const text = window.localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch (err) {
    return null;
  }
}

// Старое общее сохранение — только если его ещё не забрал другой игрок.
function adoptLegacy(key) {
  try {
    const adoptedBy = window.localStorage.getItem(ADOPTED_KEY);
    if (adoptedBy && adoptedBy !== key) return null;
    const legacy = readLocal(LEGACY_KEY);
    if (legacy) window.localStorage.setItem(ADOPTED_KEY, key);
    return legacy;
  } catch (err) {
    return null;
  }
}

function writeLocal(key, save) {
  try {
    window.localStorage.setItem(key, JSON.stringify(save));
  } catch (err) {
    // Хранилище недоступно (приватный режим, запрет сторонних данных) —
    // остаётся облако площадки, игра продолжает работать.
  }
}

function progressOf(save) {
  const freeLevels = Object.keys(save.free).reduce((sum, id) => sum + (Number(save.free[id]) || 0), 0);
  return (save.level + freeLevels) * 1000 + save.solvedDailies * 10 + save.owned.length + save.ownedBoards.length + save.ownedMarks.length;
}

// Из двух сохранений берётся то, где прогресс больше; при равенстве — более свежее.
function pickBetter(a, b) {
  const pa = progressOf(a);
  const pb = progressOf(b);
  if (pa !== pb) return pa > pb ? a : b;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export function createStore(platform, startHints) {
  const owner = typeof platform.playerId === 'function' ? String(platform.playerId() || '') : '';
  const key = playerKey(owner);
  let save = defaultSave(startHints);
  let cloudTimer = 0;
  let isCloudDirty = false;

  function pushCloud() {
    cloudTimer = 0;
    if (!isCloudDirty) return;
    isCloudDirty = false;
    platform.saveData(save).catch(() => {
      isCloudDirty = true;
    });
  }

  return {
    async init() {
      let raw = readLocal(key);
      // Копия с чужим владельцем не берётся (на случай ручного копирования ключей).
      if (raw && raw.owner && raw.owner !== owner) raw = null;
      if (!raw && !platform.hasCloud) raw = adoptLegacy(key);
      const local = normalize(raw, startHints);
      let cloud = null;
      try {
        cloud = await platform.loadData();
      } catch (err) {
        cloud = null;
      }
      save = cloud ? pickBetter(local, normalize(cloud, startHints)) : local;
      save = { ...save, owner };
      return save;
    },

    get() {
      return save;
    },

    // patch — поля, которые нужно заменить. Возвращает новое сохранение.
    set(patch) {
      save = { ...save, ...patch, owner, updatedAt: Date.now() };
      writeLocal(key, save);
      isCloudDirty = true;
      if (!cloudTimer) cloudTimer = window.setTimeout(pushCloud, CLOUD_DELAY_MS);
      return save;
    },

    // Прибавить к счётчикам статистики: add({ levelsSolved: 1, fishEarned: 3 }).
    // best — рекорды, где лучше меньшее значение: best({ bestDailyMs: 83000 }).
    addStats(add = {}, best = {}) {
      const stats = { ...save.stats };
      for (const name of Object.keys(add)) stats[name] = (stats[name] || 0) + Math.max(0, Math.floor(add[name] || 0));
      for (const name of Object.keys(best)) {
        const value = Math.floor(best[name] || 0);
        if (value > 0 && (!stats[name] || value < stats[name])) stats[name] = value;
      }
      return this.set({ stats });
    },

    // Немедленная отправка в облако (уход со страницы, конец уровня).
    flush() {
      if (cloudTimer) window.clearTimeout(cloudTimer);
      pushCloud();
    },
  };
}
