// Адаптер VK Игр (vk.com) через VK Bridge.
// Имена методов и параметры сверены 11.11.2026 по типам официального
// репозитория VKCOM/vk-bridge: VKWebAppInit, VKWebAppShowNativeAds
// ({ ad_format: 'reward' | 'interstitial' } → { result }), VKWebAppStorageGet
// ({ keys } → { keys: [{ key, value }] }), VKWebAppStorageSet ({ key, value }),
// VKWebAppGetLaunchParams (→ vk_language).
// НЕ сверено (сайт dev.vk.com в день проверки не открывался): адрес готовой
// сборки библиотеки для тега script, имя глобальной переменной vkBridge и
// предел длины значения в хранилище. Перед выкладкой в VK проверить.
//
// Таблица дня в VK не подключена: у VK одна общая таблица, которая
// показывается отдельным окном и не подходит для результатов по дням.

const BRIDGE_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
const SAVE_KEY = 'save';
const VALUE_LIMIT = 4096;

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
  await loadScript(BRIDGE_URL);
  const bridge = window.vkBridge;
  if (!bridge || typeof bridge.send !== 'function') throw new Error('VK Bridge не найден');
  await bridge.send('VKWebAppInit');

  let language = 'ru';
  let userId = '';
  try {
    const params = await bridge.send('VKWebAppGetLaunchParams');
    if (params && typeof params.vk_language === 'string') language = params.vk_language;
    if (params && params.vk_user_id) userId = String(params.vk_user_id);
  } catch (err) {
    language = 'ru';
  }

  async function showAd(format) {
    try {
      const data = await bridge.send('VKWebAppShowNativeAds', { ad_format: format });
      return Boolean(data && data.result);
    } catch (err) {
      return false;
    }
  }

  return {
    name: 'vk',
    canShowAds: true,
    hasCloud: true,
    playerId() {
      return userId;
    },

    lang() {
      return language;
    },

    ready() {},
    gameplayStart() {},
    gameplayStop() {},

    serverTime() {
      return Date.now();
    },

    showRewarded() {
      return showAd('reward');
    },

    async showInterstitial() {
      await showAd('interstitial');
    },

    async loadData() {
      const data = await bridge.send('VKWebAppStorageGet', { keys: [SAVE_KEY] });
      const item = ((data && data.keys) || []).find((entry) => entry.key === SAVE_KEY);
      return item && item.value ? JSON.parse(item.value) : null;
    },

    // Значение в хранилище VK ограничено по длине: если сохранение не помещается,
    // незаконченная партия в облако не отправляется (она остаётся на устройстве).
    async saveData(save) {
      let value = JSON.stringify(save);
      if (value.length > VALUE_LIMIT) value = JSON.stringify({ ...save, current: null });
      if (value.length > VALUE_LIMIT) return;
      await bridge.send('VKWebAppStorageSet', { key: SAVE_KEY, value });
    },

    async submitScore() {},

    async getLeaderboard() {
      return null;
    },
  };
}
