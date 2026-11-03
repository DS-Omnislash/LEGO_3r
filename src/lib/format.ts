const dateFmt = new Intl.DateTimeFormat('ca-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' });
const dtFmt = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(+d) ? iso : dateFmt.format(d);
}
export function fmtShort(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(+d) ? iso : shortFmt.format(d);
}
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return isNaN(+d) ? iso : dtFmt.format(d);
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const pct = (v: number, max: number) => (max > 0 ? Math.round((v / max) * 100) : 0);
export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result ?? ''));
    r.onerror = () => rej(r.error);
    r.readAsText(file, 'utf-8');
  });
}
