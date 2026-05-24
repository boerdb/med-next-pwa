export const DATA_REFRESH_EVENT = 'medtracker:data-refresh';

export function notifyDataChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DATA_REFRESH_EVENT));
  }
}
