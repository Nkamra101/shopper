export function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function getUpcomingDates(total = 10) {
  const dates = [];
  const today = new Date();

  for (let index = 0; index < total; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    dates.push(date);
  }

  return dates;
}

export function toDateInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

