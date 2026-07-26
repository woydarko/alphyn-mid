import React from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App';

// Midnight libs expect a global Buffer in the browser.
(globalThis as any).Buffer ??= Buffer;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
