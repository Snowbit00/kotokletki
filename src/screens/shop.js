// Магазин: скины котиков, темы поля и метки «пусто».
// Товар открывается за рыбки (price), за ролики (ads) или любым из двух способов.
// Товары событий (event) не продаются: их выдают за задачи дня.
// На площадке без рекламы (VK Play) кнопок роликов нет: товар «только за ролики»
// продаётся за рыбки по курсу content.json → shop.fishPerAd.
// Касание карточки открывает примерку: крупный просмотр и те же кнопки.
// У котика в примерке слышно его «мяу» (meow.js).

import { t, localName } from '../i18n.js';
import { el, showScreen, toast, iconHtml, openModal, closeModal } from '../ui.js';
import { catSvg } from '../cats.js';
import { miniBoard } from '../board.js';
import { sceneryNode, sceneryOf } from '../scenery.js';
import { voiceOf } from '../meow.js';
import { catById, boardById, eventById } from '../content.js';
import { sfx } from '../audio.js';
import { bump } from '../effects.js';

// Для каждого раздела: список в content.json и поля сохранения.
const KINDS = {
  cat: { list: 'cats', owned: 'owned', equipped: 'equipped', newText: 'shop.newCat' },
  board: { list: 'boards', owned: 'ownedBoards', equipped: 'boardTheme', newText: 'shop.newBoard' },
  mark: { list: 'marks', owned: 'ownedMarks', equipped: 'markStyle', newText: 'shop.newMark' },
};
const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const DEFAULT_FISH_PER_AD = 40;

// Маленькие поля для карточек (3×3) и примерки (4×4): комнаты, коты, отметки
// игрока (marks) и отметки, которые ставит игра (autos).
const MINI_CARD = { size: 3, layout: [0, 0, 1, 2, 0, 1, 2, 2, 1], cats: [2], marks: [4, 6] };
const MINI_PREVIEW = { size: 4, layout: [0, 0, 1, 1, 2, 0, 0, 1, 2, 3, 3, 1, 2, 2, 3, 3], cats: [1, 7, 8, 14], marks: [3, 4, 11, 13] };
const MINI_MARK_CARD = { size: 3, layout: [0, 0, 1, 2, 0, 1, 2, 2, 1], cats: [2], marks: [0, 4, 6, 8], autos: [1, 5] };
const MINI_MARK_PREVIEW = { ...MINI_PREVIEW, marks: [0, 3, 4, 11, 13], autos: [2, 5, 6, 15] };
// Метка «как у поля»: на карточке в каждой клетке своя метка — видно, что она меняется.
const THEME_MARK = 'theme';
const THEME_MARK_CELLS = { 0: 'dot', 1: 'cross', 4: 'paw', 5: 'fish', 6: 'star', 8: 'heart' };

function byId(id) {
  return document.getElementById(id);
}

function rarityOf(item) {
  return RARITIES.includes(item.rarity) ? item.rarity : 'common';
}

export function createShopScreen(app) {
  let tab = 'cat';
  let isBusy = false;

  function canShowAds() {
    return app.platform.canShowAds !== false;
  }

  function fishPerAd() {
    const value = app.content.shop && Number(app.content.shop.fishPerAd);
    return value > 0 ? value : DEFAULT_FISH_PER_AD;
  }

  // Как можно получить товар на этой площадке: { price, ads }.
  function offerOf(item) {
    const adsNeeded = Number(item.ads) > 0 ? Math.floor(item.ads) : 0;
    let price = Number(item.price) > 0 ? Math.floor(item.price) : 0;
    if (canShowAds()) return { price, ads: adsNeeded };
    if (!price && adsNeeded) price = adsNeeded * fishPerAd();
    return { price, ads: 0 };
  }

  // Куплен или бесплатен (бесплатный товар не нужно «брать», его сразу можно выбрать).
  function ownsItem(kind, item) {
    if (app.store.get()[KINDS[kind].owned].includes(item.id)) return true;
    if (item.event) return false;
    const offer = offerOf(item);
    return offer.price === 0 && offer.ads === 0;
  }

  function adKey(kind, item) {
    return kind + ':' + item.id;
  }

  function seenAds(kind, item) {
    return Number(app.store.get().adProgress[adKey(kind, item)]) || 0;
  }

  // ---------- Действия ----------

  function wear(kind, item, after) {
    app.store.set({ [KINDS[kind].equipped]: item.id });
    if (kind === 'cat') sfx.meow(voiceOf(item));
    else sfx.place();
    after();
  }

  // Товар получен: добавить во владение, сразу выбрать, сбросить счётчик роликов.
  function unlock(kind, item, extra, after) {
    const config = KINDS[kind];
    const save = app.store.get();
    const adProgress = { ...save.adProgress };
    delete adProgress[adKey(kind, item)];
    app.store.set({ ...extra, adProgress, [config.owned]: [...save[config.owned], item.id], [config.equipped]: item.id });
    app.store.flush();
    sfx.coin();
    toast(t(config.newText, { name: localName(item.name) }), 'star');
    after();
    bump(byId('shop-fish-pill'));
  }

  function buy(kind, item, after) {
    const save = app.store.get();
    const { price } = offerOf(item);
    if (save.fish < price) {
      sfx.wrong();
      toast(t('shop.notEnough'), 'fish');
      bump(byId('shop-fish-pill'));
      return;
    }
    unlock(kind, item, { fish: save.fish - price }, after);
  }

  async function watch(kind, item, after) {
    if (isBusy) return;
    isBusy = true;
    const isWatched = await app.watchAd();
    isBusy = false;
    if (!isWatched) {
      toast(t('msg.noAd'));
      return;
    }
    const save = app.store.get();
    const seen = seenAds(kind, item) + 1;
    if (seen >= offerOf(item).ads) {
      unlock(kind, item, {}, after);
      return;
    }
    app.store.set({ adProgress: { ...save.adProgress, [adKey(kind, item)]: seen } });
    sfx.tap();
    after();
  }

  // Что можно сделать с товаром: список { type, label, icon, run } или подпись.
  function optionsFor(kind, item) {
    const config = KINDS[kind];
    const save = app.store.get();
    if (save[config.equipped] === item.id) return { note: t('shop.worn'), isState: true, actions: [] };
    if (ownsItem(kind, item)) {
      return { actions: [{ type: 'wear', label: t('shop.wear'), run: (after) => wear(kind, item, after) }] };
    }
    if (item.event) {
      const event = eventById(item.event);
      return { note: t('shop.event', { name: event ? localName(event.name) : '' }), actions: [] };
    }
    const offer = offerOf(item);
    const actions = [];
    if (offer.price > 0 || !offer.ads) {
      actions.push({ type: 'buy', price: offer.price, label: t('shop.buy'), icon: 'fish', run: (after) => buy(kind, item, after) });
    }
    if (offer.ads) {
      const label = t('shop.watch', { n: Math.min(offer.ads, seenAds(kind, item) + 1), m: offer.ads });
      actions.push({ type: 'watch', label, icon: 'video', run: (after) => watch(kind, item, after) });
    }
    return { actions };
  }

  // ---------- Картинки товаров ----------

  function catPicture(item, isLarge) {
    const options = { pose: 'full', effects: isLarge || rarityOf(item) === 'legendary', animate: isLarge };
    return el('div', { class: 'card-cat', svg: catSvg(item, options) });
  }

  // Поле с выбранной меткой игрока — так, как оно будет выглядеть в игре.
  function boardPicture(theme, shape) {
    const save = app.store.get();
    return miniBoard(theme, { ...shape, mark: save.markStyle, catHtml: catSvg(catById(save.equipped)) });
  }

  // Метка показывается на текущем поле игрока. У «как у поля» на карточке разные
  // метки в разных клетках, в примерке — метка текущего поля.
  function markPicture(item, isLarge) {
    const save = app.store.get();
    const shape = isLarge ? MINI_MARK_PREVIEW : MINI_MARK_CARD;
    const variety = item.id === THEME_MARK && !isLarge ? { mark: 'paw', cellMarks: THEME_MARK_CELLS } : { mark: item.id };
    return miniBoard(boardById(save.boardTheme), { ...shape, ...variety, catHtml: catSvg(catById(save.equipped)) });
  }

  // Поле в примерке — на фоне своей сцены и цветов экрана игры.
  function themeStage(theme, board) {
    const box = el('div', { class: 'scn-box' + (theme.background && theme.background.dark ? ' is-dark' : '') }, [sceneryNode(sceneryOf(theme)), board]);
    const bg = theme.background;
    const isColor = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v);
    box.style.background = bg && isColor(bg.from) && isColor(bg.to) ? `linear-gradient(180deg, ${bg.from}, ${bg.to})` : 'linear-gradient(180deg, var(--bg), var(--bg2))';
    return box;
  }

  function picture(kind, item, isLarge) {
    if (kind === 'cat') return catPicture(item, isLarge);
    if (kind === 'mark') return markPicture(item, isLarge);
    return boardPicture(item, isLarge ? MINI_PREVIEW : MINI_CARD);
  }

  // Подпись под названием: редкость, а у «как у поля» — что метка меняется.
  function subtitle(kind, item) {
    if (kind === 'mark' && item.id === THEME_MARK) return t('shop.markTheme');
    return t('rarity.' + rarityOf(item));
  }

  // Название метки текущего поля (для примерки «как у поля»).
  function themeMarkName() {
    const own = boardById(app.store.get().boardTheme);
    const id = (own && own.mark) || 'dot';
    const mark = (app.content.marks || []).find((m) => m.id === id);
    return mark ? localName(mark.name) : id;
  }

  // Кнопка «Голос: нежный» — проиграть «мяу» котика.
  function voiceButton(item) {
    const voice = voiceOf(item);
    const button = el('button', { class: 'btn btn-small voice-btn', type: 'button', title: t('shop.listen') }, [
      el('span', { class: 'btn-line' }, [
        el('span', { class: 'ico', svg: iconHtml('sound') }),
        el('span', { text: t('shop.voice', { name: t('voice.' + voice.name) }) }),
      ]),
    ]);
    button.addEventListener('click', () => sfx.meow(voice));
    return button;
  }

  // ---------- Карточки ----------

  function cardButton(action, onDone) {
    const children = [el('span', { class: 'btn-line' }, [
      action.icon ? el('span', { class: 'ico', svg: iconHtml(action.icon) }) : null,
      el('span', { text: action.label }),
      action.type === 'buy' ? el('span', { text: String(action.price) }) : null,
    ])];
    const button = el('button', { class: 'btn btn-small' + (action.type === 'buy' ? ' btn-primary' : ''), type: 'button' }, children);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      action.run(onDone);
    });
    return button;
  }

  function card(kind, item) {
    const save = app.store.get();
    const config = KINDS[kind];
    const isOwned = ownsItem(kind, item);
    const isWorn = save[config.equipped] === item.id;
    const rarity = rarityOf(item);
    const options = optionsFor(kind, item);
    const footer = options.note
      ? [el('span', { class: options.isState ? 'card-state' : 'card-note', text: options.note })]
      : options.actions.map((action) => cardButton(action, refresh));
    const node = el('div', { class: `card rar-${rarity}` + (isWorn ? ' is-worn' : '') + (isOwned ? '' : ' is-locked') }, [
      picture(kind, item, false),
      el('b', { class: 'card-name', text: localName(item.name) }),
      el('span', { class: 'rarity', text: subtitle(kind, item) }),
      ...footer,
    ]);
    node.addEventListener('click', () => {
      if (isBusy) return;
      if (kind === 'cat') sfx.meow(voiceOf(item));
      else sfx.tap();
      openPreview(kind, item);
    });
    return node;
  }

  // Порядок: выбранное, купленное, затем по цене; награды событий в конце.
  function sortKey(kind, item) {
    const save = app.store.get();
    const config = KINDS[kind];
    if (save[config.equipped] === item.id) return -2;
    if (ownsItem(kind, item)) return -1;
    if (item.event) return 1e9;
    const offer = offerOf(item);
    return offer.price || offer.ads * fishPerAd();
  }

  function refresh() {
    const save = app.store.get();
    const config = KINDS[tab];
    byId('shop-fish').textContent = String(save.fish);
    byId('shop-tabs')
      .querySelectorAll('button')
      .forEach((button) => button.classList.toggle('is-on', button.dataset.tab === tab));
    const items = (app.content[config.list] || []).slice().sort((a, b) => sortKey(tab, a) - sortKey(tab, b));
    const mine = items.filter((item) => ownsItem(tab, item));
    const forSale = items.filter((item) => !ownsItem(tab, item));
    const grid = byId('shop-grid');
    grid.textContent = '';
    // Сначала то, что уже есть у игрока, потом то, что можно получить.
    for (const [title, list] of [[t('shop.mine'), mine], [t('shop.forSale'), forSale]]) {
      if (!list.length) continue;
      grid.append(el('h3', { class: 'shop-section' }, [el('span', { text: title }), el('small', { text: String(list.length) })]));
      for (const item of list) grid.append(card(tab, item));
    }
  }

  // ---------- Примерка ----------

  function openPreview(kind, item) {
    const rarity = rarityOf(item);
    const options = optionsFor(kind, item);
    const reopen = () => {
      refresh();
      openPreview(kind, item);
    };
    const save = app.store.get();
    const pictures =
      kind === 'cat'
        ? [
            picture(kind, item, true),
            voiceButton(item),
            miniBoard(boardById(save.boardTheme), { ...MINI_CARD, mark: save.markStyle, catHtml: catSvg(item) }),
          ]
        : kind === 'board'
          ? [themeStage(item, picture(kind, item, true))]
          : [picture(kind, item, true)];
    if (kind === 'mark') {
      const note = item.id === THEME_MARK ? t('shop.markThemeNow', { name: themeMarkName() }) : t('shop.markNote');
      pictures.push(el('p', { class: 'preview-tags', text: note }));
    }
    const actions = options.actions.map((action) => ({
      label: action.type === 'buy' ? t('shop.buy') + ' · ' + action.price : action.label,
      icon: action.icon,
      isPrimary: action.type !== 'watch',
      onClick: () => action.run(reopen),
    }));
    actions.push({ label: t('shop.close'), onClick: closeModal });
    openModal({
      title: localName(item.name),
      className: `preview rar-${rarity}`,
      body: [
        el('p', { class: 'rarity', text: subtitle(kind, item) }),
        ...pictures,
        options.note ? el('p', { class: 'preview-tags', text: options.note }) : null,
      ],
      actions,
      onDismiss: closeModal,
    });
  }

  function show() {
    refresh();
    showScreen('shop');
  }

  byId('btn-shop-back').addEventListener('click', () => {
    if (isBusy) return;
    sfx.tap();
    app.go('home');
  });
  byId('shop-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (!button || isBusy) return;
    sfx.tap();
    tab = button.dataset.tab;
    refresh();
  });

  return { show };
}
