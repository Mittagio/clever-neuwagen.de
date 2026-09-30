import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Die App konnte nicht geladen werden</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fef2f2', padding: '1rem', borderRadius: 8, fontSize: 14 }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <p style={{ marginTop: '1rem', color: '#64748b' }}>
            Tipp: Seite neu laden. Wenn das weiter passiert, Browser-Daten für localhost leeren.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.75rem',
              padding: '0.55rem 0.9rem',
              borderRadius: 8,
              border: 'none',
              background: '#1c1b19',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
