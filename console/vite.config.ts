import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// Mirrors the proven example-bboard UI build (Vite 8 / Rolldown) for the
// Midnight wasm stack. See midnightntwrk/example-bboard (Apache-2.0).
export default defineConfig({
  // Served under /app on the unified site (Next rewrites /app/* here). All asset
  // URLs become /app/... so they resolve both standalone and behind the proxy.
  base: '/app/',
  cacheDir: './.vite',
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('onchain-runtime-v3')) return 'wasm';
        },
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      extensions: ['.js', '.cjs'],
      ignoreDynamicRequires: true,
    },
  },
  plugins: [
    react(),
    wasm(),
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: (i) => `__tla_${i}`,
    }),
    {
      name: 'wasm-module-resolver',
      resolveId(source: string, importer: string | undefined) {
        if (
          source === '@midnight-ntwrk/onchain-runtime-v3' &&
          importer &&
          importer.includes('@midnight-ntwrk/compact-runtime')
        ) {
          return { id: source, external: false, moduleSideEffects: true };
        }
        return null;
      },
    },
  ],
  optimizeDeps: {
    include: ['@midnight-ntwrk/compact-runtime'],
    exclude: [
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm',
      '@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm.js',
    ],
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.wasm'],
    mainFields: ['browser', 'module', 'main'],
  },
});
