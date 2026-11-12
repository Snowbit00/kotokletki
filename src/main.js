// Запуск игры: содержимое, площадка, сохранения, экраны.

import { loadContent } from './content.js';
import { createPlatform } from './platform/index.js';
import { createStore } from './storage.js';
import { setLang, pickLang, applyTexts, t } from './i18n.js';
import { mountIcons } from './ui.js';
import { setSoundEnabled, setMeowEnabled, setMuted } from './audio.js';
import { moscowDate } from './daily.js';
import { catSvg } from './cats.js';
import { createHomeScreen } from './screens/home.js';
import { createPlayScreen } from './screens/play.js';
import { createShopScreen } from './screens/shop.js';

const LOAD_ERROR_TEXT = 'Не удалось загрузить игру. Обновите страницу. / The game failed to load. Please reload the page.';

async function boot() {
  document.getElementById('loading-cat').innerHTML = catSvg(null, { pose: 'full', animate: true });

  const content = await loadContent();
  const platform = await createPlatform();
  const store = createStore(platform, content.startHints);
  const save = await store.init();

  setLang(save.settings.lang || pickLang(platform.lang()), content.texts);
  setSoundEnabled(save.settings.sound);
  setMeowEnabled(save.settings.meow);
  applyTexts(document);
  mountIcons(document);
  document.title = t('title');

  const screens = {};
  const app = {
    content,
    platform,
    store,
    // Сегодняшняя дата по Москве: от неё зависит задача дня.
    today() {
      return moscowDate(platform.serverTime());
    },
    go(name, params) {
      if (name === 'play') screens.play.open(params);
      else screens[name].show();
    },
    // Ролик за награду. На время рекламы звук выключается. true — ролик досмотрен.
    async watchAd() {
      setMuted(true);
      let isWatched = false;
      try {
        isWatched = (await platform.showRewarded()) === true;
      } catch (err) {
        isWatched = false;
      } finally {
        setMuted(false);
      }
      // После ролика межстраничная реклама откладывается.
      store.set({ levelsSinceAd: 0 });
      return isWatched;
    },
  };
  screens.home = createHomeScreen(app);
  screens.play = createPlayScreen(app);
  screens.shop = createShopScreen(app);

  window.addEventListener('resize', () => screens.play.layout());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      screens.play.onHidden();
      store.flush();
    } else {
      screens.play.onVisible();
    }
  });
  // Площадка может сама поставить игру на паузу — тогда останавливаются время и звук.
  if (platform.subscribe) {
    platform.subscribe({
      onPause() {
        setMuted(true);
        screens.play.onHidden();
      },
      onResume() {
        setMuted(false);
        screens.play.onVisible();
      },
    });
  }
  // Площадки требуют, чтобы долгое нажатие и правая кнопка не открывали меню браузера.
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  screens.home.show();
  platform.ready();
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('loading-text').textContent = LOAD_ERROR_TEXT;
});
