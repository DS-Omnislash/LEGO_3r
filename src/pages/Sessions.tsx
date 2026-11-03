import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAllData } from '../db/hooks';
import type { Session, SessionType, Team } from '../db/models';
import * as repo from '../db/repo';
import { MISSIONS, MISSION_BY_ID, maxFor } from '../scoring/rules';
import { missionMax } from '../scoring/engine';
import { fmtDate, today } from '../lib/format';
import { EmptyState, Loading, MissionBadge, Modal, PageHead, Seg, TeamAvatar, useToast } from '../components/ui';
import { attemptResult } from '../lib/compute';

export function SessionsPage() {
  const { teams, sessions, attempts, loading } = useAllData();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<'all' | 'draft' | 'completed'>('all');
  const [creating, setCreating] = useState<string[] | null>(null);

  useEffect(() => {
    const m = params.get('new');
    if (m !== null) {
      setCreating(m ? m.split(',').filter((x) => MISSION_BY_ID[x]) : []);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const list = sessions.filter((s) => status === 'all' || s.status === status);

  if (loading) return <Loading />;
  return (
    <>
      <PageHead
        eyebrow="Pràctica setmanal"
        title="Sessions"
        sub="Cada setmana trieu les missions a practicar i registreu els resultats de cada equip."
        actions={<button className="btn green lg" onClick={() => setCreating([])}>＋ Nova sessió</button>}
      />
      {sessions.length === 0 ? (
        <div className="card">
          <EmptyState icon="📅" title="Encara no hi ha cap sessió" action={<button className="btn green" onClick={() => setCreating([])}>＋ Crear la primera sessió</button>}>
            {teams.length === 0 ? 'Abans, creeu o importeu els equips a la secció «Equips».' : 'Creeu una sessió, trieu la missió de la setmana i comenceu a puntuar.'}
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <Seg value={status} onChange={setStatus} options={[
              { value: 'all', label: `Totes (${sessions.length})` },
              { value: 'draft', label: `En curs (${sessions.filter((s) => s.status === 'draft').length})` },
              { value: 'completed', label: `Completades (${sessions.filter((s) => s.status === 'completed').length})` },
            ]} />
          </div>
          {list.length === 0 && <div className="card"><EmptyState icon="🗂️" title="Cap sessió amb aquest estat" /></div>}
          <div className="grid auto">
            {list.map((s, i) => {
              const sAttempts = attempts.filter((a) => a.sessionId === s.id && !a.deletedAt);
              const done = new Set(sAttempts.map((a) => a.teamId));
              const best = sAttempts.length ? Math.max(...sAttempts.map((a) => attemptResult(a, s).total)) : null;
              return (
                <Link key={s.id} to={`/sessions/${s.id}`} className="card scard rise" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="row between">
                    <span className="date">{fmtDate(s.date)}</span>
                    <div className="row" style={{ gap: 6 }}>
                      {s.type === 'official' && <span className="badge purple">Oficial</span>}
                      {s.status === 'completed' ? <span className="badge green">✓ Completada</span> : <span className="badge yellow">✎ En curs</span>}
                    </div>
                  </div>
                  <div className="ttl">{s.title}</div>
                  <div className="chips">
                    {s.missionIds.map((id) => MISSION_BY_ID[id]).filter(Boolean).map((m) => <MissionBadge key={m.id} mission={m} size="sm" />)}
                  </div>
                  <div className="row between small muted">
                    <span>👥 {done.size}/{s.teamIds.length} equips puntuats</span>
                    <span>{best !== null ? <>🏅 Millor: <b style={{ color: 'var(--ink)' }}>{best}</b> / {maxFor(s.missionIds)}</> : `Màx. ${maxFor(s.missionIds)}`}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
      {creating && <SessionForm teams={teams} sessions={sessions} preset={creating} onClose={() => setCreating(null)} />}
    </>
  );
}

export function SessionForm({ teams, sessions, session, preset, onClose, lockedTeamIds = [] }: {
  teams: Team[];
  sessions: Session[];
  session?: Session;
  preset?: string[];
  onClose: () => void;
  lockedTeamIds?: string[];
}) {
  const nav = useNavigate();
  const toast = useToast();
  const active = teams.filter((t) => !t.archived);
  const week = sessions.length + 1;
  const [date, setDate] = useState(session?.date ?? today());
  const [title, setTitle] = useState(session?.title ?? `Setmana ${week}`);
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [type, setType] = useState<SessionType>(session?.type ?? 'practice');
  const [missionIds, setMissionIds] = useState<string[]>(session?.missionIds ?? (preset?.length ? [...preset, 'PT'] : []));
  const [teamIds, setTeamIds] = useState<string[]>(session?.teamIds ?? active.map((t) => t.id));
  const [touched, setTouched] = useState(false);

  const max = useMemo(() => maxFor(missionIds), [missionIds]);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const errors: string[] = [];
  if (!title.trim()) errors.push('Poseu un títol a la sessió.');
  if (!date) errors.push('Indiqueu la data.');
  if (!missionIds.length) errors.push('Trieu almenys una missió o prova.');
  if (!teamIds.length) errors.push('Trieu almenys un equip participant.');

  async function save() {
    setTouched(true);
    if (errors.length) return;
    const ordered = MISSIONS.filter((m) => missionIds.includes(m.id)).map((m) => m.id);
    const data = { date, title: title.trim(), notes, type, missionIds: ordered, teamIds };
    if (session) {
      await repo.updateSession(session.id, data);
      toast('Sessió actualitzada');
      onClose();
    } else {
      const s = await repo.createSession(data);
      toast('Sessió creada! Ja podeu puntuar 🚀');
      onClose();
      nav(`/sessions/${s.id}`);
    }
  }

  const removedMissions = session ? session.missionIds.filter((id) => !missionIds.includes(id)) : [];

  return (
    <Modal
      wide
      title={session ? 'Edita la sessió' : 'Nova sessió'}
      onClose={onClose}
      footer={
        <>
          <span className="muted small" style={{ marginRight: 'auto' }}>{missionIds.length} proves · màxim {max} punts · {teamIds.length} equips</span>
          <button className="btn ghost" onClick={onClose}>Cancel·la</button>
          <button className="btn green" onClick={save}>{session ? 'Desa els canvis' : 'Crea la sessió'}</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div className="grid cols-3" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="sd">Data</label>
            <input id="sd" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="st">Títol</label>
            <input id="st" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Tipus de resultats</label>
          <Seg value={type} onChange={setType} options={[
            { value: 'practice', label: '🧪 Pràctica (entrenament)' },
            { value: 'official', label: '🏆 Oficial (competició / simulacre)' },
          ]} />
          <span className="hint">Les classificacions poden mostrar pràctica, oficial o tots dos, sempre etiquetat.</span>
        </div>

        <div className="field">
          <div className="row between">
            <label>Missions / proves de la sessió</label>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={() => setMissionIds(MISSIONS.map((m) => m.id))}>Joc complet</button>
              <button type="button" className="btn ghost sm" onClick={() => setMissionIds([])}>Cap</button>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
            {MISSIONS.map((m) => {
              const on = missionIds.includes(m.id);
              return (
                <button type="button" key={m.id} onClick={() => setMissionIds(toggle(missionIds, m.id))}
                  className="team-btn" style={{ borderColor: on ? 'var(--blue)' : undefined, background: on ? '#eef6fd' : '#fff' }} aria-pressed={on}>
                  <MissionBadge mission={m} size="sm" />
                  <span className="info"><b className="small">{m.name}</b><span className="tiny muted" style={{ display: 'block' }}>màx. {missionMax(m)}</span></span>
                  <span>{on ? '✅' : '⬜'}</span>
                </button>
              );
            })}
          </div>
          {removedMissions.length > 0 && (
            <div className="flag small">Heu tret {removedMissions.join(', ')}. Les dades introduïdes es conserven però deixaran de puntuar en aquesta sessió.</div>
          )}
        </div>

        <div className="field">
          <div className="row between">
            <label>Equips participants</label>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn ghost sm" onClick={() => setTeamIds(active.map((t) => t.id))}>Tots</button>
              <button type="button" className="btn ghost sm" onClick={() => setTeamIds(lockedTeamIds)}>Cap</button>
            </div>
          </div>
          {active.length === 0 ? (
            <div className="flag">No hi ha equips actius. <Link to="/teams" onClick={onClose}>Creeu-ne a la secció Equips</Link>.</div>
          ) : (
            <div className="chips">
              {active.map((t) => {
                const locked = lockedTeamIds.includes(t.id);
                return (
                  <button type="button" key={t.id} className={`chip ${teamIds.includes(t.id) ? 'on' : ''}`} disabled={locked}
                    title={locked ? 'Aquest equip ja té intents en aquesta sessió' : undefined}
                    onClick={() => setTeamIds(toggle(teamIds, t.id))}>
                    <TeamAvatar team={t} size="sm" /> {t.name} {locked && '🔒'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="sn">Notes</label>
          <textarea id="sn" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Objectius de la setmana, material, observacions…" />
        </div>
        {touched && errors.map((e) => <div key={e} className="violation">{e}</div>)}
      </div>
    </Modal>
  );
}
