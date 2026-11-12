// Загрузка content.json — всего, что меняется без правки кода:
// наряды, события, награды, расписание задачи дня, тексты.

let content = null;

export async function loadContent() {
  const response = await fetch('content.json');
  if (!response.ok) throw new Error('content.json: ' + response.status);
  content = await response.json();
  return content;
}

export function getContent() {
  return content;
}

export function catById(id) {
  const list = content.cats;
  return list.find((cat) => cat.id === id) || list[0];
}

// Оформление поля: набор цветов комнат и линий.
export function boardById(id) {
  const list = content.boards || [];
  return list.find((board) => board.id === id) || list[0] || null;
}

export function eventById(id) {
  return content.events.find((event) => event.id === id) || null;
}
