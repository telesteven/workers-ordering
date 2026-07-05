// Formats a UTC date/time string (e.g. from D1's `datetime('now')`, or a Date) as
// "yyyy-mm-dd hh:mm" in UTC+8 (Singapore/HK/China time), regardless of server timezone.
export function formatUtcPlus8(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input.replace(" ", "T") + "Z") : input;
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mi = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// Returns the Monday (UTC, YYYY-MM-DD) of the week containing the given YYYY-MM-DD date string.
export function startOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Returns the Sunday (UTC, YYYY-MM-DD) of the week containing the given YYYY-MM-DD date string.
export function endOfWeek(dateStr: string): string {
  const start = startOfWeek(dateStr);
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}
