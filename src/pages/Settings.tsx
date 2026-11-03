import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllData, useSnapshots } from '../db/hooks';
import type { RankingMethod, ResultScope, SessionAggregation, TieBreak } from '../db/models';
import * as repo from '../db/repo';
import { validateBackup } from '../lib/backup';
import { AGG_LABELS, METHOD_LABELS, SCOPE_LABELS, TIEBREAK_LABELS } from '../lib/rankings';
import { download, fmtDateTime, readFile, today } from '../lib/format';
import { CSV_TEMPLATE, parseTeamsFile } from '../lib/teamsIO';
import { RULES, FULL_GAME_MAX } from '../scoring/rules';
import { PageHead, useConfirm, useToast } from '../components/ui';

function Radio<T extends string>({ value, current, onChange, title, help }: { value: T; current: T; onChange: (v: T) => void; title: string; help?: string }) {
  const on = value === current;
  return (
    <button type="button" className="team-btn" onClick={() => onChange(value)} style={{ borderColor: on ? 'var(--blue)' : undefined, background: on ? '#eef6fd' : '#fff', alignItems: 'flex-start' }} aria-pressed={on}>
      <span style={{ fontSize: '1.1rem' }}>{on ? '🔵' : '⚪'}</span>
      <span className="info"><b>{title}</b>{help && <span className="small muted" style={{ display: 'block' }}>{help}</span>}</span>
    </button>
  );
}

export function SettingsPage() {
  const { settings, teams, sessions, attempts } = useAllData();
  const snapshots = useSnapshots();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(settings.competitionName);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');

  useEffect(() => setName(settings.competitionName), [settings.competitionName]);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024).toFixed(0)} kB`)).catch(() => {});
  }, [attempts.length]);

  async function exportAll() {
    const b = await repo.exportBackup();
    download(`fll-superpowered-copia-${today()}.json`, JSON.stringify(b, null, 2));
    toast('Còpia de seguretat descarregada 💾');
  }

  async function importAll(f: File) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(f));
    } catch {
      toast('El fitxer no és un JSON vàlid.', 'error');
      return;
    }
    const v = validateBackup(raw);
    if (!v.ok) {
      toast(`Còpia no vàlida: ${v.errors.slice(0, 3).join(' ')}`, 'error');
      return;
    }
    const ok = await confirm({
      title: 'Restaurar còpia de seguretat',
      body: (
        <div className="stack">
          <div>La còpia conté <b>{v.backup.data.teams.length} equips</b>, <b>{v.backup.data.sessions.length} sessions</b> i <b>{v.backup.data.attempts.length} intents</b> (exportada {v.backup.exportedAt ? fmtDateTime(v.backup.exportedAt) : '—'}).</div>
          <div className="violation">Substituirà <b>totes</b> les dades actuals ({teams.length} equips, {sessions.length} sessions). Abans es desarà automàticament una instantània de les dades actuals.</div>
          {v.warnings.map((w) => <div key={w} className="flag">{w}</div>)}
        </div>
      ),
      confirm: 'Restaura', danger: true,
    });
    if (!ok) return;
    try {
      const r = await repo.restoreBackup(raw);
      toast(`Restaurat: ${r.teams} equips, ${r.sessions} sessions, ${r.attempts} intents`);
    } catch (e) {
      toast(`Error en restaurar: ${(e as Error).message}`, 'error');
    }
  }

  async function loadDemo() {
    const res = parseTeamsFile(CSV_TEMPLATE, 'demo.csv', teams);
    let n = 0;
    for (const [i, r] of res.rows.entries()) if (!res.matches[i + 1]) { await repo.createTeam(r); n++; }
    toast(n ? `${n} equips d'exemple afegits` : 'Els equips d\'exemple ja hi són', n ? 'ok' : 'warn');
  }

  async function reset() {
    const typed = await confirm({
      title: 'Esborrar totes les dades',
      body: <>S'esborraran equips, sessions i resultats. Es desarà una instantània automàtica, però <b>és recomanable descarregar abans una còpia</b>. Escriviu <span className="kbd">ESBORRA</span> per confirmar.</>,
      confirm: 'Esborra-ho tot', danger: true, input: 'ESBORRA',
    });
    if (typed !== 'ESBORRA') {
      if (typed) toast('No s\'ha esborrat res (cal escriure ESBORRA).', 'warn');
      return;
    }
    await repo.resetAll();
    toast('Totes les dades s\'han esborrat');
  }

  return (
    <>
      <PageHead eyebrow="Configuració" title="Configuració i dades" sub="Mètode de classificació, opcions de la competició i còpies de seguretat." />
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 18 }}>
          <div className="card">
            <h2>🏷️ Competició</h2>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="cn">Nom de la competició</label>
              <div className="row">
                <input id="cn" className="input" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn sm" disabled={!name.trim() || name === settings.competitionName} onClick={async () => { await repo.saveSettings({ competitionName: name.trim() }); toast('Nom desat'); }}>Desa</button>
              </div>
            </div>
            <label className="row small" style={{ marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.showOfficialText} onChange={(e) => repo.saveSettings({ showOfficialText: e.target.checked })} />
              Mostra per defecte el text oficial (castellà) a la pantalla de puntuació
            </label>
          </div>

          <div className="card">
            <h2>📏 Mètode de classificació</h2>
            <p className="small muted">Configuració de l'organitzador (no és una regla oficial). El mètode actiu sempre es mostra etiquetat.</p>
            <div className="stack" style={{ gap: 8 }}>
              {(Object.keys(METHOD_LABELS) as RankingMethod[]).map((k) => (
                <Radio key={k} value={k} current={settings.rankingMethod} onChange={(v) => repo.saveSettings({ rankingMethod: v })} title={METHOD_LABELS[k].title} help={METHOD_LABELS[k].help} />
              ))}
            </div>
            <hr className="sep" />
            <h3>Resultats que compten</h3>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              {(Object.keys(SCOPE_LABELS) as ResultScope[]).map((k) => (
                <Radio key={k} value={k} current={settings.scope} onChange={(v) => repo.saveSettings({ scope: v })} title={SCOPE_LABELS[k]} />
              ))}
            </div>
            <hr className="sep" />
            <h3>Puntuació d'un equip en una sessió amb diversos intents</h3>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              {(Object.keys(AGG_LABELS) as SessionAggregation[]).map((k) => (
                <Radio key={k} value={k} current={settings.sessionAggregation} onChange={(v) => repo.saveSettings({ sessionAggregation: v })} title={AGG_LABELS[k]}
                  help={k === 'best' ? 'Coherent amb la regla oficial: només compta la millor partida (p. 6).' : 'Útil si voleu valorar la consistència.'} />
              ))}
            </div>
            <hr className="sep" />
            <h3>Empats</h3>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              {(Object.keys(TIEBREAK_LABELS) as TieBreak[]).map((k) => (
                <Radio key={k} value={k} current={settings.tieBreak} onChange={(v) => repo.saveSettings({ tieBreak: v })} title={TIEBREAK_LABELS[k]}
                  help={k === 'nextBest' ? 'Amb «Millor partida» compara la 2a i la 3a millor partida (p. 21). Amb els altres mètodes, compara les millors partides individuals (regla de l\'organitzador).' : undefined} />
              ))}
            </div>
            <hr className="sep" />
            <label className="row small" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.includeAdjustments} onChange={(e) => repo.saveSettings({ includeAdjustments: e.target.checked })} />
              Inclou els ajustos manuals a les classificacions (sempre exclosos de «Millor intent per missió»)
            </label>
          </div>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="card">
            <h2>💾 Còpia de seguretat completa</h2>
            <p className="small muted">Inclou equips, sessions, intents (amb historial de correccions) i configuració. Feu-ne una cada setmana i guardeu-la en un llapis USB o al núvol.</p>
            <div className="row">
              <button className="btn green" onClick={exportAll}>⬇ Descarrega còpia (.json)</button>
              <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Restaura una còpia…</button>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importAll(f); }} />
            </div>
            <div className="small muted" style={{ marginTop: 12 }}>
              Dades actuals: <b>{teams.length}</b> equips · <b>{sessions.length}</b> sessions · <b>{attempts.length}</b> intents{usage && <> · {usage} usats</>}
            </div>
            <div className={persisted ? 'ok-banner' : 'flag'} style={{ marginTop: 10 }}>
              {persisted
                ? '🔒 El navegador ha concedit emmagatzematge persistent: no esborrarà les dades automàticament.'
                : '⚠️ Les dades es desen a IndexedDB d\'aquest navegador i aquest ordinador. No feu servir mode privat ni «esborra dades de navegació» per a localhost, i feu còpies periòdiques.'}
            </div>
          </div>

          <div className="card">
            <h3>🕓 Instantànies automàtiques</h3>
            <p className="small muted">Es creen abans de restaurar una còpia o d'esborrar-ho tot (es guarden les 5 últimes).</p>
            {snapshots.length === 0 ? <p className="small muted">Cap instantània encara.</p> : (
              <div className="stack" style={{ gap: 8 }}>
                {snapshots.map((s) => (
                  <div key={s.id} className="row between small">
                    <span><b>{fmtDateTime(s.at)}</b> · {s.reason} · {s.backup.data.teams.length} equips, {s.backup.data.attempts.length} intents</span>
                    <span className="row" style={{ gap: 4 }}>
                      <button className="btn ghost sm" onClick={() => download(`instantania-${s.at.slice(0, 10)}.json`, JSON.stringify(s.backup, null, 2))}>⬇</button>
                      <button className="btn ghost sm" onClick={async () => {
                        const ok = await confirm({ title: 'Restaurar instantània', body: 'Substituirà les dades actuals (abans es desarà una nova instantània).', confirm: 'Restaura', danger: true });
                        if (ok) { await repo.restoreSnapshot(s.id); toast('Instantània restaurada'); }
                      }}>♻️ Restaura</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>📘 Regles carregades</h3>
            <p className="small">{RULES.meta.source}</p>
            <ul className="small muted">
              <li>Versió de regles: <span className="kbd">{RULES.meta.rulesVersion}</span></li>
              <li>{RULES.missions.length} elements puntuables · màxim teòric {FULL_GAME_MAX} punts</li>
              <li>Fitxer editable: <span className="kbd">src/data/superpowered.json</span></li>
            </ul>
            <Link to="/missions" className="btn ghost sm">Veure els punts per revisar</Link>
          </div>

          <div className="card">
            <h3>🧪 Dades d'exemple i reinici</h3>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={loadDemo}>👥 Afegeix equips d'exemple</button>
              <button className="btn red" onClick={reset}>🗑️ Esborra totes les dades</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
