// At-rest protection for the private vault fields (secret, nonce, allocation).
//
// The encryption key is derived from a wallet signature over a fixed message, so
// it is never written anywhere: only the wallet owner can reproduce it, and a
// page-level attacker (XSS, malicious extension) cannot decrypt localStorage
// without prompting the wallet to sign — which the user sees. If the wallet has
// no signData, callers fall back to keeping secrets in memory only (never on
// disk in plaintext).

const KEY_MESSAGE = 'alphyn-vault-encryption-v1';
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const ub64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface Sealed {
  iv: string;
  ct: string;
}

/** Derive an AES-GCM key from a wallet signature, or null if signing is unavailable. */
export async function deriveVaultKey(api: any): Promise<CryptoKey | null> {
  if (!api || typeof api.signData !== 'function') return null;
  try {
    const sig = await api.signData(KEY_MESSAGE, { encoding: 'text', keyType: 'unshielded' });
    const material = enc.encode(`${sig.signature}|${sig.verifyingKey}`);
    const hash = await crypto.subtle.digest('SHA-256', material);
    return await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

export async function seal(key: CryptoKey, obj: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export async function unseal<T>(key: CryptoKey, blob: Sealed): Promise<T | null> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(blob.iv) }, key, ub64(blob.ct));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}
