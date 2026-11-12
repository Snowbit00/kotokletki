// Адаптер VK Play (vkplay.ru).
// На VK Play браузерные игры не должны содержать рекламной монетизации, поэтому
// реклама здесь выключена (canShowAds: false): подсказки и попытки бесплатные,
// товары магазина продаются только за рыбки.
// SDK площадки не подключается, сохранение — на устройстве (localStorage ведёт
// storage.js). Таблица дня на VK Play не показывается.
//
// Номер игрока. Открытая документация VK Play (documentation.vkplay.ru, 12.11.2026)
// описывает uid игрока только в запросах «сервер — сервер» (достижения, таблицы), а
// как он попадает в iframe браузерной игры — нет. Поэтому номер берётся из адреса
// игры, если VK Play его туда передаёт (параметры PLAYER_PARAMS, только цифры).
// Имя параметра нужно сверить в кабинете разработчика. Нет номера — сохранение
// одно на браузер.
const PLAYER_PARAMS = ['uid', 'user_id', 'vkp_uid'];
const ID_RE = /^[0-9]{1,20}$/;

function playerFromUrl() {
  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (err) {
    return '';
  }
  for (const name of PLAYER_PARAMS) {
    const value = params.get(name);
    if (value && ID_RE.test(value)) return value;
  }
  return '';
}

export async function create() {
  const playerId = playerFromUrl();
  return {
    name: 'vkplay',
    canShowAds: false,
    hasCloud: false,
    playerId() {
      return playerId;
    },
    lang() {
      return window.navigator.language || 'ru';
    },
    ready() {},
    gameplayStart() {},
    gameplayStop() {},
    serverTime() {
      return Date.now();
    },
    async showRewarded() {
      return true;
    },
    async showInterstitial() {},
    async loadData() {
      return null;
    },
    async saveData() {},
    async submitScore() {},
    async getLeaderboard() {
      return null;
    },
  };
}
