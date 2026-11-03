import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllData } from '../db/hooks';
import type { RankingMethod, ResultScope } from '../db/models';
import { saveSettings } from '../db/repo';
import { AGG_LABELS, computeRanking, METHOD_LABELS, relevantSessions, SCOPE_LABELS, TIEBREAK_LABELS, type Filters, type RankingRow } from '../lib/rankings';
import { MISSIONS, MISSION_BY_ID, maxFor } from '../scoring/rules';
import { fmtDate, fmtShort } from '../lib/format';
import { EmptyState, Loading, MissionBadge, PageHead, Seg, TeamAvatar, TeamChip } from '../components/ui';
import { ProjectorView } from '../components/Projector';

type SortKey = 'rank' | 'name' | 'sessions' | 'best' | `s:${string}` | `m:${string}`;

export function Scoreboard() {
  const { teams, sessions, attempts, settings, loading } = useAllData();
  const method = settings.rankingMethod;
  const [sessionId, setSessionId] = useState<string>('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [missionIds, setMissionIds] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'list' | 'sessions' | 'missions'>('list');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 });
  const [projector, setProjector] = useState(false);

  const chosenSession = sessions.find((s) => s.id === (sessionId || sessions[0]?.id));
  const filters: Filters = { teamIds, missionIds, from: from || undefined, to: to || undefined, sessionId: chosenSession?.id };
  const rows = useMemo(
    () => computeRanking({ teams, sessions, attempts, settings, method, filters }),
    [teams, sessions, attempts, settings, method, teamIds, missionIds, from, to, chosenSession?.id],
  );
  const cols = useMemo(() => relevantSessions(sessions, settings, filters), [sessions, settings, missionIds, from, to]);
  const missionCols = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r) => Object.keys(r.bestByMission).forEach((id) => ids.add(id)));
    return MISSIONS.filter((m) => ids.has(m.id));
  }, [rows]);

  const sorted = useMemo(() => {
    const val = (r: RankingRow): number | string => {
      if (sort.key === 'rank') return r.rank;
      if (sort.key === 'name') return r.team.name;
      if (sort.key === 'sessions') return -r.sessionsPlayed;
      if (sort.key === 'best') return -(r.bestAttempt ?? -1);
      if (sort.key.startsWith('s:')) return -(r.bySession[sort.key.slice(2)] ?? -1);
      return -(r.bestByMission[sort.key.slice(2)] ?? -1);
    };
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(String(y), 'ca') : x - (y as number)) * sort.dir;
    });
  }, [rows, sort]);

  if (loading) return <Loading />;

  const setMethod = (m: RankingMethod) => saveSettings({ rankingMethod: m });
  const setScope = (s: ResultScope) => saveSettings({ scope: s });
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const th = (key: SortKey, label: React.ReactNode, cls = '') => (
    <th className={`sortable ${cls}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const scopeText = method === 'session'
    ? chosenSession ? `${chosenSession.type === 'official' ? 'Resultats oficials' : 'Resultats de pràctica'}${chosenSession.status === 'draft' ? ' · PROVISIONAL (sessió en curs)' : ''}` : ''
    : SCOPE_LABELS[settings.scope];
  const unit = method === 'session' && chosenSession ? `/ ${maxFor(chosenSession.missionIds)}` : 'pts';
  const filtersOn = teamIds.length + missionIds.length > 0 || from || to;
  const completed = sessions.filter((s) => s.status === 'completed').length;

  return (
    <>
      <PageHead
        eyebrow="Rànquing"
        title="Classificació"
        sub="S'actualitza automàticament amb cada resultat."
        actions={<button className="btn yellow lg" onClick={() => setProjector(true)} disabled={!rows.length}>📽️ Mode projector</button>}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="stack">
          <div className="row between">
            <Seg value={method} onChange={setMethod} options={(Object.keys(METHOD_LABELS) as RankingMethod[]).map((k) => ({ value: k, label: METHOD_LABELS[k].short }))} />
            {method !== 'session' && (
              <Seg value={settings.scope} onChange={setScope} options={(Object.keys(SCOPE_LABELS) as ResultScope[]).map((k) => ({ value: k, label: SCOPE_LABELS[k] }))} />
            )}
            {method === 'session' && (
              <select className="select" style={{ maxWidth: 360 }} value={chosenSession?.id ?? ''} onChange={(e) => setSessionId(e.target.value)}>
                {sessions.map((s) => <option key={s.id} value={s.id}>{fmtShort(s.date)} · {s.title}{s.status === 'draft' ? ' (en curs)' : ''}</option>)}
              </select>
            )}
          </div>
          <div className="row" style={{ background: 'var(--navy)', color: '#fff', padding: '12px 16px', borderRadius: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>📏</span>
            <div style={{ flex: 1 }}>
              <b>Mètode actiu: {METHOD_LABELS[method].title}</b> <span className="badge yellow">{scopeText}</span>
              <div className="small" style={{ opacity: 0.85 }}>
                {METHOD_LABELS[method].help}
                {method !== 'bestPerMission' && method !== 'bestMatch' && ` Puntuació per sessió: ${AGG_LABELS[settings.sessionAggregation].toLowerCase()}.`}
                {' '}{settings.includeAdjustments && method !== 'bestPerMission' && !missionIds.length ? 'Inclou ajustos manuals.' : 'Sense ajustos manuals.'}
                {' '}Empats: {TIEBREAK_LABELS[settings.tieBreak].toLowerCase()}.
              </div>
            </div>
            <Link to="/settings" className="btn ghost sm">⚙️ Canvia</Link>
          </div>
          <details>
            <summary>🔎 Filtres {filtersOn ? <span className="badge orange">actius</span> : ''}</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="row">
                <div className="field"><label>Des de</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="field"><label>Fins a</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                {filtersOn && <button className="btn ghost sm" style={{ alignSelf: 'flex-end' }} onClick={() => { setTeamIds([]); setMissionIds([]); setFrom(''); setTo(''); }}>✕ Neteja filtres</button>}
              </div>
              <div className="field">
                <label>Equips</label>
                <div className="chips">
                  {teams.filter((t) => !t.archived).map((t) => (
                    <button key={t.id} className={`chip ${teamIds.includes(t.id) ? 'on' : ''}`} onClick={() => setTeamIds(toggle(teamIds, t.id))}><TeamAvatar team={t} size="sm" /> {t.name}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Missions (només suma els punts d'aquestes missions, sense ajustos)</label>
                <div className="chips">
                  {MISSIONS.map((m) => (
                    <button key={m.id} className={`chip ${missionIds.includes(m.id) ? 'on' : ''}`} onClick={() => setMissionIds(toggle(missionIds, m.id))} title={m.name}>{m.number}</button>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="card"><EmptyState icon="🏆" title="Encara no hi ha equips" action={<Link className="btn" to="/teams">Crea equips</Link>} /></div>
      ) : method !== 'session' && completed === 0 ? (
        <div className="card"><EmptyState icon="⏳" title="Encara no hi ha cap sessió completada" action={<Link className="btn" to="/sessions">Ves a les sessions</Link>}>La classificació acumulada només compta les sessions marcades com a completades. Per veure una sessió en curs, trieu «Sessió».</EmptyState></div>
      ) : (
        <>
          <div className="tabs">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>🏅 Rànquing</button>
            <button className={view === 'sessions' ? 'on' : ''} onClick={() => setView('sessions')}>📅 Per sessió</button>
            <button className={view === 'missions' ? 'on' : ''} onClick={() => setView('missions')}>🧩 Millor per missió</button>
          </div>

          {view === 'list' && (
            <div className="rank-list">
              {rows.map((r, i) => (
                <div key={r.team.id} className={`rank-item r${r.rank} rise`} style={{ animationDelay: `${i * 35}ms`, padding: '14px 18px' }}>
                  <span className="rank-pos" style={{ width: 52, height: 52, fontSize: '1.6rem' }}>{r.hasResults ? r.rank : '–'}</span>
                  <span className="row" style={{ gap: 14 }}>
                    <TeamChip team={r.team} size="lg" sub={r.hasResults ? `${r.sessionsPlayed} sessions · ${r.attemptsCount} intents · millor partida ${r.bestAttempt}` : 'Sense resultats'} />
                    {r.tied && r.hasResults && <span className="tie">EMPAT</span>}
                  </span>
                  <span className="rank-val" style={{ fontSize: '2rem' }}>{r.value}<small>{unit}</small></span>
                </div>
              ))}
            </div>
          )}

          {view === 'sessions' && (
            <div className="card table-wrap">
              {cols.length === 0 ? <EmptyState icon="📅" title="Cap sessió completada amb aquests filtres" /> : (
                <table className="tbl">
                  <thead>
                    <tr>
                      {th('rank', '#')}
                      {th('name', 'Equip')}
                      {cols.map((s) => th(`s:${s.id}`, <span title={`${s.title} · ${fmtDate(s.date)}`}>{fmtShort(s.date)}<br /><span className="tiny">{s.missionIds.filter((x) => x !== 'PT').map((x) => MISSION_BY_ID[x]?.number).join(' ')}</span></span>, 'num'))}
                      {th('sessions', 'Sessions', 'num')}
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr key={r.team.id}>
                        <td><b>{r.hasResults ? r.rank : '–'}</b></td>
                        <td><TeamChip team={r.team} /></td>
                        {cols.map((s) => <td key={s.id} className="num">{r.bySession[s.id] ?? <span className="muted">·</span>}</td>)}
                        <td className="num">{r.sessionsPlayed}</td>
                        <td className="num"><b>{r.value}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="tiny muted">Cada cel·la mostra la puntuació de la sessió ({AGG_LABELS[settings.sessionAggregation].toLowerCase()}). «·» = no hi va participar.</p>
            </div>
          )}

          {view === 'missions' && (
            <div className="card table-wrap">
              {missionCols.length === 0 ? <EmptyState icon="🧩" title="Encara no hi ha missions puntuades" /> : (
                <table className="tbl">
                  <thead>
                    <tr>
                      {th('name', 'Equip')}
                      {missionCols.map((m) => th(`m:${m.id}`, <span title={m.name}><MissionBadge mission={m} size="sm" /></span>, 'num'))}
                      {th('best', 'Millor partida', 'num')}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr key={r.team.id}>
                        <td><TeamChip team={r.team} /></td>
                        {missionCols.map((m) => <td key={m.id} className="num">{r.bestByMission[m.id] ?? <span className="muted">·</span>}</td>)}
                        <td className="num"><b>{r.bestAttempt ?? '—'}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="tiny muted">Millor puntuació de cada equip a cada missió, en qualsevol intent de les sessions comptades (sense ajustos manuals).</p>
            </div>
          )}
        </>
      )}

      {projector && (
        <ProjectorView
          title={settings.competitionName}
          subtitle={`${METHOD_LABELS[method].title} · ${scopeText}${method === 'session' && chosenSession ? ` · ${chosenSession.title}` : ''}`}
          rows={rows}
          unit={unit}
          onClose={() => setProjector(false)}
        />
      )}
    </>
  );
}
