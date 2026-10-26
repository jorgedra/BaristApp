/** "2:30" -> 150. Acepta también segundos sueltos ("45") y números. */
export function parseTime(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  const v = value.trim();
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(v)) return Number(v);
  return null;
}

/** 150 -> "2:30" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatRatio(coffee: number, water: number): string {
  if (!coffee) return '—';
  const r = Math.round((water / coffee) * 10) / 10;
  return `1:${String(r).replace('.', ',')}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Días transcurridos desde una fecha YYYY-MM-DD hasta `now`. */
export function daysSince(date: string, now = new Date()): number | null {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

/** 13.7 -> "13,7" */
export function formatNum(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}
