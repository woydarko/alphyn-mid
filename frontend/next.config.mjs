import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The wallet/ZK dApp is a Vite build (Midnight's WASM stack does not bundle under
// webpack). It is built with base '/app/' and its static output is served under the
// same origin from public/app, so the whole site is one app at one URL. The rewrite
// maps the bare /app path to the SPA's index.html; all assets are plain public files.
// Rebuild with `cd console && vite build` then copy dist to frontend/public/app.

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [{ source: '/app', destination: '/app/index.html' }];
  },
  webpack: (config, { isServer }) => {
    // Route residual EVM imports to Midnight-backed shims during the migration.
    config.resolve.alias = {
      ...config.resolve.alias,
      wagmi: path.resolve(__dirname, 'src/lib/shims/wagmi.tsx'),
      '@rainbow-me/rainbowkit': path.resolve(__dirname, 'src/lib/shims/rainbowkit.tsx'),
      'viem/chains': path.resolve(__dirname, 'src/lib/shims/viem-chains.ts'),
      viem: path.resolve(__dirname, 'src/lib/shims/viem.ts'),
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'react-native': false,
      };
    }
    return config;
  },
};

export default nextConfig;
