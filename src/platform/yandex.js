// Адаптер Яндекс Игр.
// Сверено с документацией 11.11.2026: YaGames.init, features.LoadingAPI.ready,
// features.GameplayAPI.start/stop, adv.showFullscreenAdv / showRewardedVideo,
// getPlayer, player.setData / getData (до 100 запросов за 5 минут, до 200 КБ),
// leaderboards.setScore / getEntries, environment.i18n.lang.
// Не подтверждено страницами документации и поэтому вызывается с проверкой
// наличия: ysdk.serverTime(), события game_api_pause / game_api_resume.
//
// В консоли разработчика нужно создать лидерборд с техническим названием
// LEADERBOARD_NAMES.daily и сортировкой по убыванию.

const SDK_URL = '/sdk.js';
const SAVE_KEY = 'save';
const LEADERBOARD_NAMES = { daily: 'daily' };
const TOP_ENTRIES = 20;
const AROUND_ENTRIES = 3;

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не загрузился ' + url));
    document.head.append(script);
  });
}

export async function create() {
  await loadScript(SDK_URL);
  const ysdk = await window.YaGames.init();

  let player = null;
  try {
    player = await ysdk.getPlayer();
  } catch (err) {
    player = null;
  }

  async function canUse(method) {
    try {
      return (await ysdk.isAvailableMethod(method)) === true;
    } catch (err) {
      return false;
    }
  }

  function playerId() {
    try {
      return player ? player.getUniqueID() : '';
    } catch (err) {
      return '';
    }
  }

  return {
    name: 'yandex',
    canShowAds: true,
    hasCloud: Boolean(player),
    playerId,

    lang() {
      return ysdk.environment.i18n.lang;
    },

    ready() {
      if (ysdk.features.LoadingAPI) ysdk.features.LoadingAPI.ready();
    },

    gameplayStart() {
      if (ysdk.features.GameplayAPI) ysdk.features.GameplayAPI.start();
    },

    gameplayStop() {
      if (ysdk.features.GameplayAPI) ysdk.features.GameplayAPI.stop();
    },

    serverTime() {
      return typeof ysdk.serverTime === 'function' ? ysdk.serverTime() : Date.now();
    },

    // Площадка может сама поставить игру на паузу (например, на время рекламы).
    subscribe(handlers) {
      if (typeof ysdk.on !== 'function') return;
      ysdk.on('game_api_pause', handlers.onPause);
      ysdk.on('game_api_resume', handlers.onResume);
    },

    showRewarded() {
      return new Promise((resolve) => {
        let isRewarded = false;
        ysdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              isRewarded = true;
            },
            onClose: () => resolve(isRewarded),
            onError: () => resolve(false),
          },
        });
      });
    },

    showInterstitial() {
      return new Promise((resolve) => {
        ysdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: () => resolve(),
            onError: () => resolve(),
          },
        });
      });
    },

    async loadData() {
      if (!player) return null;
      const data = await player.getData([SAVE_KEY]);
      return data && data[SAVE_KEY] ? data[SAVE_KEY] : null;
    },

    async saveData(save) {
      if (!player) return;
      await player.setData({ [SAVE_KEY]: save }, true);
    },

    // Запись в таблицу доступна только авторизованным игрокам.
    async submitScore(name, value) {
      if (!(await canUse('leaderboards.setScore'))) return;
      await ysdk.leaderboards.setScore(LEADERBOARD_NAMES[name], value);
    },

    async getLeaderboard(name) {
      const data = await ysdk.leaderboards.getEntries(LEADERBOARD_NAMES[name], {
        quantityTop: TOP_ENTRIES,
        includeUser: true,
        quantityAround: AROUND_ENTRIES,
      });
      const me = playerId();
      return (data.entries || []).map((entry) => ({
        rank: entry.rank,
        name: (entry.player && entry.player.publicName) || '—',
        score: entry.score,
        isPlayer: Boolean(me) && Boolean(entry.player) && entry.player.uniqueID === me,
      }));
    },
  };
}
