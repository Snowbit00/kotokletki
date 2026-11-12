// Задача дня: дата по Москве, серия дней подряд, события, кодирование результата.

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EPOCH_UTC = Date.UTC(2026, 0, 1);
const SCORE_BASE = 100000;
const MAX_SECONDS = SCORE_BASE - 1;

function pad(value) {
  return String(value).padStart(2, '0');
}

function toUtc(dateStr) {
  const p = dateStr.split('-').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]);
}

// Дата «ГГГГ-ММ-ДД» по московскому времени: новая задача появляется в 00:00 МСК.
export function moscowDate(nowMs) {
  const d = new Date(nowMs + MOSCOW_OFFSET_MS);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

export function addDays(dateStr, days) {
  const d = new Date(toUtc(dateStr) + days * DAY_MS);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

export function dayIndex(dateStr) {
  return Math.round((toUtc(dateStr) - EPOCH_UTC) / DAY_MS);
}

// Серия после решения задачи дня за дату dateStr (старый объект не меняется).
export function nextStreak(streak, dateStr) {
  if (streak.last === dateStr) return streak;
  const count = streak.last === addDays(dateStr, -1) ? streak.count + 1 : 1;
  return { count, last: dateStr, best: Math.max(streak.best || 0, count) };
}

// Серия, которую видно сегодня: если вчера и сегодня не решали — она сгорела.
export function visibleStreak(streak, todayStr) {
  if (streak.last === todayStr || streak.last === addDays(todayStr, -1)) return streak.count;
  return 0;
}

// Одна таблица на все дни: сегодняшние результаты всегда выше вчерашних,
// внутри дня выше тот, кто решил быстрее. Сортировка в таблице — по убыванию.
export function encodeScore(dateStr, seconds) {
  const safe = Math.min(MAX_SECONDS, Math.max(0, Math.floor(seconds)));
  return dayIndex(dateStr) * SCORE_BASE + (MAX_SECONDS - safe);
}

export function decodeScore(score) {
  const day = Math.floor(score / SCORE_BASE);
  return { day, seconds: MAX_SECONDS - (score - day * SCORE_BASE) };
}

// Действует ли событие в эту дату. Границы «ММ-ДД» включительно,
// период может переходить через Новый год (например, 12-20 … 01-10).
export function isEventActive(event, dateStr) {
  const day = dateStr.slice(5);
  if (event.from <= event.to) return day >= event.from && day <= event.to;
  return day >= event.from || day <= event.to;
}

export function activeEvent(events, dateStr) {
  return (events || []).find((event) => isEventActive(event, dateStr)) || null;
}
