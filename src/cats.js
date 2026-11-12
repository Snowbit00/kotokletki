// Котики в стиле чиби: большая круглая голова, огромные блестящие глаза,
// маленькое тельце. Рисуются программно по параметрам из content.json.
//
// Два вида (options.pose):
//   'face' — голова с лапками, выглядывающими снизу (для клеток поля, 100×100);
//   'full' — котик целиком: голова, тельце, хвост (дом, магазин, победа, 100×130).
// options.happy — довольная мордочка; options.effects — эффект скина;
// options.animate — моргание, покачивание и хвост (только для крупных котиков).
//
// Поля записи в content.json → cats (все необязательные, кроме id и name):
//   fur, light, eyes, eyes2, nose      — цвета шерсти, мордочки, глаз (eyes2 — правый глаз)
//   pattern: solid | tabby | spots | calico | tuxedo | siamese | mask
//   pattern1, pattern2                 — цвета окраса
//   eyeStyle: round | sleepy | sparkly | cat
//   accessories: [...]                 — список (старое поле accessory тоже читается)
//   accent, accent2                    — цвета аксессуаров
//   effect: sparkle | hearts | glow | snow
//   file: "имя.svg"                    — готовая картинка из assets/cats/ вместо рисунка

const INK = '#3A2418';
const PINK = '#F59AAE';
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const FILE_RE = /^[\w-]+\.svg$/;

// Голова-«моти»: щёки шире лба. Уши с округлыми кончиками. Хохолок на макушке.
const HEAD = 'M50 30 C72 30 89 42 89.5 60 C90 79 73 91 50 91 C27 91 10 79 10.5 60 C11 42 28 30 50 30 Z';
const EAR_L = 'M14 49 Q11 27 19 14 Q23 8 29 12 Q39 20 48 31 Z';
const EAR_R = 'M86 49 Q89 27 81 14 Q77 8 71 12 Q61 20 52 31 Z';
const EAR_IN_L = 'M21 40 Q20 27 24 19 Q27 16.5 30.5 20 Q36 25.5 40 32 Z';
const EAR_IN_R = 'M79 40 Q80 27 76 19 Q73 16.5 69.5 20 Q64 25.5 60 32 Z';
const TUFT = 'M42 33 Q44 24 48 31 Q50 22 53 31 Q57 25 58 33 Z';
// Лапки, выглядывающие снизу (вид 'face').
const PAWS = '<ellipse cx="36" cy="90" rx="9" ry="6.5"/><ellipse cx="64" cy="90" rx="9" ry="6.5"/>';
// Тельце (вид 'full'): сидящий котик, хвост колечком.
const BODY = 'M27 124 C22 104 31 84 50 84 C69 84 78 104 73 124 Z';
const FEET = '<ellipse cx="39" cy="124" rx="9.5" ry="5.6"/><ellipse cx="61" cy="124" rx="9.5" ry="5.6"/>';
const TAIL = 'M70 118 C90 120 96 100 86 88 C82 83 77 85 79 90';
const EFFECTS = ['sparkle', 'hearts', 'glow', 'snow'];

let uid = 0;

// ---------- Цвета ----------

function color(value, fallback) {
  return typeof value === 'string' && COLOR_RE.test(value) ? value : fallback;
}

function rgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Смесь двух цветов: t = 0 — первый, t = 1 — второй.
function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------- Окрас: рисуется внутри головы и ушей (clipPath) ----------

const PATTERNS = {
  tabby(p1) {
    return (
      `<g fill="none" stroke="${p1}" stroke-linecap="round" stroke-width="4.2">` +
      '<path d="M50 32 L50 42"/><path d="M41.5 34 L43.5 43"/><path d="M58.5 34 L56.5 43"/>' +
      '<path d="M11 57 L22 60"/><path d="M12 66 L22 66.5"/><path d="M89 57 L78 60"/><path d="M88 66 L78 66.5"/>' +
      '<path d="M20 20 L28 27"/><path d="M80 20 L72 27"/></g>'
    );
  },
  spots(p1) {
    const spots = [
      [28, 42, 7],
      [71, 39, 5.5],
      [83, 66, 5.5],
      [17, 75, 5.5],
      [66, 86, 4.5],
      [23, 23, 4.5],
    ];
    return `<g fill="${p1}">${spots.map((s) => `<circle cx="${s[0]}" cy="${s[1]}" r="${s[2]}"/>`).join('')}</g>`;
  },
  calico(p1, p2) {
    return (
      `<path d="M4 6 L48 22 L44 50 L22 60 L4 52 Z" fill="${p1}"/>` +
      `<ellipse cx="73" cy="42" rx="13" ry="10" fill="${p2}"/>` +
      `<ellipse cx="82" cy="83" rx="15" ry="11" fill="${p1}"/>` +
      `<path d="M66 4 L95 15 L88 34 L70 28 Z" fill="${p2}"/>`
    );
  },
  tuxedo(p1) {
    return (
      `<path d="M50 52 C30 52 18 74 18 98 L82 98 C82 74 70 52 50 52 Z" fill="${p1}"/>` +
      `<path d="M50 30 L44 54 L56 54 Z" fill="${p1}"/>`
    );
  },
  siamese(p1) {
    return (
      `<g fill="${p1}"><path d="${EAR_L}"/><path d="${EAR_R}"/></g>` +
      `<ellipse cx="50" cy="73" rx="21" ry="16" fill="${p1}" opacity="0.8"/>`
    );
  },
  mask(p1) {
    return `<path d="M8 54 Q50 42 92 54 L92 68 Q50 58 8 68 Z" fill="${p1}"/>`;
  },
};

// ---------- Глаза ----------

const EYES = [
  [35, 61],
  [65, 61],
];

function irisGradients(id, eyeColors) {
  return eyeColors
    .map(
      (c, k) =>
        `<linearGradient id="${id}i${k}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0.15" stop-color="${mix(c, '#140C08', 0.7)}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
    )
    .join('');
}

function oneEye(style, id, k, x, y, lid) {
  const iris = `url(#${id}i${k})`;
  if (style === 'sleepy') {
    // Полуприкрытые глаза: верхнее веко цвета шерсти.
    return (
      `<ellipse cx="${x}" cy="${y + 1}" rx="6.6" ry="6.4" fill="${iris}"/>` +
      `<circle cx="${x + 2}" cy="${y + 2.4}" r="1.6" fill="#FFFFFF"/>` +
      `<path d="M${x - 8} ${y - 6.5} L${x + 8} ${y - 6.5} L${x + 8} ${y + 0.6} Q${x} ${y - 1.6} ${x - 8} ${y + 0.6} Z" fill="${lid}"/>` +
      `<path d="M${x - 7} ${y + 0.4} Q${x} ${y - 1.8} ${x + 7} ${y + 0.4}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
    );
  }
  if (style === 'cat') {
    return (
      `<ellipse cx="${x}" cy="${y}" rx="6.8" ry="7.8" fill="${iris}"/>` +
      `<ellipse cx="${x}" cy="${y + 0.4}" rx="1.9" ry="6" fill="#1A110C"/>` +
      `<ellipse cx="${x + 2.4}" cy="${y - 3}" rx="2.1" ry="2.5" fill="#FFFFFF"/>` +
      `<circle cx="${x - 2.6}" cy="${y + 3.4}" r="1" fill="#FFFFFF" opacity="0.9"/>`
    );
  }
  const big = style === 'sparkly';
  const rx = big ? 7.4 : 6.8;
  const ry = big ? 8.4 : 7.8;
  return (
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${iris}"/>` +
    `<ellipse cx="${x + 2.4}" cy="${y - 3}" rx="${big ? 2.8 : 2.5}" ry="${big ? 3.2 : 2.9}" fill="#FFFFFF"/>` +
    `<circle cx="${x - 2.6}" cy="${y + 3.3}" r="${big ? 1.5 : 1.2}" fill="#FFFFFF" opacity="0.95"/>` +
    (big ? `<path d="M${x + 3.6} ${y + 1.2} l0.7 1.6 1.6 0.7 -1.6 0.7 -0.7 1.6 -0.7 -1.6 -1.6 -0.7 1.6 -0.7 Z" fill="#FFFFFF"/>` : '')
  );
}

function eyesSvg(style, id, isHappy, lid, isAnimated) {
  if (isHappy) {
    return (
      `<g fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round">` +
      '<path d="M28.5 62.5 Q35 54 41.5 62.5"/><path d="M58.5 62.5 Q65 54 71.5 62.5"/></g>'
    );
  }
  const eyes = EYES.map(([x, y], k) => oneEye(style, id, k, x, y, lid)).join('');
  return isAnimated && style !== 'sleepy' ? `<g class="kc-blink">${eyes}</g>` : eyes;
}

function mouthSvg(isHappy, nose) {
  const noseSvg = `<path d="M46.8 68.4 Q50 66.6 53.2 68.4 Q51.6 71.4 50 71.6 Q48.4 71.4 46.8 68.4 Z" fill="${nose}"/>`;
  if (isHappy) {
    return (
      noseSvg +
      '<path d="M44.5 72.6 Q50 81.5 55.5 72.6 Q50 75 44.5 72.6 Z" fill="#7A2E2E"/>' +
      '<path d="M47 76.6 Q50 79.6 53 76.6 Q50 75.4 47 76.6 Z" fill="#F07C93"/>' +
      `<path d="M50 71.6 L50 73.4" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`
    );
  }
  return (
    noseSvg +
    `<g fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round">` +
    '<path d="M50 71.6 Q48.8 75.4 45.6 74.4"/><path d="M50 71.6 Q51.2 75.4 54.4 74.4"/></g>'
  );
}

// ---------- Аксессуары: функция получает (accent, accent2) ----------

const STROKE = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
const GLOSS = 'fill="#FFFFFF" opacity="0.45"';

const ACCESSORIES = {
  bow(a) {
    return (
      `<g ${STROKE} fill="${a}">` +
      '<path d="M75 24 Q66 12 59 15 Q56 24 59 33 Q66 36 75 24 Z"/><path d="M75 24 Q84 12 91 15 Q94 24 91 33 Q84 36 75 24 Z"/>' +
      '<circle cx="75" cy="24" r="4.6"/></g>' +
      `<ellipse cx="62.5" cy="20" rx="2" ry="3" ${GLOSS}/><ellipse cx="87.5" cy="20" rx="2" ry="3" ${GLOSS}/>`
    );
  },
  cap(a) {
    return (
      `<g ${STROKE}><path d="M29 34 Q50 7 71 34 Z" fill="#FFFFFF"/>` +
      `<rect x="25" y="30" width="50" height="8.5" rx="4.2" fill="${a}"/></g>` +
      `<circle cx="50" cy="12" r="3.2" fill="${a}" ${STROKE}/>`
    );
  },
  glasses(a) {
    return (
      `<g stroke="${a}" stroke-width="2.8" fill="rgba(255,255,255,0.25)">` +
      '<circle cx="35" cy="61" r="10.5"/><circle cx="65" cy="61" r="10.5"/><path d="M45.5 59 Q50 56.5 54.5 59" fill="none"/></g>' +
      '<path d="M29 56 L33 53" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>'
    );
  },
  crown(a) {
    return (
      `<g ${STROKE}><path d="M31 35 L32 13 L42 25 L50 8 L58 25 L68 13 L69 35 Q50 39 31 35 Z" fill="${a}"/></g>` +
      '<circle cx="50" cy="27" r="3" fill="#E0445C"/><circle cx="39" cy="30" r="2" fill="#4FA8DD"/><circle cx="61" cy="30" r="2" fill="#4FA8DD"/>' +
      '<g fill="#FFF3B0" stroke="#4A3426" stroke-width="1.4"><circle cx="32" cy="12" r="2.4"/><circle cx="50" cy="7" r="2.4"/><circle cx="68" cy="12" r="2.4"/></g>' +
      '<path d="M36 22 L37 31" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>'
    );
  },
  santa(a) {
    return (
      `<g ${STROKE}><path d="M28 34 Q42 0 70 14 Q76 22 72 34 Z" fill="${a}"/>` +
      '<rect x="23" y="29" width="54" height="11" rx="5.5" fill="#FFFFFF"/>' +
      '<circle cx="73" cy="13" r="6.5" fill="#FFFFFF"/></g>'
    );
  },
  flower(a) {
    const petals = [
      [75, 16],
      [83, 22],
      [80, 31.5],
      [70, 31.5],
      [67, 22],
    ];
    const circles = petals.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="5.6"/>`).join('');
    return `<g stroke="${INK}" stroke-width="1.8" fill="${a}">${circles}<circle cx="75" cy="24.5" r="4.2" fill="#F28C28"/></g>`;
  },
  witch(a) {
    return (
      `<g ${STROKE} fill="${a}">` +
      '<path d="M35 32 Q46 16 52 2 Q57 4 58 10 Q62 22 67 32 Z"/><ellipse cx="50" cy="33" rx="33" ry="7"/>' +
      '<path d="M39 25 L62 25 L64.5 30 L36.5 30 Z" fill="#F2B705" stroke="none"/></g>'
    );
  },
  scarf(a, b) {
    return (
      `<g ${STROKE}><path d="M19 83 Q50 97 81 83 L82 91 Q50 103 18 91 Z" fill="${a}"/>` +
      `<path d="M64 89 L67 100 L77 99 L73 87 Z" fill="${a}"/></g>` +
      `<g stroke="${b}" stroke-width="2.4" stroke-linecap="round"><path d="M30 89 L31.5 94"/><path d="M43 91 L44 97"/><path d="M57 91 L56 97"/></g>`
    );
  },
  headphones(a, b) {
    return (
      `<path d="M14 61 Q11 15 50 13 Q89 15 86 61" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="M14 61 Q11 15 50 13 Q89 15 86 61" fill="none" stroke="${a}" stroke-width="4.4" stroke-linecap="round"/>` +
      `<g ${STROKE} fill="${a}"><rect x="3" y="50" width="15" height="24" rx="7"/><rect x="82" y="50" width="15" height="24" rx="7"/></g>` +
      `<g fill="${b}"><rect x="6.5" y="56" width="8" height="12" rx="3.5"/><rect x="85.5" y="56" width="8" height="12" rx="3.5"/></g>`
    );
  },
  tophat(a) {
    return (
      `<g ${STROKE}><path d="M36 4 Q50 1 64 4 L63 29 L37 29 Z" fill="#2E2A33"/>` +
      '<rect x="26" y="27" width="48" height="7.5" rx="3.7" fill="#2E2A33"/></g>' +
      `<rect x="37.3" y="21" width="25.4" height="5" fill="${a}"/>` +
      '<path d="M41 7 L41 18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.35"/>'
    );
  },
  chef() {
    return (
      `<g ${STROKE}><path d="M32 35 L32 23 Q22 19 28 9 Q35 1 44 7 Q50 -1 57 7 Q66 1 72 9 Q78 19 68 23 L68 35 Z" fill="#FFFFFF"/>` +
      '<path d="M32 29 L68 29" fill="none"/></g>'
    );
  },
  pirate(a) {
    return (
      `<path d="M12 43 L88 72" stroke="${INK}" stroke-width="2.6"/>` +
      `<ellipse cx="35" cy="60" rx="10" ry="9" fill="#231C20" ${STROKE}/>` +
      `<g ${STROKE} fill="${a}"><path d="M22 37 Q50 13 78 37 L75 42.5 Q50 27 25 42.5 Z"/></g>` +
      '<g fill="#FFFFFF"><circle cx="41" cy="31" r="1.9"/><circle cx="52" cy="28" r="1.9"/><circle cx="63" cy="31" r="1.9"/></g>'
    );
  },
  bell(a) {
    return (
      `<path d="M23 85 Q50 98 77 85" fill="none" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/>` +
      `<path d="M23 85 Q50 98 77 85" fill="none" stroke="${a}" stroke-width="4.2" stroke-linecap="round"/>` +
      `<circle cx="50" cy="94" r="6" fill="#F7C531" ${STROKE}/>` +
      '<path d="M50 94.5 L50 99.5" stroke="#4A3426" stroke-width="1.6"/><circle cx="48" cy="92" r="1.5" fill="#FFFFFF" opacity="0.7"/>'
    );
  },
  sunglasses(a) {
    return (
      `<g fill="#1F1B24" stroke="${a}" stroke-width="2.2"><rect x="22" y="53" width="25" height="16" rx="7.5"/><rect x="53" y="53" width="25" height="16" rx="7.5"/></g>` +
      `<path d="M47 58 Q50 56 53 58" fill="none" stroke="${a}" stroke-width="2.4"/>` +
      '<g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.8"><path d="M27 57 L33 57"/><path d="M58 57 L64 57"/></g>'
    );
  },
  wreath(a, b) {
    const flowers = [
      [26, 36, a],
      [37, 30.5, b],
      [50, 28.5, a],
      [63, 30.5, b],
      [74, 36, a],
    ];
    const leaves =
      '<g fill="#6BAA4E"><ellipse cx="31" cy="35" rx="4.4" ry="2.2" transform="rotate(-30 31 35)"/>' +
      '<ellipse cx="44" cy="30.5" rx="4.4" ry="2.2" transform="rotate(-12 44 30.5)"/><ellipse cx="56" cy="30.5" rx="4.4" ry="2.2" transform="rotate(12 56 30.5)"/>' +
      '<ellipse cx="69" cy="35" rx="4.4" ry="2.2" transform="rotate(30 69 35)"/></g>';
    const blooms = flowers
      .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="${INK}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="1.8" fill="#FFE27A"/>`)
      .join('');
    return leaves + blooms;
  },
  astronaut(a) {
    return (
      `<circle cx="50" cy="56" r="46" fill="rgba(190,225,255,0.2)" stroke="${a}" stroke-width="3.6"/>` +
      '<path d="M20 34 Q29 17 48 13" fill="none" stroke="#FFFFFF" stroke-width="4.4" stroke-linecap="round" opacity="0.85"/>' +
      '<circle cx="80" cy="34" r="2.4" fill="#FFFFFF" opacity="0.8"/>'
    );
  },
  bandana(a, b) {
    return (
      `<g ${STROKE} fill="${a}"><path d="M22 38 Q50 14 78 38 L74 43 Q50 27 26 43 Z"/>` +
      '<path d="M76 39 L88 33 L85 45 Z"/><path d="M77 41 L86 49 L78 51 Z"/></g>' +
      `<g fill="${b}"><circle cx="38" cy="32" r="1.7"/><circle cx="50" cy="28" r="1.7"/><circle cx="62" cy="32" r="1.7"/><circle cx="44" cy="36.5" r="1.4"/><circle cx="56" cy="36.5" r="1.4"/></g>`
    );
  },
  halo() {
    return (
      '<ellipse cx="50" cy="8" rx="18" ry="4.8" fill="none" stroke="#B8860B" stroke-width="6.2"/>' +
      '<ellipse cx="50" cy="8" rx="18" ry="4.8" fill="none" stroke="#FFDD66" stroke-width="3.4"/>'
    );
  },
};

// ---------- Эффекты вокруг кота ----------

const STAR_PATH = 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z';
const HEART_PATH = 'M0 3.5 C-5 0 -5 -4.5 -2.2 -4.5 C-1 -4.5 0 -3.6 0 -2.6 C0 -3.6 1 -4.5 2.2 -4.5 C5 -4.5 5 0 0 3.5 Z';

function effectSvg(name, id, height) {
  if (name === 'sparkle') {
    const spots = [
      [8, 24, 1],
      [92, 30, 0.8],
      [10, height - 14, 0.7],
      [90, height - 18, 1],
      [50, 4, 0.6],
    ];
    return spots
      .map(([x, y, s], k) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="fx-twinkle" style="animation-delay:${k * 0.35}s" d="${STAR_PATH}" fill="#FFD95A" stroke="#E0A800" stroke-width="0.8"/></g>`)
      .join('');
  }
  if (name === 'hearts') {
    const spots = [
      [11, 42],
      [89, 46],
      [14, height - 12],
      [86, height - 10],
    ];
    return spots
      .map(([x, y], k) => `<g transform="translate(${x} ${y})"><path class="fx-float" style="animation-delay:${k * 0.5}s" d="${HEART_PATH}" fill="#F0607E"/></g>`)
      .join('');
  }
  if (name === 'snow') {
    const flakes = [
      [10, 0],
      [26, 0.8],
      [74, 0.4],
      [90, 1.2],
      [50, 1.8],
      [36, 2.4],
    ];
    return flakes
      .map(([x, delay]) => `<circle class="fx-fall" style="animation-delay:${delay}s" cx="${x}" cy="-4" r="2.3" fill="#FFFFFF" stroke="#BFD7EA" stroke-width="0.6"/>`)
      .join('');
  }
  if (name === 'glow') {
    return `<circle class="fx-glow" cx="50" cy="${height / 2}" r="${height / 2 - 2}" fill="url(#${id}g)"/>`;
  }
  return '';
}

function accessoryList(cat) {
  if (!cat) return [];
  const list = Array.isArray(cat.accessories) ? cat.accessories : cat.accessory ? [cat.accessory] : [];
  return list.filter((name) => typeof name === 'string' && Object.prototype.hasOwnProperty.call(ACCESSORIES, name));
}

// ---------- Сборка ----------

// Силуэт с общим контуром: сначала всё толстой линией цвета контура, потом заливки.
function silhouette(shapes, fill, outline, width) {
  return (
    `<g fill="${outline}" stroke="${outline}" stroke-width="${width}" stroke-linejoin="round">${shapes}</g>` +
    `<g fill="${fill}">${shapes}</g>`
  );
}

// Тельце сидящего котика с хвостом (вид 'full').
function bodySvg(id, fur, light, outline, isAnimated) {
  const tail =
    `<g class="${isAnimated ? 'kc-tail' : ''}">` +
    `<path d="${TAIL}" fill="none" stroke="${outline}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="${TAIL}" fill="none" stroke="${fur}" stroke-width="7" stroke-linecap="round"/></g>`;
  return (
    tail +
    silhouette(`<path d="${BODY}"/>${FEET}`, `url(#${id}t)`, outline, 6) +
    `<ellipse cx="50" cy="108" rx="13" ry="14" fill="${light}"/>` +
    `<g fill="${light}"><ellipse cx="39" cy="125" rx="6" ry="3.4"/><ellipse cx="61" cy="125" rx="6" ry="3.4"/></g>` +
    `<g stroke="${outline}" stroke-width="1.4" stroke-linecap="round" opacity="0.6"><path d="M36 125.6 L36 128.4"/><path d="M42 125.6 L42 128.4"/><path d="M58 125.6 L58 128.4"/><path d="M64 125.6 L64 128.4"/></g>`
  );
}

function headSvg(cat, c, id, options, isAnimated) {
  const pattern = cat && Object.prototype.hasOwnProperty.call(PATTERNS, cat.pattern) ? PATTERNS[cat.pattern](c.p1, c.p2) : '';
  const accessories = accessoryList(cat)
    .map((name) => ACCESSORIES[name](c.accent, c.accent2))
    .join('');
  const shapes = `<path d="${EAR_L}"/><path d="${EAR_R}"/><path d="${TUFT}"/><path d="${HEAD}"/>`;
  return (
    silhouette(shapes, `url(#${id}h)`, c.outline, 6) +
    (pattern ? `<g clip-path="url(#${id}c)">${pattern}</g>` : '') +
    `<g fill="${PINK}" opacity="0.9"><path d="${EAR_IN_L}"/><path d="${EAR_IN_R}"/></g>` +
    `<ellipse cx="50" cy="74" rx="14.5" ry="10.5" fill="${c.light}"/>` +
    '<ellipse cx="38" cy="41" rx="9" ry="4.6" fill="#FFFFFF" opacity="0.25" transform="rotate(-18 38 41)"/>' +
    `<ellipse cx="22.5" cy="72" rx="7.5" ry="5" fill="url(#${id}b)"/><ellipse cx="77.5" cy="72" rx="7.5" ry="5" fill="url(#${id}b)"/>` +
    eyesSvg(cat && cat.eyeStyle, id, options.happy === true, `url(#${id}h)`, isAnimated) +
    mouthSvg(options.happy === true, c.nose) +
    `<g stroke="${c.outline}" stroke-width="1.5" stroke-linecap="round" opacity="0.45">` +
    '<path d="M21 70 L11 68"/><path d="M21 74.5 L11 76.5"/><path d="M79 70 L89 68"/><path d="M79 74.5 L89 76.5"/></g>' +
    accessories
  );
}

function colorsOf(cat) {
  const fur = color(cat && cat.fur, '#F2A65A');
  const eye = color(cat && cat.eyes, '#4A3426');
  return {
    fur,
    light: color(cat && cat.light, '#FFE4C4'),
    eye,
    eye2: color(cat && cat.eyes2, eye),
    nose: color(cat && cat.nose, '#E8657F'),
    p1: color(cat && cat.pattern1, INK),
    p2: color(cat && cat.pattern2, '#FFFFFF'),
    accent: color(cat && cat.accent, PINK),
    accent2: color(cat && cat.accent2, '#FFFFFF'),
    outline: mix(fur, '#2A170E', 0.72),
    highlight: mix(fur, '#FFFFFF', 0.45),
    shade: mix(fur, '#3A2418', 0.22),
  };
}

// Возвращает SVG-разметку котика.
export function catSvg(cat, options = {}) {
  if (cat && typeof cat.file === 'string' && FILE_RE.test(cat.file)) {
    return `<img class="cat" src="assets/cats/${cat.file}" alt="" draggable="false">`;
  }
  const id = 'kc' + ++uid;
  const isFull = options.pose === 'full';
  const isAnimated = options.animate === true;
  const height = isFull ? 130 : 100;
  const c = colorsOf(cat);
  const effectName = options.effects && cat && EFFECTS.includes(cat.effect) ? cat.effect : '';

  const defs =
    '<defs>' +
    `<clipPath id="${id}c"><path d="${HEAD}"/><path d="${EAR_L}"/><path d="${EAR_R}"/><path d="${TUFT}"/></clipPath>` +
    // Свет на голове задан в координатах рисунка: так веко сонных глаз
    // окрашивается тем же градиентом и сливается с головой.
    `<radialGradient id="${id}h" gradientUnits="userSpaceOnUse" cx="40" cy="42" r="58"><stop offset="0" stop-color="${c.highlight}"/><stop offset="0.55" stop-color="${c.fur}"/><stop offset="1" stop-color="${c.shade}"/></radialGradient>` +
    `<radialGradient id="${id}t" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="${c.highlight}"/><stop offset="0.55" stop-color="${c.fur}"/><stop offset="1" stop-color="${c.shade}"/></radialGradient>` +
    `<radialGradient id="${id}b" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${PINK}" stop-opacity="0.75"/><stop offset="1" stop-color="${PINK}" stop-opacity="0"/></radialGradient>` +
    irisGradients(id, [c.eye, c.eye2]) +
    (effectName === 'glow'
      ? `<radialGradient id="${id}g"><stop offset="0.5" stop-color="${c.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient>`
      : '') +
    '</defs>';

  const head = headSvg(cat, c, id, options, isAnimated);
  const paws = isFull
    ? ''
    : silhouette(PAWS, c.fur, c.outline, 5) +
      `<g stroke="${c.outline}" stroke-width="1.4" stroke-linecap="round" opacity="0.6"><path d="M33 93.5 L33 96"/><path d="M39 93.5 L39 96"/><path d="M61 93.5 L61 96"/><path d="M67 93.5 L67 96"/></g>`;
  const ground = isFull
    ? '<ellipse cx="50" cy="127" rx="30" ry="3" fill="rgba(60,30,20,0.16)"/>'
    : '<ellipse cx="50" cy="96.5" rx="30" ry="3.2" fill="rgba(60,30,20,0.14)"/>';
  const behind = effectName === 'glow' ? effectSvg('glow', id, height) : '';
  const front = effectName && effectName !== 'glow' ? effectSvg(effectName, id, height) : '';

  return (
    `<svg class="cat${isFull ? ' cat-full' : ''}" viewBox="0 0 100 ${height}" aria-hidden="true">${defs}${behind}${ground}` +
    (isFull ? bodySvg(id, c.fur, c.light, c.outline, isAnimated) : '') +
    (isAnimated ? `<g class="kc-head">${head}</g>` : head) +
    paws +
    front +
    '</svg>'
  );
}
