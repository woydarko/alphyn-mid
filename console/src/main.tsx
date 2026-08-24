import React from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App';
import './index.css';

// Midnight libs expect a global Buffer in the browser.
(globalThis as any).Buffer ??= Buffer;

// StrictMode intentionally disabled while diagnosing Preprod submits: its dev-only
// double-invocation was firing mint twice, producing duplicate wallet submits that
// the node temporarily bans (masking the real rejection). Re-enable once stable.
createRoot(document.getElementById('root')!).render(<App />);
