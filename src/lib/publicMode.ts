import { validateBackup } from './backup';
import { replaceAllData } from '../db/repo';
import { fmtDateTime } from './format';

/** Versió per als alumnes (npm run build:public): només lectura de public/latest.json. */
export const PUBLIC_MODE = import.meta.env.VITE_PUBLIC === '1';

let exportedAt = '';

export async function loadPublicData() {
  try {
    const res = await fetch(`./latest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = validateBackup(await res.json());
    if (!v.ok) throw new Error(v.errors.join('\n'));
    exportedAt = v.backup.exportedAt;
    await replaceAllData(v.backup);
  } catch (e) {
    console.error('No s\'han pogut carregar les dades publicades', e);
  }
}

export function publicUpdatedAt() {
  return exportedAt ? fmtDateTime(exportedAt) : '—';
}
