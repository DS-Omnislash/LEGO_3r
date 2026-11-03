import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAllData } from '../db/hooks';
import { computeRanking, highestScore, improvements, METHOD_LABELS, missionStats, progressSeries, recentResults, SCOPE_LABELS } from '../lib/rankings';
import { MISSION_BY_ID, maxFor } from '../scoring/rules';
import { fmtDate, fmtDateTime, signed } from '../lib/format';
import { Bar, EmptyState, Loading, MissionBadge, Stat, TeamAvatar, TeamChip } from '../components/ui';
import { MissionBars, ProgressChart } from '../components/charts';

export function Dashboard() {
  const { teams, sessions, attempts, settings, loading } = useAllData();
  const activeTeams = useMemo(() => teams.filter((t) => !t.archived), [teams]);
  const ranking = useMemo(() => computeRanking({ teams, sessions, attempts, settings }), [teams, sessions, attempts, settings]);
  const series = useMemo(() => progressSeries(activeTeams, sessions, attempts, settings, {}, 'percent'), [activeTeams, sessions, attempts, settings]);
  const mStats = useMemo(() => missionStats(sessions, attempts, settings), [sessions, attempts, settings]);
  const improv = useMemo(() => improvements(teams, sessions, attempts, settings), [teams, sessions, attempts, settings]);
  const recent = useMemo(() => recentResults(sessions, attempts, 6), [sessions, attempts]);
  const top = useMemo(() => highestScore(sessions, attempts, settings), [sessions, attempts, settings]);

  if (loading) return <Loading />;

  const completed = sessions.filter((s) => s.status === 'completed');
  const drafts = sessions.filter((s) => s.status === 'draft');
  const withResults = ranking.filter((r) => r.hasResults);
  const leaders = withResults.filter((r) => r.rank === 1);
  const podium = [withResults[1], withResults[0], withResults[2]];
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const liveAttempts = attempts.filter((a) => !a.deletedAt).length;

  const firstRun = teams.length === 0 && sessions.length === 0;

  return (
    <>
      <div className="hero rise" style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ color: 'var(--yellow)' }}>FIRST® LEGO® League Challenge · SUPERPOWERED℠</div>
        <h1>{settings.competitionName}</h1>
        <p>
          {firstRun
            ? 'Benvinguts! Comenceu registrant els equips, després creeu la sessió de la setmana i puntueu cada equip. Les dades es desen en aquest ordinador.'
            : `${activeTeams.length} equips · ${completed.length} sessions completades · classificació per ${METHOD_LABELS[settings.rankingMethod].title.toLowerCase()} (${SCOPE_LABELS[settings.scope].toLowerCase()}).`}
        </p>
        <div className="actions">
          {firstRun ? (
            <>
              <Link to="/teams" className="btn yellow lg">👥 Registra els equips</Link>
              <Link to="/missions" className="btn ghost lg">🧩 Explora les missions</Link>
            </>
          ) : (
            <>
              <Link to="/sessions?new=" className="btn yellow lg">＋ Nova sessió</Link>
              {drafts[0] && <Link to={`/sessions/${drafts[0].id}`} className="btn green lg">▶ Continua «{drafts[0].title}»</Link>}
              <Link to="/scoreboard" className="btn ghost lg">🏆 Classificació</Link>
            </>
          )}
        </div>
        <span className="bolt">⚡</span>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        <Stat k="Equips registrats" v={activeTeams.length} s={teams.length > activeTeams.length ? `+${teams.length - activeTeams.length} arxivats` : 'actius'} deco="👥" accent="red" />
        <Stat k="Sessions completades" v={completed.length} s={drafts.length ? `${drafts.length} en curs` : 'cap en curs'} deco="📅" accent="blue" />
        <Stat k="Intents registrats" v={liveAttempts} s="en totes les sessions" deco="🤖" accent="green" />
        <Stat
          k="Puntuació més alta"
          v={top ? top.total : '—'}
          s={top ? `${teamById.get(top.attempt.teamId)?.name ?? '?'} · ${top.session.title} (màx. ${top.max})` : 'encara cap resultat'}
          deco="🏅"
          accent="yellow"
        />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>🏆 Líder{leaders.length > 1 ? 's (empat)' : ''}</h2>
              <p>{METHOD_LABELS[settings.rankingMethod].title} · {SCOPE_LABELS[settings.scope]}</p>
            </div>
            <Link to="/scoreboard" className="btn ghost sm">Veure-ho tot →</Link>
          </div>
          {withResults.length === 0 ? (
            <EmptyState icon="🏁" title="Encara no hi ha classificació">Completeu una sessió per veure el podi.</EmptyState>
          ) : (
            <>
              <div className="podium">
                {podium.map((r, i) => r ? (
                  <div key={r.team.id} className={`p p${r.rank <= 3 ? r.rank : 3}`}>
                    <div className="who">
                      <TeamAvatar team={r.team} size={i === 1 ? 'lg' : undefined} />
                      <span className="nm">{r.team.name}</span>
                      <span className="pts">{r.value}</span>
                    </div>
                    <div className="block">{r.rank}</div>
                  </div>
                ) : <div key={i} />)}
              </div>
              <div className="rank-list" style={{ marginTop: 16 }}>
                {withResults.slice(3, 8).map((r) => (
                  <div key={r.team.id} className="rank-item">
                    <span className="rank-pos">{r.rank}</span>
                    <span><TeamChip team={r.team} />{r.tied && <span className="tie">EMPAT</span>}</span>
                    <span className="rank-val">{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>📌 Sessions en curs</h2>
              <Link to="/sessions" className="btn ghost sm">Totes →</Link>
            </div>
            {drafts.length === 0 ? (
              <p className="small muted">No hi ha cap sessió pendent. <Link to="/sessions?new=">Creeu la sessió d'aquesta setmana</Link>.</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {drafts.slice(0, 4).map((s) => {
                  const done = new Set(attempts.filter((a) => a.sessionId === s.id && !a.deletedAt).map((a) => a.teamId)).size;
                  return (
                    <Link key={s.id} to={`/sessions/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="row between"><b>{s.title}</b><span className="small muted">{fmtDate(s.date)}</span></div>
                      <div className="row" style={{ gap: 6, margin: '6px 0' }}>
                        {s.missionIds.map((id) => MISSION_BY_ID[id]).filter(Boolean).map((m) => <MissionBadge key={m.id} mission={m} size="sm" />)}
                      </div>
                      <Bar value={done} max={s.teamIds.length} tone="green" />
                      <div className="tiny muted" style={{ marginTop: 4 }}>{done}/{s.teamIds.length} equips puntuats</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <h2>🕑 Últims resultats</h2>
            {recent.length === 0 ? (
              <p className="small muted">Encara no s'ha registrat cap resultat.</p>
            ) : (
              <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                {recent.map((r) => (
                  <Link key={r.attempt.id} to={`/sessions/${r.session.id}`} className="row between" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <TeamChip team={teamById.get(r.attempt.teamId)} sub={`${r.session.title} · intent ${r.attempt.number} · ${fmtDateTime(r.attempt.updatedAt)}`} />
                    <span><b style={{ fontSize: '1.15rem' }}>{r.total}</b><span className="muted small"> / {r.max}</span></span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <div><h2>📈 Progrés dels equips</h2><p>% del màxim possible de cada sessió (comparable entre missions diferents)</p></div>
            <Link to="/stats" className="btn ghost sm">Més →</Link>
          </div>
          <ProgressChart data={series} teams={activeTeams} percent />
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><div><h2>🧩 Assoliment per missió</h2><p>Mitjana dels intents, en % del màxim de la missió</p></div></div>
            <MissionBars stats={mStats.filter((m) => m.missionId !== 'PT')} height={220} />
          </div>
          <div className="card">
            <h2>🚀 Més millora</h2>
            <p className="small muted" style={{ marginTop: 4 }}>Entre les dues últimes sessions de cada equip, en % del màxim.</p>
            {improv.length === 0 ? (
              <p className="small muted">Cal que els equips participin en almenys dues sessions completades.</p>
            ) : (
              <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                {improv.slice(0, 4).map((i) => (
                  <div key={i.team.id} className="row between">
                    <TeamChip team={i.team} sub={`${i.fromPct}% → ${i.toPct}%`} />
                    <span className={`badge ${i.delta > 0 ? 'green' : i.delta < 0 ? 'red' : ''}`} style={{ fontSize: '0.9rem' }}>{signed(i.delta)} pp</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {completed.length > 0 && (
        <p className="tiny muted" style={{ marginTop: 16 }}>Màxim del joc complet: {maxFor(Object.keys(MISSION_BY_ID))} punts.</p>
      )}
    </>
  );
}
