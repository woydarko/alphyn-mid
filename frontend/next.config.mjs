import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
