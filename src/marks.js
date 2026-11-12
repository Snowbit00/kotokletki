// Рисунки меток «пусто». Каталог с ценами — content.json → marks, здесь только формы.
//
// Каждая форма — SVG 24×24. CSS вырезает по ней метку маской: важна только
// непрозрачность, цвет метки берётся из темы поля (--mark), поэтому метка видна
// на любом оформлении. Дырки (окна машинки, глаза черепа) — через <mask> внутри SVG.
// Точка рисуется самим CSS (кружок), рисунка у неё нет.

const DOT = 'dot';
const HOLE_MASK = (id, holes) =>
  `<defs><mask id='${id}'><rect width='24' height='24' fill='#fff'/><g fill='#000'>${holes}</g></mask></defs>`;

const SKULL = 'M12 2a6.6 6.6 0 0 0-6.6 6.6c0 2.3 1.1 3.9 2.7 4.8v2.1c0 .6.4 1 1 1h5.8c.6 0 1-.4 1-1v-2.1c1.6-.9 2.7-2.5 2.7-4.8A6.6 6.6 0 0 0 12 2z';
const CAR_BODY =
  'M2 15.6v-3c0-.9.6-1.6 1.5-1.8L7.2 10l2.4-3.6c.4-.6 1-.9 1.7-.9h4.6c.7 0 1.3.3 1.7.9L20 10l.9.3c.7.3 1.1.9 1.1 1.6v3.7c0 .5-.4.9-.9.9H2.9c-.5 0-.9-.4-.9-.9z';

const SHAPES = {
  [DOT]: '',
  cross: "<path d='M5 5L19 19M19 5L5 19' stroke='#000' stroke-width='4.5' stroke-linecap='round'/>",
  paw:
    "<circle cx='5.4' cy='10' r='2.5'/><circle cx='9.6' cy='5.6' r='2.5'/><circle cx='14.4' cy='5.6' r='2.5'/><circle cx='18.6' cy='10' r='2.5'/>" +
    "<path d='M12 11.5c3 0 5.8 2.9 5.8 5.3S15.3 20.5 12 20.5s-5.8-1.3-5.8-3.7S9 11.5 12 11.5z'/>",
  fish: "<path d='M2 12c3-5.2 9.2-6.3 13.5-3.2L22 4.5v15l-6.5-4.3C11.2 18.3 5 17.2 2 12z'/>",
  heart: "<path d='M12 21s-8.5-5.3-8.5-11.2A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.5 2.7C20.5 15.7 12 21 12 21z'/>",
  star: "<path d='M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z'/>",

  bone:
    "<g transform='rotate(-45 12 12)'><rect x='5' y='10' width='14' height='4' rx='1'/>" +
    "<circle cx='5' cy='9.2' r='3'/><circle cx='5' cy='14.8' r='3'/><circle cx='19' cy='9.2' r='3'/><circle cx='19' cy='14.8' r='3'/></g>",
  // Собачий след: пальцы вытянутые, с когтями, подушечка треугольная.
  dogpaw:
    "<path d='M12 11c-3.8 0-6.6 3.6-6.6 6.2 0 2.1 1.6 3.3 3.4 3.3 1.3 0 2.1-.8 3.2-.8s1.9.8 3.2.8c1.8 0 3.4-1.2 3.4-3.3 0-2.6-2.8-6.2-6.6-6.2z'/>" +
    "<ellipse cx='4.6' cy='9.6' rx='2' ry='2.9' transform='rotate(-28 4.6 9.6)'/><ellipse cx='9.2' cy='5.4' rx='2.1' ry='3.1' transform='rotate(-10 9.2 5.4)'/>" +
    "<ellipse cx='14.8' cy='5.4' rx='2.1' ry='3.1' transform='rotate(10 14.8 5.4)'/><ellipse cx='19.4' cy='9.6' rx='2' ry='2.9' transform='rotate(28 19.4 9.6)'/>" +
    "<path d='M4.2 7.2L2.4 5.5l.4 2.5zM19.8 7.2l1.8-1.7-.4 2.5zM9.6 2.8L8.4.7 8 3.1zM14.4 2.8L15.6.7 16 3.1z'/>",
  mouse:
    HOLE_MASK('m', "<circle cx='17.6' cy='12.9' r='1'/>") +
    "<g mask='url(#m)'><path d='M2.5 16.5C2.5 11.5 6.5 8.5 11.5 8.5c4 0 7 2.3 10 6-2 1.7-4.5 2.5-8 2.5H3.5c-.6 0-1-.2-1-.5z'/>" +
    "<circle cx='13.4' cy='8.4' r='3.3'/></g>" +
    "<path d='M3.2 16.2C.6 17 1.2 21 4.6 20.4c2-.4 3.2.3 4.8 1' fill='none' stroke='#000' stroke-width='1.7' stroke-linecap='round'/>",
  yarn:
    HOLE_MASK(
      'm',
      "<path fill='none' stroke='#000' stroke-width='1.5' d='M3.5 9.5C7 9.8 10.5 13 11.5 18.8M6.5 4.4c4.3.6 8.6 4.7 9.8 11.5M12 3.1c3.4 1.4 6 4.6 6.8 8.4'/>"
    ) +
    "<circle cx='11' cy='11' r='8' mask='url(#m)'/>" +
    "<path d='M16.6 16.6c1.8 2 3.6 3.2 5.6 3.6' fill='none' stroke='#000' stroke-width='1.7' stroke-linecap='round'/>",
  flower:
    HOLE_MASK('m', "<circle cx='12' cy='12' r='3.7' fill='none' stroke='#000' stroke-width='1.2'/>") +
    "<g mask='url(#m)'><circle cx='12' cy='6.4' r='3.8'/><circle cx='17.3' cy='10.3' r='3.8'/><circle cx='15.3' cy='16.5' r='3.8'/>" +
    "<circle cx='8.7' cy='16.5' r='3.8'/><circle cx='6.7' cy='10.3' r='3.8'/><circle cx='12' cy='12' r='3.2'/></g>",
  anchor:
    "<g fill='none' stroke='#000' stroke-width='2.2' stroke-linecap='round'><circle cx='12' cy='4.6' r='2.3'/>" +
    "<path d='M12 7v14M7.5 10.5h9M4.5 14.5c.6 4.2 3.8 6.5 7.5 6.5s6.9-2.3 7.5-6.5'/></g>" +
    "<path d='M2.6 15.8l1.9-3.6 2.3 3.2zM21.4 15.8l-1.9-3.6-2.3 3.2z'/>",

  // Машинка: окна — дырки, колёса отделены от кузова зазором, у колёс ступицы.
  car:
    "<defs><mask id='b'><rect width='24' height='24' fill='#fff'/><g fill='#000'>" +
    "<path d='M10.2 7.1h2.5v2.8H8.4zM14 7.1h1.7c.4 0 .7.2.9.5l1.4 2.3H14z'/><circle cx='6.8' cy='16.6' r='3.6'/><circle cx='17.2' cy='16.6' r='3.6'/></g></mask>" +
    "<mask id='w'><rect width='24' height='24' fill='#fff'/><circle cx='6.8' cy='16.6' r='1' fill='#000'/><circle cx='17.2' cy='16.6' r='1' fill='#000'/></mask></defs>" +
    `<path mask='url(#b)' d='${CAR_BODY}'/>` +
    "<g mask='url(#w)'><circle cx='6.8' cy='16.6' r='2.7'/><circle cx='17.2' cy='16.6' r='2.7'/></g>",
  // Весёлый Роджер: череп и скрещённые кости. Кости отделены от черепа зазором.
  skull:
    `<defs><mask id='b'><rect width='24' height='24' fill='#fff'/><path d='${SKULL}' fill='#000' stroke='#000' stroke-width='2.6'/></mask>` +
    "<mask id='s'><rect width='24' height='24' fill='#fff'/><circle cx='9.4' cy='8.9' r='1.9' fill='#000'/><circle cx='14.6' cy='8.9' r='1.9' fill='#000'/>" +
    "<path d='M12 11.4l-1.1 1.9h2.2z' fill='#000'/></mask></defs>" +
    "<g mask='url(#b)'><path d='M4.5 14.5l15 7M19.5 14.5l-15 7' stroke='#000' stroke-width='2.4' stroke-linecap='round'/>" +
    "<circle cx='4.1' cy='15.4' r='1.5'/><circle cx='4.9' cy='13.6' r='1.5'/><circle cx='19.1' cy='22.4' r='1.5'/><circle cx='19.9' cy='20.6' r='1.5'/>" +
    "<circle cx='19.9' cy='15.4' r='1.5'/><circle cx='19.1' cy='13.6' r='1.5'/><circle cx='4.9' cy='22.4' r='1.5'/><circle cx='4.1' cy='20.6' r='1.5'/></g>" +
    `<path mask='url(#s)' d='${SKULL}'/>`,
  ghost:
    HOLE_MASK("m", "<ellipse cx='9.4' cy='10.4' rx='1.4' ry='1.9'/><ellipse cx='14.6' cy='10.4' rx='1.4' ry='1.9'/><ellipse cx='12' cy='14.6' rx='1.2' ry='1.4'/>") +
    "<path mask='url(#m)' d='M4.5 21.5V11a7.5 7.5 0 0 1 15 0v10.5l-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2z'/>",
  rocket:
    HOLE_MASK('m', "<circle cx='12' cy='9' r='2.1'/>") +
    "<path mask='url(#m)' d='M12 1.8c3.2 2.6 4.6 6.6 4.3 11.2V17H7.7v-4C7.4 8.4 8.8 4.4 12 1.8z'/>" +
    "<path d='M7.7 11.8l-3.5 4v3.7l3.5-2zM16.3 11.8l3.5 4v3.7l-3.5-2zM9.6 18.2h4.8L12 22.8z'/>",

  crown:
    HOLE_MASK('m', "<circle cx='12' cy='14.6' r='1.5'/>") +
    "<path mask='url(#m)' d='M2.8 8.2l4.6 4.2L12 5.2l4.6 7.2 4.6-4.2-1.6 9.6H4.4z'/>" +
    "<rect x='4.4' y='18.6' width='15.2' height='2.6' rx='1'/><circle cx='2.8' cy='7.4' r='1.7'/><circle cx='12' cy='4.2' r='1.8'/><circle cx='21.2' cy='7.4' r='1.7'/>",
  diamond:
    HOLE_MASK('m', "<path fill='none' stroke='#000' stroke-width='1.1' d='M2.2 9.5h19.6M6.8 3.5l2.6 6L12 21.2M17.2 3.5l-2.6 6L12 21.2M9.4 9.5L12 3.5l2.6 6'/>") +
    "<path mask='url(#m)' d='M6.8 3.5h10.4l4.6 6L12 21.2 2.2 9.5z'/>",
};

const cache = new Map();

export function isMarkShape(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SHAPES, id);
}

export function isDot(id) {
  return id === DOT;
}

// Значение для CSS-переменной --mark-shape или '' для точки.
export function markShapeCss(id) {
  if (!isMarkShape(id) || isDot(id)) return '';
  if (!cache.has(id)) {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" + SHAPES[id] + '</svg>';
    cache.set(id, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  }
  return cache.get(id);
}

// Как markShapeCss, но точка тоже рисуется маской (кружок) — для полей, где в разных
// клетках разные метки (картинка «Как у поля» в магазине).
const CIRCLE_ID = '__circle';
export function anyMarkCss(id) {
  if (!isDot(id)) return markShapeCss(id);
  if (!cache.has(CIRCLE_ID)) {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='6'/></svg>";
    cache.set(CIRCLE_ID, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  }
  return cache.get(CIRCLE_ID);
}

// Какая метка на поле: выбранная в магазине, иначе своя у темы, иначе точка.
export function resolveMark(markId, theme) {
  if (isMarkShape(markId)) return markId;
  const own = theme && theme.mark;
  return isMarkShape(own) ? own : DOT;
}
