import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { TeamsPage } from './pages/Teams';
import { MissionsPage } from './pages/Missions';
import { MissionDetail } from './pages/MissionDetail';
import { SessionsPage } from './pages/Sessions';
import { SessionDetail } from './pages/SessionDetail';
import { Scoreboard } from './pages/Scoreboard';
import { StatsPage } from './pages/Stats';
import { SettingsPage } from './pages/Settings';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="teams" element={<TeamsPage />} />
                <Route path="missions" element={<MissionsPage />} />
                <Route path="missions/:id" element={<MissionDetail />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="sessions/:id" element={<SessionDetail />} />
                <Route path="scoreboard" element={<Scoreboard />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </HashRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
