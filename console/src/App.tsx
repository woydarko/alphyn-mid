import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DappProvider, useDapp } from './dapp/DappContext';
import Shell from './dapp/Shell';
import Dashboard from './pages/Dashboard';
import CreateVault from './pages/CreateVault';
import VaultDetail from './pages/VaultDetail';
import Epochs from './pages/Epochs';
import Deposit from './pages/Deposit';
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';

function Home() {
  const { vaults } = useDapp();
  return <Navigate to={vaults.length > 0 ? '/dashboard' : '/create'} replace />;
}

export default function App() {
  return (
    <DappProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateVault />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/vault/:id" element={<VaultDetail />} />
            <Route path="/vault/:id/deposit" element={<Deposit />} />
            <Route path="/vault/:id/epochs" element={<Epochs />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </DappProvider>
  );
}
