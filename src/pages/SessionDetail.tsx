import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAttempts, useSession, useSettings, useTeams } from '../db/hooks';
import type { Attempt, Session, Team } from '../db/models';
import * as repo from '../db/repo';
import { uid, now } from '../db/db';
import { getMissions, maxFor, RULES, ENERGY_CAP } from '../scoring/rules';
import { scoreAttempt } from '../scoring/engine';
import type { Adjustment, AttemptInputs, InputValue } from '../scoring/types';
import { attemptResult } from '../lib/compute';
import { computeRanking } from '../lib/rankings';
import { fmtDate, fmtDateTime, signed } from '../lib/format';
import { ScoringForm } from '../components/ScoringForm';
import { EmptyState, Loading, MissionBadge, TeamAvatar, TeamChip, useConfirm, useToast } from '../components/ui';
import { SessionForm } from './Sessions';
import { useSessions } from '../db/hooks';
import { ProjectorView } from '../components/Projector';

const LOG_LABEL: Record<string, string> = {
  created: 'Sessió creada', edited: 'Sessió editada', completed: 'Marcada com a completada',
  reopened: 'Reoberta per corregir', 'attempt-deleted': 'Intent esborrat', restored: 'Restaurada',
};

export function SessionDetail() {
  const { id } = useParams();
  const session = useSession(id);
  const attempts = useAttempts(id);
  const teams = useTeams();
  const sessions = useSessions();
  const settings = useSettings();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [projector, setProjector] = useState(false);
  const [showOfficial, setShowOfficial] = useState(settings.showOfficialText);

  useEffect(() => setShowOfficial(settings.showOfficialText), [settings.showOfficialText]);

  const live = useMemo(() => (attempts ?? []).filter((a) => !a.deletedAt), [attempts]);
  const participants = useMemo(
    () => (session && teams ? session.teamIds.map((tid) => teams.find((t) => t.id === tid)).filter((t): t is Team => !!t) : []),
    [session, teams],
  );

  useEffect(() => {
    if (!teamId && participants.length) {
      const firstPending = participants.find((t) => !live.some((a) => a.teamId === t.id));
      setTeamId((firstPending ?? participants[0]).id);
    }
  }, [participants, live, teamId]);

  if (session === undefined || !attempts || !teams || !sessions) return <Loading />;
  if (session === null) return <div className="card"><EmptyState icon="📅" title="Sessió no trobada" action={<Link to="/sessions" className="btn">Torna a les sessions</Link>} /></div>;

  const s = session;
  const missions = getMissions(s.missionIds);
  const max = maxFor(s.missionIds);
  const readOnly = s.status === 'completed';
  const scoredTeams = new Set(live.map((a) => a.teamId));
  const ranking = computeRanking({ teams, sessions: [s], attempts: live, settings, method: 'session', filters: { sessionId: s.id } })
    .filter((r) => s.teamIds.includes(r.team.id));

  async function complete() {
    const invalid = live.filter((a) => !attemptResult(a, s).valid);
    if (invalid.length) {
      toast(`No es pot completar: ${invalid.length} intent(s) tenen valors impossibles. Reviseu els avisos en vermell.`, 'error');
      return;
    }
    const pending = participants.filter((t) => !scoredTeams.has(t.id));
    if (pending.length) {
      const ok = await confirm({
        title: 'Hi ha equips sense resultats',
        body: <>Aquests equips no tenen cap intent: <b>{pending.map((t) => t.name).join(', ')}</b>. Voleu completar la sessió igualment? (No sumaran punts en aquesta sessió.)</>,
        confirm: 'Completa igualment',
      });
      if (!ok) return;
    }
    await repo.completeSession(s.id);
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.7 }, colors: ['#e3000b', '#ffd500', '#006cb7', '#00af4d'] });
    toast('Sessió completada! La classificació s\'ha actualitzat 🏆');
  }

  async function reopen() {
    const reason = await confirm({
      title: 'Reobrir la sessió per corregir',
      body: 'Es desarà una còpia de l\'estat actual de cada intent a l\'historial, de manera que no es perdrà cap dada anterior.',
      confirm: 'Reobre',
      input: 'Motiu (opcional): p. ex. «error a la M03 de l\'equip X»',
    });
    if (reason === false) return;
    await repo.reopenSession(s.id, reason === 'ok' ? '' : reason);
    toast('Sessió reoberta. Feu les correccions i torneu-la a completar.', 'warn');
  }

  async function remove() {
    const ok = await confirm({
      title: `Eliminar «${s.title}»?`,
      body: <>S'esborraran la sessió i <b>tots els seus {live.length} intents</b>. Aquesta acció no es pot desfer (feu abans una còpia de seguretat si cal).</>,
      confirm: 'Elimina la sessió', danger: true,
    });
    if (!ok) return;
    await repo.deleteSession(s.id);
    toast('Sessió eliminada');
    nav('/sessions');
  }

  const selected = participants.find((t) => t.id === teamId) ?? null;

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <Link to="/sessions" className="btn ghost sm">← Sessions</Link>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost sm" onClick={() => setProjector(true)}>📽️ Projecta la sessió</button>
          <button className="btn ghost sm" onClick={async () => { const c = await repo.duplicateSession(s.id); if (c) { toast('Sessió duplicada'); nav(`/sessions/${c.id}`); } }}>⧉ Duplica</button>
          <button className="btn ghost sm" onClick={() => setEditing(true)}>✏️ Edita</button>
          <button className="btn ghost sm" onClick={remove}>🗑️</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow">{fmtDate(s.date)} · {s.type === 'official' ? '🏆 Oficial' : '🧪 Pràctica'}</div>
            <h1 style={{ marginTop: 4 }}>{s.title}</h1>
            <div className="chips" style={{ marginTop: 10 }}>
              {missions.map((m) => (
                <Link key={m.id} to={`/missions/${m.id}`} className="badge" style={{ textDecoration: 'none', padding: '4px 10px 4px 4px' }}>
                  <MissionBadge mission={m} size="sm" /> {m.name}
                </Link>
              ))}
            </div>
            {s.notes && <p className="small muted" style={{ marginBottom: 0 }}>📝 {s.notes}</p>}
          </div>
          <div className="stack" style={{ alignItems: 'flex-end', gap: 8 }}>
            {readOnly ? <span className="badge green" style={{ fontSize: '0.9rem' }}>✓ Completada</span> : <span className="badge yellow" style={{ fontSize: '0.9rem' }}>✎ En curs (esborrany desat automàticament)</span>}
            <span className="small muted">{scoredTeams.size}/{participants.length} equips puntuats · màx. {max} pts</span>
            {readOnly ? (
              <button className="btn orange" onClick={reopen}>🔓 Reobre per corregir</button>
            ) : (
              <button className="btn green" onClick={complete}>✅ Marca com a completada</button>
            )}
          </div>
        </div>
      </div>

      {participants.length === 0 ? (
        <div className="card"><EmptyState icon="👥" title="Aquesta sessió no té equips" action={<button className="btn" onClick={() => setEditing(true)}>Afegeix equips</button>} /></div>
      ) : (
        <div className="score-layout">
          <div className="team-list">
            {participants.map((t) => {
              const mine = live.filter((a) => a.teamId === t.id);
              const best = mine.length ? Math.max(...mine.map((a) => attemptResult(a, s).total)) : null;
              return (
                <button key={t.id} className={`team-btn ${t.id === teamId ? 'on' : ''}`} onClick={() => setTeamId(t.id)}>
                  <span className={`status-dot ${mine.length ? 'done' : ''}`} />
                  <TeamAvatar team={t} size="sm" />
                  <span className="info">
                    <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</b>
                    <span className="tiny muted">{mine.length ? `${mine.length} intent${mine.length > 1 ? 's' : ''}` : 'Pendent'}</span>
                  </span>
                  <span className="score">{best ?? '–'}</span>
                </button>
              );
            })}
          </div>
          <div>
            {selected && (
              <TeamPanel
                key={selected.id}
                session={s}
                team={selected}
                attempts={live.filter((a) => a.teamId === selected.id).sort((a, b) => a.number - b.number)}
                deleted={(attempts ?? []).filter((a) => a.teamId === selected.id && a.deletedAt)}
                readOnly={readOnly}
                showOfficial={showOfficial}
                setShowOfficial={setShowOfficial}
                onNext={() => {
                  const i = participants.findIndex((t) => t.id === selected.id);
                  const next = participants[(i + 1) % participants.length];
                  setTeamId(next.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid cols-2" style={{ marginTop: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <div><h2>🏁 Classificació de la sessió</h2><p>{settings.sessionAggregation === 'best' ? 'Millor intent' : 'Últim intent'} de cada equip {settings.includeAdjustments ? '(amb ajustos)' : '(sense ajustos)'}{readOnly ? '' : ' · provisional'}</p></div>
          </div>
          <div className="rank-list">
            {ranking.map((r) => (
              <div key={r.team.id} className={`rank-item r${r.rank}`}>
                <span className="rank-pos">{r.hasResults ? r.rank : '–'}</span>
                <span><TeamChip team={r.team} />{r.tied && r.hasResults && <span className="tie">EMPAT</span>}</span>
                <span className="rank-val">{r.hasResults ? r.value : '—'}<small>/ {max}</small></span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>🕓 Historial de la sessió</h2>
          <div className="stack" style={{ marginTop: 12, gap: 8 }}>
            {[...s.log].reverse().map((l, i) => (
              <div key={i} className="row small" style={{ gap: 8 }}>
                <span className="badge">{fmtDateTime(l.at)}</span>
                <b>{LOG_LABEL[l.action] ?? l.action}</b>
                {l.detail && <span className="muted">— {l.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && (
        <SessionForm
          teams={teams}
          sessions={sessions}
          session={s}
          lockedTeamIds={[...scoredTeams]}
          onClose={() => setEditing(false)}
        />
      )}
      {projector && (
        <ProjectorView
          title={s.title}
          subtitle={`${fmtDate(s.date)} · ${missions.map((m) => `M${m.number}`).join(' · ')} · ${readOnly ? 'Resultats finals' : 'Provisional'}`}
          rows={ranking}
          unit={`/ ${max}`}
          onClose={() => setProjector(false)}
        />
      )}
    </>
  );
}

function TeamPanel({ session, team, attempts, deleted, readOnly, showOfficial, setShowOfficial, onNext }: {
  session: Session;
  team: Team;
  attempts: Attempt[];
  deleted: Attempt[];
  readOnly: boolean;
  showOfficial: boolean;
  setShowOfficial: (v: boolean) => void;
  onNext: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [attemptId, setAttemptId] = useState<string | null>(attempts[attempts.length - 1]?.id ?? null);
  const attempt = attempts.find((a) => a.id === attemptId) ?? attempts[attempts.length - 1] ?? null;

  async function newAttempt() {
    const a = await repo.createAttempt(session.id, team.id);
    setAttemptId(a.id);
  }

  if (!attempt) {
    return (
      <div className="card">
        <EmptyState
          icon={team.emoji}
          title={`${team.name} encara no té resultats`}
          action={!readOnly ? <button className="btn green lg" onClick={newAttempt}>▶ Comença a puntuar</button> : undefined}
        >
          {readOnly ? 'La sessió està completada. Reobriu-la per afegir resultats.' : 'Creeu el primer intent i marqueu el que ha aconseguit el robot.'}
        </EmptyState>
        {deleted.length > 0 && <DeletedAttempts deleted={deleted} readOnly={readOnly} />}
      </div>
    );
  }

  const results = attempts.map((a) => attemptResult(a, session).total);
  const bestIdx = results.indexOf(Math.max(...results));

  return (
    <div className="stack">
      <div className="row between">
        <TeamChip team={team} size="lg" sub={`${attempts.length} intent${attempts.length > 1 ? 's' : ''} en aquesta sessió`} />
        <div className="attempt-tabs">
          {attempts.map((a, i) => (
            <button key={a.id} className={`${a.id === attempt.id ? 'on' : ''} ${attempts.length > 1 && i === bestIdx ? 'best' : ''}`} onClick={() => setAttemptId(a.id)}>
              Intent {a.number} · {results[i]}
            </button>
          ))}
          {!readOnly && <button onClick={newAttempt} title="Afegeix un altre intent (es conserven tots)">＋ Intent</button>}
        </div>
      </div>
      <AttemptEditor
        key={attempt.id}
        session={session}
        attempt={attempt}
        readOnly={readOnly}
        showOfficial={showOfficial}
        setShowOfficial={setShowOfficial}
        onNext={onNext}
        onDelete={async () => {
          const ok = await confirm({
            title: `Esborrar l'intent ${attempt.number}?`,
            body: session.completedAt ? 'L\'intent es marcarà com a esborrat i es podrà recuperar.' : 'Aquesta acció no es pot desfer.',
            confirm: 'Esborra', danger: true,
          });
          if (!ok) return;
          await repo.deleteAttempt(attempt.id);
          setAttemptId(null);
          toast('Intent esborrat');
        }}
      />
      {deleted.length > 0 && <DeletedAttempts deleted={deleted} readOnly={readOnly} />}
    </div>
  );
}

function DeletedAttempts({ deleted, readOnly }: { deleted: Attempt[]; readOnly: boolean }) {
  return (
    <details className="card tight">
      <summary>🗑️ Intents esborrats ({deleted.length})</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        {deleted.map((a) => (
          <div key={a.id} className="row between small">
            <span>Intent {a.number} · esborrat {fmtDateTime(a.deletedAt!)}</span>
            {!readOnly && <button className="btn ghost sm" onClick={() => repo.restoreAttempt(a.id)}>♻️ Recupera</button>}
          </div>
        ))}
      </div>
    </details>
  );
}

function AttemptEditor({ session, attempt, readOnly, showOfficial, setShowOfficial, onNext, onDelete }: {
  session: Session;
  attempt: Attempt;
  readOnly: boolean;
  showOfficial: boolean;
  setShowOfficial: (v: boolean) => void;
  onNext: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  // Còpia local per a una resposta immediata; cada canvi es desa a IndexedDB.
  const [inputs, setInputs] = useState<AttemptInputs>(attempt.inputs);
  const [adjustments, setAdjustments] = useState<Adjustment[]>(attempt.adjustments);
  const [gp, setGp] = useState<number | null>(attempt.gp);
  const [notes, setNotes] = useState(attempt.notes);
  const [saved, setSaved] = useState(true);
  const [adjPts, setAdjPts] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const missionKey = session.missionIds.join(',');
  const missions = useMemo(() => getMissions(missionKey.split(',')), [missionKey]);
  const result = useMemo(
    () => scoreAttempt(missions, inputs, adjustments, { globalConstraints: RULES.globalConstraints }),
    [missions, inputs, adjustments],
  );
  const energy = result.missions.reduce((s, m) => s + (m.uses.energy ?? 0), 0);
  const usesEnergy = missions.some((m) => m.conditions.some((c) => ('uses' in c && c.uses?.energy) || (c.type === 'select' && c.options.some((o) => o.uses?.energy))));

  async function persist(patch: Partial<Pick<Attempt, 'inputs' | 'adjustments' | 'gp' | 'notes'>>) {
    setSaved(false);
    try {
      await repo.saveAttempt(attempt.id, patch);
      setSaved(true);
    } catch (e) {
      toast(`Error en desar: ${(e as Error).message}`, 'error');
    }
  }

  function change(missionId: string, condId: string, v: InputValue) {
    if (readOnly) return;
    const next = { ...inputs, [missionId]: { ...(inputs[missionId] ?? {}), [condId]: v } };
    setInputs(next);
    persist({ inputs: next });
  }

  function addAdjustment() {
    const p = Number(adjPts);
    if (!Number.isFinite(p) || p === 0) return toast('Indiqueu un nombre de punts (positiu o negatiu) diferent de 0.', 'warn');
    if (!adjReason.trim()) return toast('Cal indicar el motiu de l\'ajust.', 'warn');
    const next = [...adjustments, { id: uid(), points: Math.round(p), reason: adjReason.trim(), at: now() }];
    setAdjustments(next);
    persist({ adjustments: next });
    setAdjPts('');
    setAdjReason('');
  }

  return (
    <>
      <div className="scorebar">
        <div className="total"><span key={result.total} className="bump" style={{ display: 'inline-block' }}>{result.total}</span> <small>/ {result.max}</small></div>
        <div className="parts">
          Punts de missió: <b>{result.missionPoints}</b>
          {result.adjustmentPoints !== 0 && <> · Ajustos manuals: <b style={{ color: 'var(--yellow)' }}>{signed(result.adjustmentPoints)}</b></>}
          <br />
          {usesEnergy && <>⚡ Unitats d'energia col·locades: <b>{energy}/{ENERGY_CAP}</b> · </>}
          {readOnly ? '🔒 Només lectura' : saved ? '💾 Desat' : '⏳ Desant…'}
        </div>
        <div className="spacer" />
        <label className="row small" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showOfficial} onChange={(e) => setShowOfficial(e.target.checked)} /> Text oficial
        </label>
        {!readOnly && <button className="btn yellow sm" onClick={onNext}>Següent equip →</button>}
      </div>

      {result.violations.filter((v) => v.scope === 'global').map((v, i) => <div key={i} className="violation">⚠️ {v.message}</div>)}

      <ScoringForm missions={missions} inputs={inputs} result={result} onChange={change} readOnly={readOnly} showOfficial={showOfficial} />

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>✍️ Ajustos manuals</h3>
          <p className="small muted" style={{ marginTop: 4 }}>Només si cal (p. ex. decisió de l'àrbitre principal o interferència, p. 20). Es mostren separats dels punts oficials de missió i cal indicar-ne el motiu.</p>
          {adjustments.length > 0 && (
            <div className="stack" style={{ gap: 6, margin: '10px 0' }}>
              {adjustments.map((a) => (
                <div key={a.id} className="row between small" style={{ background: '#fffbe3', padding: '6px 10px', borderRadius: 8 }}>
                  <span><b>{signed(a.points)}</b> · {a.reason} <span className="tiny muted">({fmtDateTime(a.at)})</span></span>
                  {!readOnly && <button className="btn link sm" onClick={() => { const next = adjustments.filter((x) => x.id !== a.id); setAdjustments(next); persist({ adjustments: next }); }}>✕</button>}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="row" style={{ marginTop: 8 }}>
              <input className="input" style={{ width: 90 }} type="number" placeholder="±pts" value={adjPts} onChange={(e) => setAdjPts(e.target.value)} />
              <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Motiu (obligatori)" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAdjustment()} />
              <button className="btn sm" onClick={addAdjustment}>Afegeix</button>
            </div>
          )}
        </div>
        <div className="card">
          <h3>🤝 Gracious Professionalism®</h3>
          <p className="small muted" style={{ marginTop: 4 }}>{RULES.graciousProfessionalism.note}</p>
          <div className="optgroup" style={{ marginTop: 8 }}>
            {RULES.graciousProfessionalism.options.map((o) => (
              <button key={o.value} className={gp === o.value ? 'on' : ''} disabled={readOnly} onClick={() => { setGp(o.value); persist({ gp: o.value }); }}>
                {o.label}<small>{o.value} · {o.official}</small>
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="an">Notes de l'intent</label>
            <textarea id="an" className="textarea" disabled={readOnly} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== attempt.notes && persist({ notes })} placeholder="Què ha funcionat, què cal millorar…" />
          </div>
        </div>
      </div>

      <div className="row between">
        {attempt.revisions.length > 0 ? (
          <details className="card tight" style={{ flex: 1 }}>
            <summary>🕓 Historial de correccions ({attempt.revisions.length})</summary>
            <div className="stack" style={{ marginTop: 10, gap: 6 }}>
              {[...attempt.revisions].reverse().map((r, i) => (
                <div key={i} className="small row" style={{ gap: 8 }}>
                  <span className="badge">{fmtDateTime(r.at)}</span> <b>{r.total} pts</b> <span className="muted">{r.note}</span>
                </div>
              ))}
              <div className="small muted">Ara: <b>{result.total} pts</b></div>
            </div>
          </details>
        ) : <span />}
        {!readOnly && <button className="btn ghost sm" onClick={onDelete}>🗑️ Esborra aquest intent</button>}
      </div>
    </>
  );
}
