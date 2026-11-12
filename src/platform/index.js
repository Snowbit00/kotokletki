// Слой площадки. Игра не знает, где она запущена: она вызывает одни и те же
// методы, а адаптер переводит их в вызовы SDK Яндекс Игр, VK Bridge или заглушки.
//
// Интерфейс адаптера:
//   name                      — 'yandex' | 'vk' | 'vkplay' | 'local'
//   canShowAds                — есть ли на площадке реклама (на VK Play её нет)
//   lang()                    — код языка площадки ('ru', 'en', …)
//   ready()                   — игра загрузилась и готова к показу
//   gameplayStart() / gameplayStop() — разметка игрового процесса
//   serverTime()              — время в миллисекундах (по возможности серверное)
//   showRewarded()            — ролик за награду, Promise<boolean> «досмотрел»
//   showInterstitial()        — межстраничная реклама, Promise<void>
//   playerId()                — номер игрока на площадке ('' — неизвестен): по нему
//                               сохранения на устройстве разделяются между игроками
//   hasCloud                  — есть ли облачное сохранение (у Яндекса и VK — да)
//   loadData() / saveData(o)  — облачное сохранение
//   submitScore(name, value)  — результат в таблицу
//   getLeaderboard(name)      — записи таблицы [{ rank, name, score, isPlayer }] или null

import { TARGET } from './target.js';

const LOADERS = {
  yandex: () => import('./yandex.js'),
  vk: () => import('./vk.js'),
  vkplay: () => import('./vkplay.js'),
  local: () => import('./local.js'),
};

export async function createPlatform() {
  const load = LOADERS[TARGET] || LOADERS.local;
  try {
    const adapter = await load();
    return await adapter.create();
  } catch (err) {
    // SDK площадки не загрузился (игра открыта вне площадки, блокировщик и т. п.).
    // Игра остаётся рабочей: без рекламы и с сохранением только на устройстве.
    console.warn('Площадка недоступна, игра работает автономно:', err);
    const local = await import('./local.js');
    return local.create({ hasFakeAds: false });
  }
}
