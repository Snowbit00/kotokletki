// Заглушка площадки для разработки: реклама — экран на 2 секунды,
// сохранения — только localStorage (его ведёт storage.js).
//
// Для проверки задачи дня дату можно подменить в адресе: ?date=2026-12-31
// Сборку без рекламы (VK Play) можно проверить так: ?noads=1

import { t } from '../i18n.js';

const AD_MS = 2000;
const NOON_MSK_UTC_HOUR = 9;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function showStubAd() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'ad-stub';
    const label = document.createElement('p');
    label.textContent = t('ad.stub');
    const bar = document.createElement('div');
    bar.className = 'ad-stub-bar';
    overlay.append(label, bar);
    document.body.append(overlay);
    window.setTimeout(() => {
      overlay.remove();
      resolve();
    }, AD_MS);
  });
}

function fixedTime() {
  const value = new URLSearchParams(window.location.search).get('date');
  if (!value || !DATE_RE.test(value)) return 0;
  const p = value.split('-').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2], NOON_MSK_UTC_HOUR);
}

export async function create(options = {}) {
  // ?noads=1 в адресе — проверка сборки без рекламы (как на VK Play).
  const isNoAds = new URLSearchParams(window.location.search).get('noads') === '1';
  const hasFakeAds = options.hasFakeAds !== false && !isNoAds;
  const frozenTime = fixedTime();

  return {
    name: 'local',
    canShowAds: hasFakeAds,
    lang() {
      return window.navigator.language || 'ru';
    },
    ready() {},
    gameplayStart() {},
    gameplayStop() {},
    serverTime() {
      return frozenTime || Date.now();
    },
    async showRewarded() {
      if (hasFakeAds) await showStubAd();
      return true;
    },
    async showInterstitial() {
      if (hasFakeAds) await showStubAd();
    },
    hasCloud: false,
    // Для проверки разделения сохранений: ?player=имя в адресе.
    playerId() {
      return new URLSearchParams(window.location.search).get('player') || '';
    },
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
