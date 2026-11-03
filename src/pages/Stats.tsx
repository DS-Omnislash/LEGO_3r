import { useMemo, useState } from 'react';
import { useAllData } from '../db/hooks';
import { attemptValue, computeRanking, missionStats, progressSeries, relevantSessions, scoreAll, SCOPE_LABELS, type Filters } from '../lib/rankings';
import { MISSIONS, MISSION_BY_ID } from '../scoring/rules';
import { EmptyState, Loading, MissionBadge, PageHead, Seg, TeamAvatar, TeamChip, Bar } from '../components/ui';
import { MissionBars, ProgressChart, TeamTotalsBars } from '../components/charts';

export function StatsPage() {
  const { teams, sessions, attempts, settings, loading } = useAllData();
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [missionIds, setMissionIds] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'percent' | 'points'>('percent');

  const filters: Filters = useMemo(
    () => ({ teamIds, missionIds, from: from || undefined, to: to || undefined }),
    [teamIds, missionIds, from, to],
  );
  const shownTeams = useMemo(() => teams.filter((t) => !t.archived && (!teamIds.length || teamIds.includes(t.id))), [teams, teamIds]);
  const series = useMemo(() => progressSeries(shownTeams, sessions, attempts, settings, filters, mode), [shownTeams, sessions, attempts, settings, filters, mode]);
  const mStats = useMemo(() => missionStats(sessions, attempts, settings, filters), [sessions, attempts, settings, filters]);
  const ranking = useMemo(() => computeRanking({ teams, sessions, attempts, settings, method: 'cumulative', filters }), [teams, sessions, attempts, settings, filters]);

  const teamDetail = useMemo(() => {
    const ok = new Set(relevantSessions(sessions, settings, filters).map((s) => s.id));
    const scored = scoreAll(sessions, attempts).filter((sa) => ok.has(sa.session.id));
    return shownTeams.map((t) => {
      const mine = scored.filter((sa) => sa.attempt.teamId === t.id);
      const vals = mine.map((sa) => attemptValue(sa, settings, filters.missionIds));
      const pcts = mine.map((sa) => (sa.max ? (attemptValue(sa, settings, filters.missionIds) / sa.max) * 100 : 0));
      return {
        team: t,
        attempts: mine.length,
        sessions: new Set(mine.map((m) => m.session.id)).size,
        avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
        best: vals.length ? Math.max(...vals) : null,
        avgPct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
      };
    });
  }, [sessions, attempts, settings, shownTeams, filters]);

  if (loading) return <Loading />;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const anyData = sessions.some((s) => s.status === 'completed');
  const filtersOn = teamIds.length > 0 || missionIds.length > 0 || from || to;

  return (
    <>
      <PageHead eyebrow="Anàlisi" title="Estadístiques" sub={`Sessions completades · ${SCOPE_LABELS[settings.scope]}. Filtreu per equip, missió i dates.`} />
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="stack">
          <div className="row">
            <div className="field"><label>Des de</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field"><label>Fins a</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="spacer" />
            {filtersOn && <button className="btn ghost sm" onClick={() => { setTeamIds([]); setMissionIds([]); setFrom(''); setTo(''); }}>✕ Neteja filtres</button>}
          </div>
          <div className="chips">
            {teams.filter((t) => !t.archived).map((t) => (
              <button key={t.id} className={`chip ${teamIds.includes(t.id) ? 'on' : ''}`} onClick={() => setTeamIds(toggle(teamIds, t.id))}><TeamAvatar team={t} size="sm" /> {t.name}</button>
            ))}
          </div>
          <div className="chips">
            {MISSIONS.map((m) => (
              <button key={m.id} className={`chip ${missionIds.includes(m.id) ? 'on' : ''}`} title={m.name} onClick={() => setMissionIds(toggle(missionIds, m.id))}>{m.number} · {m.name}</button>
            ))}
          </div>
        </div>
      </div>

      {!anyData ? (
        <div className="card"><EmptyState icon="📊" title="Encara no hi ha dades">Les estadístiques apareixeran quan completeu la primera sessió.</EmptyState></div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-head">
              <div><h2>📈 Evolució per sessió</h2><p>{mode === 'percent' ? '% del màxim possible de cada sessió' : 'Punts de la sessió'}{missionIds.length ? ' · només missions filtrades' : ''}</p></div>
              <Seg value={mode} onChange={setMode} options={[{ value: 'percent', label: '% del màxim' }, { value: 'points', label: 'Punts' }]} />
            </div>
            <ProgressChart data={series} teams={shownTeams} percent={mode === 'percent'} height={340} />
          </div>

          <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h2>🏁 Punts acumulats</h2>
              <p className="small muted">Suma de sessions completades amb els filtres actuals.</p>
              <TeamTotalsBars rows={ranking.filter((r) => r.hasResults)} height={Math.max(160, ranking.length * 34)} />
            </div>
            <div className="card">
              <h2>🧩 Assoliment per missió</h2>
              <p className="small muted">Mitjana en % del màxim de cada missió.</p>
              <MissionBars stats={mStats} />
            </div>
          </div>

          <div className="card table-wrap">
            <h2 style={{ marginBottom: 10 }}>🧩 Detall per missió</h2>
            {mStats.length === 0 ? <EmptyState icon="🧩" title="Cap missió amb dades" /> : (
              <table className="tbl">
                <thead><tr><th>Missió</th><th className="num">Intents</th><th className="num">Equips</th><th className="num">Mitjana</th><th className="num">Millor</th><th className="num">Màxim</th><th style={{ width: 160 }}>Assoliment</th><th className="num">% amb puntuació màxima</th></tr></thead>
                <tbody>
                  {mStats.map((m) => (
                    <tr key={m.missionId}>
                      <td><span className="row" style={{ gap: 8 }}><MissionBadge mission={MISSION_BY_ID[m.missionId]} size="sm" /> <b>{MISSION_BY_ID[m.missionId].name}</b></span></td>
                      <td className="num">{m.attempts}</td>
                      <td className="num">{m.teamsTried}</td>
                      <td className="num">{m.avg}</td>
                      <td className="num"><b>{m.best}</b></td>
                      <td className="num">{m.max}</td>
                      <td><Bar value={m.avgPct} max={100} tone="blue" /></td>
                      <td className="num">{m.fullScoreRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card table-wrap">
            <h2 style={{ marginBottom: 10 }}>👥 Detall per equip</h2>
            <table className="tbl">
              <thead><tr><th>Equip</th><th className="num">Sessions</th><th className="num">Intents</th><th className="num">Mitjana</th><th className="num">Millor</th><th className="num">% mitjà del màxim</th></tr></thead>
              <tbody>
                {teamDetail.map((d) => (
                  <tr key={d.team.id}>
                    <td><TeamChip team={d.team} /></td>
                    <td className="num">{d.sessions}</td>
                    <td className="num">{d.attempts}</td>
                    <td className="num">{d.avg ?? '—'}</td>
                    <td className="num"><b>{d.best ?? '—'}</b></td>
                    <td className="num">{d.avgPct !== null ? `${d.avgPct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
