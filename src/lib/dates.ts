// Use local calendar dates: due dates must never shift because of UTC conversion.
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(key: string, days: number): string {
  const date = parseDate(key); date.setDate(date.getDate() + days); return dateKey(date);
}
export function parseDate(key: string): Date { return new Date(`${key}T12:00:00`); }
export function formatDate(key: string | null, today = dateKey()): string {
  if (!key) return 'No due date';
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(parseDate(key));
}
export function upcomingGroup(key: string, today: string): string {
  if (key < today) return 'Overdue';
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  const day = parseDate(today).getDay();
  const monday = addDays(today, -(day === 0 ? 6 : day - 1));
  if (key < addDays(monday, 7)) return 'This week';
  if (key < addDays(monday, 14)) return 'Next week';
  return 'Later';
}
