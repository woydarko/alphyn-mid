'use client';

// Midnight wallet layer - replaces wagmi/RainbowKit/SIWE.
//
// Wallet-agnostic: discovers any injected Midnight connector at window.midnight.*
// (1AM, Lace, …) and connects. Connecting IS the auth (no SIWE / server session).
//
// Defensively supports BOTH DApp-connector generations, since this can only be
// verified in-browser with a real wallet:
//   • v4 (Jan 2026): connector.connect(networkId) -> ConnectedAPI with
//     getUnshieldedAddress()/getConfiguration()/getConnectionStatus()
//   • legacy: connector.enable() -> WalletAPI with state()/serviceUriConfig()

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const MIDNIGHT_NETWORK = process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? 'preview';
// Preference order when multiple wallets are present.
const PREFERRED_WALLETS = ['1am', 'mnLace', 'lace'];

export interface ServiceUris {
  indexerUri?: string;
  indexerWsUri?: string;
  proverServerUri?: string;
  substrateNodeUri?: string;
}

// Structural type covering both connector generations; every method optional so
// we can feature-detect at runtime without pinning a connector version.
export interface MidnightConnector {
  name?: string;
  apiVersion?: string;
  isEnabled?(): Promise<boolean>;
  enable?(): Promise<WalletAPI>;
  connect?(networkId: string): Promise<WalletAPI>;
  serviceUriConfig?(): Promise<ServiceUris>;
}

export interface WalletAPI {
  state?(): Promise<{ address: string; coinPublicKey?: string }>;
  getUnshieldedAddress?(): Promise<string>;
  getShieldedAddresses?(): Promise<{ shieldedAddress: string }>;
  getConfiguration?(): Promise<ServiceUris>;
  balanceAndProveTransaction?(tx: unknown, newCoins?: unknown): Promise<unknown>;
  balanceTransaction?(tx: unknown, newCoins?: unknown): Promise<unknown>;
  submitTransaction?(tx: unknown): Promise<string>;
}

declare global {
  interface Window {
    midnight?: Record<string, MidnightConnector>;
  }
}

interface WalletContextValue {
  connected: boolean;
  connecting: boolean;
  walletName?: string;
  address?: string;
  api?: WalletAPI;
  uris?: ServiceUris;
  error?: string;
  connect(): Promise<void>;
  disconnect(): void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function pickConnector(): { key: string; connector: MidnightConnector } | undefined {
  if (typeof window === 'undefined') return undefined;
  const injected = window.midnight ?? {};
  const keys = Object.keys(injected);
  if (keys.length === 0) return undefined;
  const key = PREFERRED_WALLETS.find((k) => injected[k]) ?? keys[0];
  return { key, connector: injected[key] };
}

async function openApi(connector: MidnightConnector): Promise<WalletAPI> {
  if (typeof connector.connect === 'function') return connector.connect(MIDNIGHT_NETWORK);
  if (typeof connector.enable === 'function') return connector.enable();
  throw new Error('wallet exposes neither connect() nor enable()');
}

// Different wallets return an address as either a plain string or an object
// like { unshieldedAddress } / { shieldedAddress } / { address }. Normalize.
function extractAddr(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  return v.unshieldedAddress ?? v.shieldedAddress ?? v.address ?? undefined;
}

async function readAddress(api: WalletAPI): Promise<string | undefined> {
  if (typeof api.getUnshieldedAddress === 'function') return extractAddr(await api.getUnshieldedAddress());
  if (typeof api.getShieldedAddresses === 'function') return extractAddr(await api.getShieldedAddresses());
  if (typeof api.state === 'function') return extractAddr(await api.state());
  return undefined;
}

async function readUris(api: WalletAPI, connector: MidnightConnector): Promise<ServiceUris | undefined> {
  if (typeof api.getConfiguration === 'function') return api.getConfiguration();
  if (typeof connector.serviceUriConfig === 'function') return connector.serviceUriConfig();
  return undefined;
}

export function MidnightWalletProvider({ children }: { children: React.ReactNode }) {
  const [connecting, setConnecting] = useState(false);
  const [api, setApi] = useState<WalletAPI>();
  const [address, setAddress] = useState<string>();
  const [walletName, setWalletName] = useState<string>();
  const [uris, setUris] = useState<ServiceUris>();
  const [error, setError] = useState<string>();

  const connect = useCallback(async () => {
    const picked = pickConnector();
    if (!picked) {
      setError('No Midnight wallet found. Install a wallet (e.g. 1AM) in Chrome and switch it to ' + MIDNIGHT_NETWORK + '.');
      return;
    }
    setConnecting(true);
    setError(undefined);
    try {
      const walletApi = await openApi(picked.connector);
      const [addr, serviceUris] = await Promise.all([
        readAddress(walletApi),
        readUris(walletApi, picked.connector),
      ]);
      setApi(walletApi);
      setAddress(addr);
      setUris(serviceUris);
      setWalletName(picked.connector.name ?? picked.key);
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setApi(undefined);
    setAddress(undefined);
    setUris(undefined);
    setWalletName(undefined);
    setError(undefined);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      connected: Boolean(address),
      connecting,
      walletName,
      address,
      api,
      uris,
      error,
      connect,
      disconnect,
    }),
    [address, connecting, walletName, api, uris, error, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useMidnightWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useMidnightWallet must be used within MidnightWalletProvider');
  return ctx;
}

/** Short display form of a Midnight bech32m address. */
export function shortAddress(addr?: string): string {
  if (!addr) return '';
  return addr.length > 16 ? `${addr.slice(0, 10)}…${addr.slice(-4)}` : addr;
}
