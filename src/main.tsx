import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { requestPersistence } from './db/db';
import { PUBLIC_MODE, loadPublicData } from './lib/publicMode';

async function start() {
  // Vista pública: cada càrrega substitueix les dades locals per l'última còpia publicada.
  if (PUBLIC_MODE) await loadPublicData();
  else requestPersistence();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

start();
