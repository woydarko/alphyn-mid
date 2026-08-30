import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DappProvider } from './dapp/DappContext';
import Shell from './dapp/Shell';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CreateVault from './pages/CreateVault';
import VaultDetail from './pages/VaultDetail';
import Epochs from './pages/Epochs';
import Deposit from './pages/Deposit';
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 560, margin: '80px auto', padding: 24, fontFamily: 'Outfit, system-ui, sans-serif', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Something went wrong</h1>
          <p style={{ color: '#8A7D74', marginTop: 8 }}>{this.state.error.message}</p>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 16, padding: '10px 18px', background: '#8B5CF6', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
    <DappProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Shell />}>
            <Route path="/create" element={<CreateVault />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/vault/:id" element={<VaultDetail />} />
            <Route path="/vault/:id/deposit" element={<Deposit />} />
            <Route path="/vault/:id/epochs" element={<Epochs />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </DappProvider>
    </ErrorBoundary>
  );
}
