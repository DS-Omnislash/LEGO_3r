import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Team } from '../db/models';
import type { Mission } from '../scoring/types';

// ---- Toasts ------------------------------------------------------------------

type ToastKind = 'ok' | 'error' | 'warn';
interface ToastItem { id: number; text: string; kind: ToastKind }
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---- Modal -------------------------------------------------------------------

export function Modal({ title, onClose, children, footer, wide }: {
  title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Tanca">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Confirmació ------------------------------------------------------------

interface ConfirmOpts { title: string; body: ReactNode; confirm?: string; danger?: boolean; input?: string }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<string | false>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: string | false) => void }) | null>(null);
  const [text, setText] = useState('');
  const ask = useCallback((o: ConfirmOpts) => new Promise<string | false>((resolve) => { setText(''); setState({ ...o, resolve }); }), []);
  const close = (v: string | false) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <Modal
          title={state.title}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => close(false)}>Cancel·la</button>
              <button className={`btn ${state.danger ? 'red' : 'green'}`} onClick={() => close(text || 'ok')}>{state.confirm ?? 'Confirma'}</button>
            </>
          }
        >
          <div className="stack">
            <div>{state.body}</div>
            {state.input !== undefined && (
              <input className="input" autoFocus placeholder={state.input} value={text} onChange={(e) => setText(e.target.value)} />
            )}
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ---- Peces visuals -----------------------------------------------------------

export function TeamAvatar({ team, size }: { team: Pick<Team, 'color' | 'emoji'>; size?: 'sm' | 'lg' }) {
  return <span className={`avatar ${size ?? ''}`} style={{ ['--c' as string]: team.color }} aria-hidden>{team.emoji}</span>;
}

export function TeamChip({ team, size = 'sm', sub }: { team?: Team; size?: 'sm' | 'lg'; sub?: ReactNode }) {
  if (!team) return <span className="muted">Equip eliminat</span>;
  return (
    <span className="team-chip">
      <TeamAvatar team={team} size={size} />
      <span style={{ minWidth: 0 }}>
        <span className="nm" style={{ display: 'block' }}>{team.name}</span>
        {(team.number || sub) && <span className="no">{team.number ? `#${team.number}` : ''}{team.number && sub ? ' · ' : ''}{sub}</span>}
      </span>
    </span>
  );
}

export const JOURNEY_COLORS: Record<string, string> = { white: '#8f98ab', blue: '#006cb7', yellow: '#d1a900', orange: '#f57d20' };

export function MissionBadge({ mission, size }: { mission: Mission; size?: 'sm' }) {
  const bg = mission.kind === 'general' ? undefined : mission.journey ? JOURNEY_COLORS[mission.journey] : '#e3000b';
  return (
    <span className={`mbadge ${mission.kind === 'general' ? 'general' : ''} ${size ?? ''}`} style={bg ? { background: bg } : undefined}>
      {mission.number}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Stat({ k, v, s, deco, accent }: { k: string; v: ReactNode; s?: ReactNode; deco?: string; accent?: string }) {
  return (
    <div className={`card stat rise accent-${accent ?? 'blue'}`}>
      {deco && <span className="deco">{deco}</span>}
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

export function Bar({ value, max, tone }: { value: number; max: number; tone?: 'green' | 'blue' }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className={`bar ${tone ?? ''}`}><i style={{ width: `${w}%` }} /></div>;
}

export function Loading() {
  return <div className="empty"><div className="big bump">🧱</div><p>Carregant…</p></div>;
}

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
