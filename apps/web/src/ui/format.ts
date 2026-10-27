/** Display formatting shared by the UI components (Spanish locale, the browser's local time zone). */

const dateTimeFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

/** Formats an ISO-8601 time for display; an unparseable value is shown as received. */
export function formatDateTime(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? iso : dateTimeFormat.format(new Date(time));
}

/** Joins CSS class names, skipping empty values. */
export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ');
}
