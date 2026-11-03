import { useMemo, useRef, useState } from 'react';
import { useAllData } from '../db/hooks';
import type { Team } from '../db/models';
import * as repo from '../db/repo';
import { CSV_TEMPLATE, JSON_TEMPLATE, parseTeamsFile, teamsToCSV, teamsToJSON, type TeamImportResult } from '../lib/teamsIO';
import { download, readFile, today } from '../lib/format';
import { EmptyState, Loading, Modal, PageHead, TeamAvatar, useConfirm, useToast } from '../components/ui';
import { computeRanking } from '../lib/rankings';

export function TeamsPage() {
  const { teams, sessions, attempts, settings, loading } = useAllData();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const ranking = useMemo(() => computeRanking({ teams, sessions, attempts, settings }), [teams, sessions, attempts, settings]);
  const statsOf = (id: string) => ranking.find((r) => r.team.id === id);

  const list = teams.filter(
    (t) => (showArchived || !t.archived) &&
      (!q || `${t.name} ${t.number ?? ''} ${t.members.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  );

  async function remove(t: Team) {
    const has = await repo.teamHasResults(t.id);
    const ok = await confirm({
      title: `Eliminar «${t.name}»?`,
      body: has ? (
        <>Aquest equip té resultats registrats. <b>Si l'elimineu, també s'esborraran tots els seus intents.</b> Si només voleu amagar-lo de les classificacions, és millor <b>arxivar-lo</b>.</>
      ) : 'Aquesta acció no es pot desfer.',
      confirm: 'Elimina definitivament',
      danger: true,
    });
    if (!ok) return;
    await repo.deleteTeam(t.id);
    toast(`Equip «${t.name}» eliminat`);
  }

  if (loading) return <Loading />;

  return (
    <>
      <PageHead
        eyebrow="Registre"
        title="Equips"
        sub={`${teams.filter((t) => !t.archived).length} equips actius${teams.some((t) => t.archived) ? ` · ${teams.filter((t) => t.archived).length} arxivats` : ''}`}
        actions={
          <>
            <button className="btn ghost" onClick={() => setImporting(true)}>📥 Importar</button>
            <ExportMenu teams={teams} />
            <button className="btn green" onClick={() => setEditing('new')}>＋ Nou equip</button>
          </>
        }
      />

      {teams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="👥"
            title="Encara no hi ha cap equip"
            action={
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn green" onClick={() => setEditing('new')}>＋ Crear el primer equip</button>
                <button className="btn ghost" onClick={() => setImporting(true)}>📥 Importar des d'un fitxer CSV/JSON</button>
              </div>
            }
          >
            Creeu els equips a mà o importeu una llista. Podeu descarregar una plantilla des del botó «Importar».
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <div className="search" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
              <input className="input" placeholder="Cerca per nom, número o membre…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {teams.some((t) => t.archived) && (
              <label className="chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostra arxivats
              </label>
            )}
          </div>
          {list.length === 0 && <div className="card"><EmptyState icon="🔍" title="Cap equip coincideix amb la cerca" /></div>}
          <div className="grid auto">
            {list.map((t, i) => {
              const st = statsOf(t.id);
              return (
                <div key={t.id} className="card rise" style={{ animationDelay: `${i * 30}ms`, borderTop: `6px solid ${t.color}`, opacity: t.archived ? 0.6 : 1 }}>
                  <div className="row" style={{ alignItems: 'flex-start', marginTop: 6 }}>
                    <TeamAvatar team={t} size="lg" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.2rem' }}>{t.name}</h3>
                      <div className="row small muted" style={{ gap: 6, marginTop: 4 }}>
                        {t.number && <span className="badge dark">#{t.number}</span>}
                        {t.archived && <span className="badge">Arxivat</span>}
                        <span>{t.members.length} membres</span>
                      </div>
                    </div>
                  </div>
                  {t.members.length > 0 && (
                    <div className="chips" style={{ marginTop: 12 }}>
                      {t.members.map((m) => <span key={m} className="badge blue">{m}</span>)}
                    </div>
                  )}
                  {t.notes && <p className="small muted" style={{ margin: '10px 0 0' }}>📝 {t.notes}</p>}
                  <hr className="sep" />
                  <div className="row between small">
                    <span className="muted">
                      {st?.hasResults ? <><b style={{ color: 'var(--ink)' }}>{st.sessionsPlayed}</b> sessions · millor partida <b style={{ color: 'var(--ink)' }}>{st.bestAttempt}</b></> : 'Sense resultats encara'}
                    </span>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn ghost sm" onClick={() => setEditing(t)}>✏️ Edita</button>
                      <button
                        className="btn ghost sm"
                        title={t.archived ? 'Desarxiva' : 'Arxiva (amaga de les classificacions sense esborrar resultats)'}
                        onClick={async () => { await repo.updateTeam(t.id, { archived: !t.archived }); toast(t.archived ? 'Equip desarxivat' : 'Equip arxivat'); }}
                      >
                        {t.archived ? '♻️' : '📦'}
                      </button>
                      <button className="btn ghost sm" title="Elimina" onClick={() => remove(t)}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && <TeamForm team={editing === 'new' ? undefined : editing} existing={teams} onClose={() => setEditing(null)} />}
      {importing && <ImportTeams existing={teams} onClose={() => setImporting(false)} />}
    </>
  );
}

function ExportMenu({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn ghost" onClick={() => setOpen(!open)} disabled={!teams.length}>📤 Exportar ▾</button>
      {open && (
        <div className="card tight" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 30, minWidth: 200 }} onMouseLeave={() => setOpen(false)}>
          <div className="stack" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => { download(`equips-${today()}.csv`, '﻿' + teamsToCSV(teams), 'text/csv'); setOpen(false); }}>CSV (Excel)</button>
            <button className="btn ghost sm" onClick={() => { download(`equips-${today()}.json`, teamsToJSON(teams)); setOpen(false); }}>JSON</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamForm({ team, existing, onClose }: { team?: Team; existing: Team[]; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(team?.name ?? '');
  const [number, setNumber] = useState(team?.number ?? '');
  const [members, setMembers] = useState(team?.members.join('\n') ?? '');
  const [notes, setNotes] = useState(team?.notes ?? '');
  const [color, setColor] = useState(team?.color ?? repo.pickColor(existing.length));
  const [emoji, setEmoji] = useState(team?.emoji ?? repo.pickEmoji(existing.length));
  const [touched, setTouched] = useState(false);

  const others = existing.filter((t) => t.id !== team?.id);
  const errors: string[] = [];
  if (!name.trim()) errors.push('El nom és obligatori.');
  if (name.trim() && others.some((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase())) errors.push('Ja existeix un equip amb aquest nom.');
  if (number.trim() && others.some((t) => t.number === number.trim())) errors.push('Ja existeix un equip amb aquest número.');

  async function save() {
    setTouched(true);
    if (errors.length) return;
    const data = { name, number, members: members.split(/[\n;,]/), notes, color, emoji };
    if (team) {
      await repo.updateTeam(team.id, { ...data, name: name.trim(), number: number.trim() || undefined, members: data.members.map((m) => m.trim()).filter(Boolean) });
      toast('Equip actualitzat');
    } else {
      await repo.createTeam(data);
      toast(`Equip «${name.trim()}» creat 🎉`);
    }
    onClose();
  }

  return (
    <Modal
      title={team ? 'Edita l\'equip' : 'Nou equip'}
      onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel·la</button><button className="btn green" onClick={save}>Desa</button></>}
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="row" style={{ alignItems: 'center', gap: 16 }}>
          <TeamAvatar team={{ color, emoji }} size="lg" />
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="tn">Nom de l'equip *</label>
            <input id="tn" className={`input ${touched && !name.trim() ? 'error' : ''}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ex. Els Energètics" />
          </div>
          <div className="field" style={{ width: 120 }}>
            <label htmlFor="tnum">Número</label>
            <input id="tnum" className="input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="opcional" />
          </div>
        </div>
        <div className="field">
          <label>Color</label>
          <div className="chips">
            {repo.TEAM_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} aria-label={c}
                style={{ width: 34, height: 34, borderRadius: 9, border: color === c ? '3px solid var(--ink)' : '3px solid transparent', background: c, cursor: 'pointer' }} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 34, border: 0, background: 'none' }} aria-label="Color personalitzat" />
          </div>
        </div>
        <div className="field">
          <label>Icona</label>
          <div className="chips">
            {repo.TEAM_EMOJIS.map((e) => (
              <button type="button" key={e} className={`chip ${emoji === e ? 'on' : ''}`} onClick={() => setEmoji(e)} style={{ fontSize: '1.1rem', padding: '4px 10px' }}>{e}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="tm">Membres</label>
          <textarea id="tm" className="textarea" value={members} onChange={(e) => setMembers(e.target.value)} placeholder={'Un nom per línia\n(o separats per comes)'} />
        </div>
        <div className="field">
          <label htmlFor="tno">Notes</label>
          <input id="tno" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </div>
        {touched && errors.map((e) => <div key={e} className="violation">{e}</div>)}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ImportTeams({ existing, onClose }: { existing: Team[]; onClose: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<TeamImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false);
  const [mode, setMode] = useState<'merge' | 'skip'>('merge');

  async function load(f: File) {
    try {
      const text = await readFile(f);
      setFileName(f.name);
      setRes(parseTeamsFile(text, f.name, existing));
    } catch (e) {
      toast(`No s'ha pogut llegir el fitxer: ${(e as Error).message}`, 'error');
    }
  }

  const errors = res?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = res?.issues.filter((i) => i.level === 'warning') ?? [];
  const rowsWithErr = new Set(errors.map((e) => e.row));
  const globalError = errors.some((e) => e.row === 0);

  async function doImport() {
    if (!res || globalError) return;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const [i, r] of res.rows.entries()) {
      const n = i + 1;
      if (rowsWithErr.has(n)) { skipped++; continue; }
      const match = res.matches[n];
      if (match) {
        if (mode === 'merge') {
          await repo.updateTeam(match, { name: r.name, number: r.number, members: r.members, notes: r.notes, ...(r.color ? { color: r.color } : {}), ...(r.emoji ? { emoji: r.emoji } : {}) });
          updated++;
        } else skipped++;
      } else {
        await repo.createTeam(r);
        created++;
      }
    }
    toast(`Importació feta: ${created} nous, ${updated} actualitzats${skipped ? `, ${skipped} omesos` : ''}`);
    onClose();
  }

  return (
    <Modal
      wide
      title="Importar equips"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel·la</button>
          <button className="btn green" disabled={!res || globalError || res.rows.length === rowsWithErr.size} onClick={doImport}>
            Importa {res ? res.rows.length - rowsWithErr.size : ''} equips
          </button>
        </>
      }
    >
      <div className="stack">
        <div
          className={`dropzone ${over ? 'over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
        >
          <div style={{ fontSize: '2.2rem' }}>📄</div>
          <b>{fileName || 'Arrossegueu un fitxer CSV o JSON aquí, o feu clic per triar-lo'}</b>
          <div className="small">Columnes: <span className="kbd">nom</span> (obligatori), <span className="kbd">numero</span>, <span className="kbd">membres</span> (separats per «;»), <span className="kbd">notes</span>, <span className="kbd">color</span></div>
          <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </div>
        <div className="row small">
          <span className="muted">Plantilles:</span>
          <button className="btn ghost sm" onClick={() => download('plantilla-equips.csv', '﻿' + CSV_TEMPLATE, 'text/csv')}>⬇ CSV</button>
          <button className="btn ghost sm" onClick={() => download('plantilla-equips.json', JSON_TEMPLATE)}>⬇ JSON</button>
        </div>

        {res && (
          <>
            {errors.length === 0 ? (
              <div className="ok-banner">✅ Fitxer vàlid: {res.rows.length} equips trobats.</div>
            ) : (
              <div className="violation">
                {errors.length} errors trobats. {globalError ? 'Corregiu el fitxer i torneu-ho a provar.' : 'Les files amb errors s\'ometran.'}
                <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                  {errors.map((e, i) => <li key={i}>{e.row ? `Fila ${e.row}: ` : ''}{e.message}</li>)}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <details className="flag">
                <summary>{warnings.length} avisos</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                  {warnings.map((e, i) => <li key={i}>{e.row ? `Fila ${e.row}: ` : ''}{e.message}</li>)}
                </ul>
              </details>
            )}
            {Object.keys(res.matches).length > 0 && (
              <div className="row small">
                <b>{Object.keys(res.matches).length} equips ja existeixen</b> (mateix número o nom):
                <div className="seg">
                  <button className={mode === 'merge' ? 'on' : ''} onClick={() => setMode('merge')}>Actualitza'ls</button>
                  <button className={mode === 'skip' ? 'on' : ''} onClick={() => setMode('skip')}>Omet-los</button>
                </div>
              </div>
            )}
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Fila</th><th>Estat</th><th>Número</th><th>Nom</th><th>Membres</th><th>Notes</th></tr></thead>
                <tbody>
                  {res.rows.map((r, i) => {
                    const n = i + 1;
                    return (
                      <tr key={i}>
                        <td>{n}</td>
                        <td>
                          {rowsWithErr.has(n) ? <span className="badge red">Error</span> : res.matches[n] ? <span className="badge yellow">{mode === 'merge' ? 'Actualitza' : 'Omet'}</span> : <span className="badge green">Nou</span>}
                        </td>
                        <td>{r.number ?? '—'}</td>
                        <td><b>{r.name || <span className="muted">(buit)</span>}</b></td>
                        <td className="small">{r.members.join(', ')}</td>
                        <td className="small muted">{r.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
