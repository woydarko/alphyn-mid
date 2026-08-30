import { describe, it, expect } from 'vitest';
import {
  generateStrategy,
  normalizeAllocation,
  toPrivateState,
  categoryOrdinal,
  type Questionnaire,
} from '../src/strategy.js';

describe('strategy generation', () => {
  it('normalizes weights to integers summing to 100 and zeroes disallowed assets', () => {
    const a = normalizeAllocation({ DJED: 10, ADA: 20, NIGHT: 5, SNEK: 5 }, ['DJED', 'ADA']);
    expect(a[2]).toBe(0); // NIGHT disallowed
    expect(a[3]).toBe(0); // SNEK disallowed
    expect(a.reduce((s, v) => s + v, 0)).toBe(100);
  });

  it('generates a valid strategy via the mock (no API key)', async () => {
    const q: Questionnaire = {
      riskLevel: 4,
      horizon: 'mid',
      assets: ['DJED', 'ADA', 'NIGHT', 'SNEK'],
      targetApy: 'high',
      maxDrawdown: '20',
    };
    const s = await generateStrategy(q);
    expect(s.allocation.reduce((x, v) => x + v, 0)).toBe(100);
    expect(s.category).toBe('aggressive');
    expect(s.assetCount).toBe(s.allocation.filter((w) => w > 0).length);
    expect(categoryOrdinal(s.category)).toBe(2);
  });

  it('respects a restricted asset set', async () => {
    const q: Questionnaire = {
      riskLevel: 1,
      horizon: 'long',
      assets: ['DJED', 'ADA'],
      targetApy: 'low',
      maxDrawdown: '5',
    };
    const s = await generateStrategy(q);
    expect(s.allocation[2]).toBe(0);
    expect(s.allocation[3]).toBe(0);
    expect(s.allocation.reduce((x, v) => x + v, 0)).toBe(100);
    expect(s.category).toBe('conservative');
  });

  it('builds private state with 32-byte secret/nonce and bigint allocation', async () => {
    const s = await generateStrategy({
      riskLevel: 3, horizon: 'mid', assets: ['DJED', 'ADA', 'NIGHT'],
      targetApy: 'mid', maxDrawdown: '10',
    });
    const ps = toPrivateState(s);
    expect(ps.secretKey.length).toBe(32);
    expect(ps.nonce.length).toBe(32);
    expect(ps.allocation.every((w) => typeof w === 'bigint')).toBe(true);
    expect(ps.allocation.reduce((x, v) => x + v, 0n)).toBe(100n);
  });
});
