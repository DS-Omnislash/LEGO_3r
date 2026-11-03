import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MISSIONS, RULES, FULL_GAME_MAX, FULL_GAME_MAX_SIMPLE } from '../scoring/rules';
import { missionMax } from '../scoring/engine';
import { FieldMap } from '../components/FieldMap';
import { EmptyState, MissionBadge, PageHead, JOURNEY_COLORS } from '../components/ui';
import { pointsLabel } from '../components/ScoringForm';

export function MissionsPage() {
  const [q, setQ] = useState('');
  const [journey, setJourney] = useState<string>('all');
  const [tab, setTab] = useState<'cards' | 'map' | 'rules' | 'review'>('cards');

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = MISSIONS.filter((m) => {
    if (journey !== 'all' && (journey === 'general' ? m.kind !== 'general' : m.journey !== journey)) return false;
    if (!q) return true;
    const hay = norm([m.id, m.number, m.name, m.officialName, m.story, m.task, ...m.conditions.map((c) => `${c.label} ${c.official}`)].join(' '));
    return hay.includes(norm(q));
  });

  return (
    <>
      <PageHead
        eyebrow="Llibre de regles oficial"
        title="Missions SUPERPOWERED"
        sub={<>15 missions + inspecció i fitxes de precisió. Màxim teòric del joc complet: <b>{FULL_GAME_MAX} punts</b> <span className="tiny">(suma simple {FULL_GAME_MAX_SIMPLE}; limitat per les 12 unitats d'energia)</span>.</>}
      />
      <div className="tabs">
        <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>🧩 Fitxes</button>
        <button className={tab === 'map' ? 'on' : ''} onClick={() => setTab('map')}>🗺️ Terreny de joc</button>
        <button className={tab === 'rules' ? 'on' : ''} onClick={() => setTab('rules')}>📘 Regles generals</button>
        <button className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>⚠️ Punts per revisar ({RULES.reviewFlags.length})</button>
      </div>

      {tab === 'cards' && (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <div className="search" style={{ flex: 1, minWidth: 220, maxWidth: 440 }}>
              <input className="input" placeholder="Cerca: «energia», «camió», «M12», «ganxo»…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="chips">
              <button className={`chip ${journey === 'all' ? 'on' : ''}`} onClick={() => setJourney('all')}>Totes</button>
              {Object.entries(RULES.journeys).map(([k, j]) => (
                <button key={k} className={`chip ${journey === k ? 'on' : ''}`} onClick={() => setJourney(k)}>
                  <span className="pill-legend" style={{ background: JOURNEY_COLORS[k] }} />{j.label.replace('Viatge de l\'energia ', 'Energia ')}
                </button>
              ))}
              <button className={`chip ${journey === 'general' ? 'on' : ''}`} onClick={() => setJourney('general')}>Generals</button>
            </div>
          </div>
          {list.length === 0 ? (
            <div className="card"><EmptyState icon="🔍" title="Cap missió coincideix">Proveu una altra paraula.</EmptyState></div>
          ) : (
            <div className="grid auto">
              {list.map((m, i) => (
                <Link key={m.id} to={`/missions/${m.id}`} className="card mcard rise" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="top">
                    <MissionBadge mission={m} />
                    <div>
                      <div className="nm">{m.name}</div>
                      <div className="on">{m.officialName}</div>
                    </div>
                  </div>
                  <p className="desc">{m.task}</p>
                  <div className="pts">
                    {m.conditions.filter((c) => c.type !== 'check').map((c) => (
                      <span key={c.id} className={`pt-pill ${c.bonus ? 'bonus' : ''}`} title={c.label}>{c.bonus ? '★ ' : ''}{pointsLabel(c)}</span>
                    ))}
                    {m.conditions.some((c) => c.type === 'check') && <span className="badge">🔎 verificació</span>}
                    {(m.reviewFlags?.length ?? 0) > 0 && <span className="badge yellow">⚠️ revisar</span>}
                  </div>
                  <div className="maxline">
                    <span className="small muted">p. {m.pages.join(', ')}</span>
                    <span>Màx. <span className="max">{missionMax(m)}</span></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'map' && (
        <div className="card">
          <div className="card-head">
            <div><h2>Terreny de joc</h2><p>Feu clic en una missió per veure'n el detall. Colors segons el «viatge de l'energia».</p></div>
            <div className="chips">
              {Object.entries(RULES.journeys).map(([k, j]) => (
                <span key={k} className="badge"><span className="pill-legend" style={{ background: JOURNEY_COLORS[k] }} />{j.label}</span>
              ))}
              <span className="badge"><span className="pill-legend" style={{ background: '#e3000b' }} />Sense viatge assignat</span>
            </div>
          </div>
          <FieldMap />
        </div>
      )}

      {tab === 'rules' && (
        <div className="grid cols-2">
          {RULES.officialRules.map((r) => (
            <div key={r.title} className="card tight">
              <div className="row between"><h3>{r.title}</h3><span className="badge red">p. {r.page}</span></div>
              <p className="small" style={{ margin: '8px 0 0' }}>{r.text}</p>
            </div>
          ))}
          <div className="card tight" style={{ gridColumn: '1 / -1' }}>
            <h3>Gracious Professionalism®</h3>
            <p className="small">{RULES.graciousProfessionalism.note}</p>
            <div className="official">{RULES.graciousProfessionalism.official}</div>
          </div>
          <div className="card tight" style={{ gridColumn: '1 / -1' }}>
            <h3>Font</h3>
            <p className="small muted" style={{ margin: '6px 0 0' }}>{RULES.meta.source}</p>
            <ul className="small">{RULES.meta.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        </div>
      )}

      {tab === 'review' && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Punts que l'organitzador ha de revisar</h2>
              <p>Detalls que el PDF no deixa del tot clars o que l'aplicació ha hagut de deduir. Cap d'aquests punts s'ha inventat: s'expliquen i es poden ajustar a <span className="kbd">src/data/superpowered.json</span>.</p>
            </div>
          </div>
          <div className="stack">
            {RULES.reviewFlags.map((f) => (
              <div key={f.id} className="flag">
                {f.mission && <Link to={`/missions/${f.mission}`} className="badge dark" style={{ marginRight: 8, textDecoration: 'none' }}>{f.mission}</Link>}
                {f.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
