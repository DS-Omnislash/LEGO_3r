import { NavLink, Outlet } from 'react-router-dom';
import { useSettings } from '../db/hooks';
import { RULES } from '../scoring/rules';
import { PUBLIC_MODE, publicUpdatedAt } from '../lib/publicMode';

export const NAV = [
  { to: '/', label: 'Tauler', ico: '🏠', end: true },
  { to: '/teams', label: 'Equips', ico: '👥' },
  { to: '/missions', label: 'Missions', ico: '🧩' },
  { to: '/sessions', label: 'Sessions', ico: '📅' },
  { to: '/scoreboard', label: 'Classificació', ico: '🏆' },
  { to: '/stats', label: 'Estadístiques', ico: '📊' },
  { to: '/settings', label: 'Configuració', ico: '⚙️' },
];

export function Layout() {
  const settings = useSettings();
  const nav = PUBLIC_MODE ? NAV.filter((n) => n.to !== '/settings') : NAV;
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><span>⚡</span></div>
          <div className="brand-title">
            SUPERPOWERED
            <small>Seguiment FLL</small>
          </div>
        </div>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <b>{settings.competitionName}</b>
          <br />
          Regles: {RULES.meta.season}
          <br />
          {PUBLIC_MODE ? `Vista alumnes · actualitzat ${publicUpdatedAt()}` : 'Dades desades en aquest ordinador.'}
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <nav className="mobile-nav">
        {nav.filter((n) => n.to !== '/stats').map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
