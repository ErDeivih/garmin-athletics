const dateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const longDateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const numberFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'sin fecha';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'sin fecha';
  return dateFormatter.format(date);
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return 'hoy';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'hoy';
  return longDateFormatter.format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'nunca';
  return dateTimeFormatter.format(date);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return timeFormatter.format(date);
}

export function formatNumber(value: number | null | undefined, unit = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'sin dato';
  return `${numberFormatter.format(value)}${unit ? ` ${unit}` : ''}`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return 'sin duración';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'nunca sincronizado';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'nunca sincronizado';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** 0 = lunes … 6 = domingo, como la guarda el backend. */
export function weekdayName(index: number | null | undefined): string {
  if (index === null || index === undefined || index < 0 || index > 6) return 'sin día fijo';
  return WEEKDAYS[index] ?? 'sin día fijo';
}

export function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}
