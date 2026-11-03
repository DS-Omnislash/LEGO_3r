import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MISSION_BY_ID, MISSIONS, RULES, flagsFor } from '../scoring/rules';
import { defaultInputs, missionMax, scoreMission } from '../scoring/engine';
import type { InputValue, MissionInputs } from '../scoring/types';
import { FieldMap } from '../components/FieldMap';
import { MissionScoreCard, pointsLabel } from '../components/ScoringForm';
import { EmptyState, MissionBadge, JOURNEY_COLORS } from '../components/ui';
import { useAllData } from '../db/hooks';
import { scoreAll } from '../lib/rankings';

const TYPE_LABEL: Record<string, string> = {
  boolean: 'Sí / No',
  count: 'Recompte',
  select: 'Opció',
  check: 'Verificació (no puntua)',
  auto: 'Bonificació automàtica',
};

export function MissionDetail() {
  const { id } = useParams();
  return <MissionDetailInner key={id} id={id} />;
}

function MissionDetailInner({ id }: { id?: string }) {
  const nav = useNavigate();
  const m = id ? MISSION_BY_ID[id] : undefined;
  const [inputs, setInputs] = useState<MissionInputs>(() => (m ? defaultInputs(m) : {}));
  const [showOfficial, setShowOfficial] = useState(true);
  const { teams, sessions, attempts } = useAllData();

  const best = useMemo(() => {
    if (!m) return [];
    const scored = scoreAll(sessions, attempts).filter((sa) => sa.session.status === 'completed' && m.id in sa.byMission);
    return teams
      .map((t) => ({ team: t, best: Math.max(-1, ...scored.filter((s) => s.attempt.teamId === t.id).map((s) => s.byMission[m.id])) }))
      .filter((x) => x.best >= 0)
      .sort((a, b) => b.best - a.best);
  }, [m, teams, sessions, attempts]);

  if (!m) return <div className="card"><EmptyState icon="🧩" title="Missió no trobada" action={<Link className="btn" to="/missions">Torna a les missions</Link>} /></div>;

  const result = scoreMission(m, inputs);
  const max = missionMax(m);
  const idx = MISSIONS.findIndex((x) => x.id === m.id);
  const prev = MISSIONS[idx - 1];
  const next = MISSIONS[idx + 1];
  const flags = flagsFor(m.id);
  const journey = m.journey ? RULES.journeys[m.journey] : null;

  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <Link to="/missions" className="btn ghost sm">← Missions</Link>
        <div className="row">
          {prev && <Link to={`/missions/${prev.id}`} className="btn ghost sm">← {prev.number}</Link>}
          {next && <Link to={`/missions/${next.id}`} className="btn ghost sm">{next.number} →</Link>}
        </div>
      </div>

      <div className="hero" style={{ marginBottom: 20 }}>
        <div className="row" style={{ alignItems: 'center', gap: 16 }}>
          <span style={{ transform: 'scale(1.5)', transformOrigin: 'left center', marginRight: 22 }}><MissionBadge mission={m} /></span>
          <div>
            <div className="eyebrow" style={{ color: 'var(--yellow)' }}>{m.kind === 'general' ? 'Puntuació general' : `Missió ${m.number}`} · {m.officialName}</div>
            <h1>{m.name}</h1>
          </div>
        </div>
        <p>{m.story}</p>
        <div className="actions">
          <span className="badge yellow" style={{ fontSize: '0.95rem', padding: '6px 12px' }}>Màxim {max} punts</span>
          <span className="badge" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>PDF p. {m.pages.join(', ')}</span>
          {journey && <span className="badge" style={{ background: JOURNEY_COLORS[m.journey!], color: '#fff' }}>{journey.label}</span>}
          <button className="btn yellow sm" onClick={() => nav(`/sessions?new=${m.id}`)}>📅 Practica-la en una sessió</button>
        </div>
        <span className="bolt">⚡</span>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <h2>🎯 Objectiu</h2>
            <p>{m.task}</p>
            {showOfficial && <div className="official">{m.taskOfficial}</div>}
            <hr className="sep" />
            <h3>🛠️ Configuració del model</h3>
            <p className="small">{m.setup} <span className="badge">p. {m.setupPage}</span></p>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>🧮 Com s'obtenen els punts</h2>
              <label className="row small" style={{ cursor: 'pointer', gap: 6 }}>
                <input type="checkbox" checked={showOfficial} onChange={(e) => setShowOfficial(e.target.checked)} /> Text oficial
              </label>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Condició</th><th>Tipus</th><th className="num">Punts</th></tr></thead>
                <tbody>
                  {m.conditions.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.bonus && '★ '}{c.label}</b>
                        {c.requires && c.requires.length > 0 && (
                          <div className="tiny muted" style={{ marginTop: 4 }}>Requisits: {c.requires.map((r) => r.reason).join(' ')}</div>
                        )}
                        {c.type === 'count' && c.maxOrigin === 'derived' && <div className="tiny" style={{ color: 'var(--purple)', marginTop: 4 }}>Màxim {c.max} deduït ({c.maxSource})</div>}
                        {showOfficial && <div className="official" style={{ marginTop: 6 }}>{c.official}</div>}
                      </td>
                      <td className="small">{TYPE_LABEL[c.type]}</td>
                      <td className="num"><b>{pointsLabel(c) ?? '—'}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {m.constraints?.map((k, i) => <div key={i} className="derived" style={{ marginTop: 10 }}><b>Restricció ({k.origin === 'derived' ? 'deduïda' : 'oficial'}):</b> {k.reason}</div>)}
            {m.conditions.some((c) => 'uses' in c && c.uses?.energy) && (
              <div className="derived" style={{ marginTop: 10 }}>⚡ Aquesta missió és una <b>destinació d'unitats d'energia</b>: compta per al límit global de {RULES.resources.energy.total} unitats.</div>
            )}
          </div>

          {flags.length > 0 && (
            <div className="card">
              <h3>⚠️ Per revisar</h3>
              <div className="stack" style={{ marginTop: 10 }}>{flags.map((f) => <div key={f.id} className="flag">{f.text}</div>)}</div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div><h2>🕹️ Simulador</h2><p>Proveu combinacions: la puntuació es calcula amb el mateix motor que les sessions.</p></div>
              <button className="btn ghost sm" onClick={() => setInputs(defaultInputs(m))}>↺ Reinicia</button>
            </div>
            <MissionScoreCard
              mission={m}
              inputs={inputs}
              result={result}
              onChange={(cid, v: InputValue) => setInputs((x) => ({ ...x, [cid]: v }))}
            />
          </div>
          {m.position && (
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>📍 Ubicació al terreny</h3>
              <FieldMap highlight={[m.id]} compact />
            </div>
          )}
          <div className="card">
            <h3>🏅 Millors puntuacions dels equips</h3>
            {best.length === 0 ? (
              <p className="small muted">Cap equip ha practicat encara aquesta missió en una sessió completada.</p>
            ) : (
              <div className="stack" style={{ marginTop: 10, gap: 8 }}>
                {best.map((b) => (
                  <div key={b.team.id} className="row between">
                    <span className="row" style={{ gap: 8 }}><span className="avatar sm" style={{ ['--c' as string]: b.team.color }}>{b.team.emoji}</span><b>{b.team.name}</b></span>
                    <span><b>{b.best}</b> <span className="muted small">/ {max}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
