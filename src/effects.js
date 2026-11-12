// Эффект победы: частицы разлетаются из центра поля и падают.
// Вид частиц задаёт тема поля (content.json → boards → win).
// Случайность здесь только косметическая, на уровни она не влияет.

import { iconSvg } from './icons.js';

const BIT_COUNT = 36;
const LIFE_MS = 1900;
const LAYER_MS = LIFE_MS + 300;

const SHAPES = {
  confetti: (c) => `<svg viewBox="0 0 10 10"><rect x="1" y="3" width="8" height="4.5" rx="1" fill="${c}"/></svg>`,
  stars: (c) => `<svg viewBox="-7 -7 14 14"><path d="M0 -6.5 L1.8 -1.8 L6.5 0 L1.8 1.8 L0 6.5 L-1.8 1.8 L-6.5 0 L-1.8 -1.8 Z" fill="${c}"/></svg>`,
  hearts: (c) => `<svg viewBox="-6 -6 12 12"><path d="M0 4 C-6 0 -6 -5 -2.6 -5 C-1.2 -5 0 -4 0 -2.8 C0 -4 1.2 -5 2.6 -5 C6 -5 6 0 0 4 Z" fill="${c}"/></svg>`,
  fish: () => iconSvg('fish'),
  petals: (c) => `<svg viewBox="-6 -6 12 12"><ellipse rx="3.2" ry="5.6" fill="${c}"/></svg>`,
  snow: (c) => `<svg viewBox="-6 -6 12 12"><g stroke="${c}" stroke-width="1.5" stroke-linecap="round"><path d="M0 -5 L0 5"/><path d="M-4.3 -2.5 L4.3 2.5"/><path d="M-4.3 2.5 L4.3 -2.5"/></g></svg>`,
};

const COLORS = {
  confetti: ['#F9736B', '#FFD166', '#7BD389', '#5EB7F0', '#B48CF2', '#FF9FC8'],
  stars: ['#FFD95A', '#FFE9A3', '#FFC53D'],
  hearts: ['#F0607E', '#FF8FAB', '#E84A6F'],
  fish: ['#4FA8DD', '#7CC3EE', '#F2A65A'],
  petals: ['#F7A8C4', '#FFD1DF', '#F48FB1', '#FFFFFF'],
  snow: ['#FFFFFF', '#D8ECFA', '#BFE0F7'],
};

function isReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// kind — вид частиц, origin — { x, y, size } центр и размер поля в пикселях.
// options.count — сколько частиц (по умолчанию залп победы, 36).
export function burst(kind, origin, options = {}) {
  if (isReducedMotion() || !origin || typeof document.body.animate !== 'function') return;
  const name = Object.prototype.hasOwnProperty.call(SHAPES, kind) ? kind : 'confetti';
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  document.body.append(layer);

  const count = options.count || BIT_COUNT;
  const spread = Math.max(options.count ? 60 : 120, origin.size * 0.75);
  for (let k = 0; k < count; k++) {
    const bit = document.createElement('span');
    bit.className = 'fx-bit';
    bit.innerHTML = SHAPES[name](pick(COLORS[name]));
    const size = 16 + Math.random() * 16;
    bit.style.width = size + 'px';
    bit.style.height = size + 'px';
    layer.append(bit);

    const angle = Math.random() * Math.PI * 2;
    const distance = spread * (0.35 + Math.random() * 0.65);
    const x0 = origin.x - size / 2;
    const y0 = origin.y - size / 2;
    const x1 = x0 + Math.cos(angle) * distance;
    const y1 = y0 + Math.sin(angle) * distance - spread * 0.25;
    const turn = (Math.random() - 0.5) * 720;
    bit.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.3) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${x1}px, ${y1}px) scale(1) rotate(${turn / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1 + spread * 0.6}px) scale(0.9) rotate(${turn}deg)`, opacity: 0 },
      ],
      { duration: LIFE_MS * (0.8 + Math.random() * 0.3), easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' }
    );
  }
  window.setTimeout(() => layer.remove(), LAYER_MS);
}

// Центр элемента на экране.
function centerOf(node) {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const FLY_SIZE_PX = 34;
const FLY_MS = 620;
const FLY_STEP_MS = 85;

// Значки (html) летят дугой из элемента from в элемент to, по одному с небольшой паузой.
// onEach(k) вызывается, когда долетел очередной значок. Возвращает Promise — всё долетело.
// Без анимаций (prefers-reduced-motion) onEach вызывается сразу для каждого значка.
export function flyTo(from, to, html, count, onEach) {
  const done = (k) => {
    if (onEach) onEach(k);
  };
  if (isReducedMotion() || !from || !to || typeof document.body.animate !== 'function') {
    for (let k = 0; k < count; k++) done(k);
    return Promise.resolve();
  }
  const start = centerOf(from);
  const end = centerOf(to);
  const layer = document.createElement('div');
  layer.className = 'fx-layer fx-fly';
  document.body.append(layer);
  const jobs = [];
  for (let k = 0; k < count; k++) {
    const bit = document.createElement('span');
    bit.className = 'fx-bit';
    bit.innerHTML = html;
    bit.style.width = FLY_SIZE_PX + 'px';
    bit.style.height = FLY_SIZE_PX + 'px';
    layer.append(bit);
    const half = FLY_SIZE_PX / 2;
    const jitterX = (Math.random() - 0.5) * 70;
    const jitterY = (Math.random() - 0.5) * 40;
    const x0 = start.x - half + jitterX;
    const y0 = start.y - half + jitterY;
    const x1 = end.x - half;
    const y1 = end.y - half;
    const midX = (x0 + x1) / 2 + (Math.random() - 0.5) * 80;
    const midY = Math.min(y0, y1) - 60 - Math.random() * 40;
    const animation = bit.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.2)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 14}px) scale(1.15)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${midX}px, ${midY}px) scale(1) rotate(-12deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.55) rotate(8deg)`, opacity: 0.9 },
      ],
      { duration: FLY_MS, delay: k * FLY_STEP_MS, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' }
    );
    jobs.push(
      animation.finished.then(() => {
        bit.remove();
        done(k);
      })
    );
  }
  return Promise.all(jobs).finally(() => layer.remove());
}

// «Пружинка» элемента: класс is-bump на короткое время (CSS-анимация bump).
export function bump(node) {
  if (!node) return;
  node.classList.remove('is-bump');
  void node.offsetWidth;
  node.classList.add('is-bump');
}
