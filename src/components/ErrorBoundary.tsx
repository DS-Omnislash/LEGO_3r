import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 40, maxWidth: 640, margin: '0 auto' }}>
        <div className="card">
          <h2>😵 Alguna cosa ha fallat</h2>
          <p className="muted">Les dades estan desades a la base de dades local i no s'han perdut. Torneu a carregar la pàgina.</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f6f3ea', padding: 12, borderRadius: 10 }}>{this.state.error.message}</pre>
          <button className="btn" onClick={() => location.reload()}>Torna a carregar</button>
        </div>
      </div>
    );
  }
}
