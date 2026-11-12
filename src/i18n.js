// Тексты на двух языках. Сами строки лежат в content.json → texts.

const RU_LIKE = ['ru', 'be', 'kk', 'uk', 'uz'];
const DEFAULT_LANG = 'ru';

let lang = DEFAULT_LANG;
let texts = {};

// Язык игры по языку площадки: русскоязычные регионы — ru, остальные — en.
export function pickLang(code) {
  const short = String(code || '').slice(0, 2).toLowerCase();
  return RU_LIKE.includes(short) ? 'ru' : 'en';
}

export function setLang(code, allTexts) {
  lang = allTexts[code] ? code : DEFAULT_LANG;
  texts = allTexts[lang] || {};
  document.documentElement.lang = lang;
}

export function getLang() {
  return lang;
}

export function t(key, params) {
  let text = Object.prototype.hasOwnProperty.call(texts, key) ? texts[key] : key;
  if (params) {
    for (const name of Object.keys(params)) text = text.split('{' + name + '}').join(String(params[name]));
  }
  return text;
}

// Название из объекта вида { ru: '…', en: '…' }.
export function localName(names) {
  if (!names) return '';
  return names[lang] || names[DEFAULT_LANG] || '';
}

// Подставляет тексты во все элементы с атрибутом data-t.
export function applyTexts(root) {
  root.querySelectorAll('[data-t]').forEach((node) => {
    node.textContent = t(node.dataset.t);
  });
}

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return minutes + ':' + seconds;
}
