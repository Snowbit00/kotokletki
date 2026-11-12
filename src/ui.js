// Общие помощники интерфейса: элементы, экраны, окна, всплывающие сообщения, значки.

import { iconSvg } from './icons.js';

const TOAST_MS = 2200;

// Объёмные значки в чиби-стиле — в icons.js. Здесь только простые служебные значки,
// которые рисуются цветом текста (стрелка «назад», точка, динамик).
const PLAIN_ICONS = {
  back:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  dot: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z" fill="currentColor"/><path d="M15.500 9a4.500 4.500 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/></svg>',
};

// options — для значков с параметрами (например, { day: 12 } у календаря).
export function iconHtml(name, options) {
  return iconSvg(name, options) || PLAIN_ICONS[name] || '';
}

// Вставляет значки во все элементы с атрибутом data-icon.
export function mountIcons(root) {
  root.querySelectorAll('[data-icon]').forEach((node) => {
    node.innerHTML = iconHtml(node.dataset.icon);
  });
}

// Создаёт элемент. attrs: class, text, type, hidden, id, title, dataset, onClick.
// children — элементы или строки (строки вставляются как текст).
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    if (value === undefined || value === null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'onClick') node.addEventListener('click', value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'svg') node.innerHTML = value;
    else if (key === 'hidden') node.hidden = value === true;
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('is-active', screen.id === 'screen-' + name);
  });
  // Фон экрана игры задаёт тема поля (переменные ставит экран игры).
  document.body.classList.toggle('in-game', name === 'game');
}

let toastTimer = 0;

// icon — имя значка слева от текста (необязательно).
export function toast(text, icon) {
  const node = document.getElementById('toast');
  node.textContent = '';
  const svg = icon ? iconHtml(icon) : '';
  if (svg) node.append(el('span', { class: 'ico', svg }));
  node.append(el('span', { text }));
  node.hidden = false;
  node.classList.remove('is-shown');
  // Перезапуск анимации появления.
  void node.offsetWidth;
  node.classList.add('is-shown');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.hidden = true;
  }, TOAST_MS);
}

// Окно поверх игры. options: title, body (массив элементов), actions
// ([{ label, isPrimary, icon, onClick }]), onDismiss (если задан — окно можно
// закрыть касанием мимо). Возвращает функцию закрытия.
export function openModal(options) {
  const host = document.getElementById('modal-host');
  host.textContent = '';
  const actions = (options.actions || []).map((action) =>
    el(
      'button',
      {
        class: 'btn' + (action.isPrimary ? ' btn-primary' : ''),
        type: 'button',
        onClick: action.onClick,
      },
      [
        el('span', { class: 'btn-line' }, [
          action.icon ? el('span', { class: 'ico', svg: iconHtml(action.icon) }) : null,
          el('span', { text: action.label }),
        ]),
      ]
    )
  );
  const modal = el('div', { class: 'modal ' + (options.className || ''), role: 'dialog' }, [
    options.title ? el('h2', { text: options.title }) : null,
    ...(options.body || []),
    actions.length ? el('div', { class: 'modal-actions' }, actions) : null,
  ]);
  host.append(modal);
  host.hidden = false;
  host.onclick = (event) => {
    if (event.target === host && options.onDismiss) options.onDismiss();
  };
  return closeModal;
}

export function closeModal() {
  const host = document.getElementById('modal-host');
  host.hidden = true;
  host.textContent = '';
  host.onclick = null;
}

export function isModalOpen() {
  return !document.getElementById('modal-host').hidden;
}
