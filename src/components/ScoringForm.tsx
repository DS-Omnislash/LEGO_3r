import type { AttemptInputs, AttemptResult, Condition, InputValue, Mission, MissionResult } from '../scoring/types';
import { defaultValue } from '../scoring/engine';
import { MissionBadge } from './ui';
import { flagsFor } from '../scoring/rules';

export function pointsLabel(c: Condition): string | null {
  switch (c.type) {
    case 'boolean':
    case 'auto':
      return `${c.bonus ? '+' : ''}${c.points}`;
    case 'count':
      return `${c.pointsEach} c/u · màx. ${c.max}`;
    case 'select':
      return `fins a ${Math.max(...c.options.map((o) => o.points))}`;
    case 'check':
      return null;
  }
}

function Toggle({ on, onChange, disabled, check, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; check?: boolean; label: string }) {
  return (
    <button
      type="button"
      className={`toggle ${check ? 'check' : ''} ${on ? 'on' : ''}`}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={label}
    />
  );
}

function ConditionRow({ c, value, line, onChange, readOnly, showOfficial }: {
  c: Condition;
  value: InputValue;
  line?: MissionResult['lines'][number];
  onChange: (v: InputValue) => void;
  readOnly?: boolean;
  showOfficial?: boolean;
}) {
  const pl = pointsLabel(c);
  const status = line?.status ?? 'zero';
  let ctrl: React.ReactNode = null;
  if (c.type === 'check') ctrl = <Toggle check on={value === true} onChange={onChange} disabled={readOnly} label={c.label} />;
  else if (c.type === 'boolean') ctrl = <Toggle on={value === true} onChange={onChange} disabled={readOnly} label={c.label} />;
  else if (c.type === 'count') {
    ctrl = (
      <div className="stepper" role="group" aria-label={c.label}>
        {Array.from({ length: c.max + 1 }, (_, i) => (
          <button key={i} type="button" className={value === i ? 'on' : ''} disabled={readOnly} onClick={() => onChange(i)}>{i}</button>
        ))}
      </div>
    );
  } else if (c.type === 'select') {
    ctrl = (
      <div className="optgroup" role="radiogroup" aria-label={c.label}>
        {c.options.map((o) => (
          <button key={o.value} type="button" className={value === o.value ? 'on' : ''} disabled={readOnly} onClick={() => onChange(o.value)} role="radio" aria-checked={value === o.value}>
            {o.label}
            <small>{o.points} pts</small>
          </button>
        ))}
      </div>
    );
  } else if (c.type === 'auto') {
    ctrl = <span className={`badge ${line?.points ? 'green' : ''}`}>{line?.points ? '✓ Aconseguida' : 'Automàtica'}</span>;
  }

  return (
    <div className={`cond ${c.type}`}>
      <div>
        <div className="lbl">
          {c.type === 'check' && '🔎 '}
          {c.label}
          {pl && <span className={`pt-pill pts ${c.bonus ? 'bonus' : ''}`}>{pl}</span>}
        </div>
        {showOfficial && <div className="official" style={{ marginTop: 6 }}>{c.official} <span className="tiny">(p. {c.page})</span></div>}
        {c.type === 'count' && c.maxOrigin === 'derived' && showOfficial && (
          <div className="derived" style={{ marginTop: 6 }}>Màxim deduït: {c.maxSource}</div>
        )}
      </div>
      <div className="ctrl">
        {ctrl}
        {c.type !== 'check' && (
          <span className={`got ${status === 'blocked' ? 'blocked' : status === 'zero' ? 'zero' : ''}`} title={status === 'blocked' ? 'No puntua' : undefined}>
            {status === 'blocked' ? line?.wouldScore : line?.points ?? 0}
          </span>
        )}
      </div>
      {status === 'blocked' && line && (
        <div className="why">⛔ No puntua: {line.reasons.join(' ')}</div>
      )}
    </div>
  );
}

export function MissionScoreCard({ mission, inputs, result, onChange, readOnly, showOfficial }: {
  mission: Mission;
  inputs: Record<string, InputValue> | undefined;
  result?: MissionResult;
  onChange: (condId: string, v: InputValue) => void;
  readOnly?: boolean;
  showOfficial?: boolean;
}) {
  const flags = flagsFor(mission.id);
  return (
    <div className="card mission-score" style={{ padding: 0 }}>
      <div className="mhead">
        <MissionBadge mission={mission} />
        <div style={{ minWidth: 0 }}>
          <h3>{mission.name}</h3>
          <div className="tiny muted" style={{ fontWeight: 800 }}>{mission.officialName} · p. {mission.pages.join(', ')}</div>
        </div>
        <div className="sub">
          <span key={result?.total} className="bump" style={{ display: 'inline-block' }}>{result?.total ?? 0}</span>
          <small> / {result?.max ?? 0}</small>
        </div>
      </div>
      {mission.conditions.map((c) => (
        <ConditionRow
          key={c.id}
          c={c}
          value={c.type === 'auto' ? false : inputs?.[c.id] ?? defaultValue(c)}
          line={result?.lines.find((l) => l.condId === c.id)}
          onChange={(v) => onChange(c.id, v)}
          readOnly={readOnly}
          showOfficial={showOfficial}
        />
      ))}
      {result?.violations.map((v, i) => (
        <div key={i} className="violation" style={{ margin: 12 }}>⚠️ {v.message}</div>
      ))}
      {showOfficial && flags.length > 0 && (
        <div style={{ padding: '0 16px 14px' }} className="stack">
          {flags.map((f) => <div key={f.id} className="flag"><b>Per revisar:</b> {f.text}</div>)}
        </div>
      )}
    </div>
  );
}

export function ScoringForm({ missions, inputs, result, onChange, readOnly, showOfficial }: {
  missions: Mission[];
  inputs: AttemptInputs;
  result: AttemptResult;
  onChange: (missionId: string, condId: string, v: InputValue) => void;
  readOnly?: boolean;
  showOfficial?: boolean;
}) {
  return (
    <div className="stack">
      {missions.map((m) => (
        <MissionScoreCard
          key={m.id}
          mission={m}
          inputs={inputs[m.id]}
          result={result.missions.find((r) => r.missionId === m.id)}
          onChange={(cid, v) => onChange(m.id, cid, v)}
          readOnly={readOnly}
          showOfficial={showOfficial}
        />
      ))}
    </div>
  );
}
