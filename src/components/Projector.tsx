import { useEffect } from 'react';
import type { RankingRow } from '../lib/rankings';
import { TeamAvatar } from './ui';

/** Vista a pantalla completa per projectar la classificació a l'aula. */
export function ProjectorView({ title, subtitle, rows, unit, onClose }: {
  title: string;
  subtitle: string;
  rows: RankingRow[];
  unit?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener('keydown', k);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [onClose]);

  return (
    <div className="projector">
      <button className="btn ghost close" onClick={onClose}>✕ Tanca (Esc)</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2vw' }}>
        <span style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}>🏆</span>
        <div>
          <h1>{title}</h1>
          <div className="sub">{subtitle}</div>
        </div>
      </div>
      <div className="plist">
        {rows.length === 0 && <div className="sub">Encara no hi ha resultats.</div>}
        {rows.map((r, i) => (
          <div key={r.team.id} className={`prow r${r.rank}`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="ppos">{r.hasResults ? r.rank : '–'}</div>
            <div className="pname">
              <TeamAvatar team={r.team} />
              <span>{r.team.name}</span>
              {r.tied && r.hasResults && <span className="tie" style={{ fontSize: '0.4em' }}>EMPAT</span>}
            </div>
            <div className="pval">
              {r.hasResults ? r.value : '—'}
              {unit && <span style={{ fontSize: '0.4em', opacity: 0.6, marginLeft: 8 }}>{unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
