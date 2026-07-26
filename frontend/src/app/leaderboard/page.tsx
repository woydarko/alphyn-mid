'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Trophy, TrendingUp, TrendingDown, Users, History, ArrowRight, Loader2, Lock, ShieldCheck, Filter, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { AlphynVaultABI } from '@/lib/abi/AlphynVault';

export default function LeaderboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [vaults, setVaults] = useState<any[]>([]);
  const [userVaultId, setUserVaultId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState('pnl');
  const [timeframe, setTimeframe] = useState('all');
  const [page, setPage] = useState(1);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<any>(null);
  const [allocation, setAllocation] = useState(20);

  // 1. Check if user has a vault (to enable following)
  useEffect(() => {
    if (isConnected && address) {
      fetch('/api/vault/my')
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) setUserVaultId(data[0].chainVaultId);
        })
        .catch(console.error);
    }
  }, [isConnected, address]);

  // 2. Fetch Leaderboard
  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?sort=${sort}&timeframe=${timeframe}&page=${page}`);
      const data = await res.json();
      setVaults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [sort, timeframe, page]);

  // 3. Follow Flow
  const { data: followHash, writeContract: followVault, isPending: isFollowSubmitting } = useWriteContract();
  const { isLoading: isFollowWaiting } = useWaitForTransactionReceipt({ hash: followHash });

  const handleFollow = async () => {
    if (!selectedVault || !userVaultId) return;

    try {
      // Step A: Update our DB first (provides calldata)
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetVaultId: selectedVault.chainVaultId,
          allocationPct: allocation
        })
      });
      const { calldata } = await res.json();

      // Step B: Submit on-chain
      followVault({
        address: calldata.address,
        abi: AlphynVaultABI,
        functionName: 'followVault',
        args: calldata.args,
      });

      setIsFollowModalOpen(false);
    } catch (err) {
      console.error('Follow failed', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-alphyn-text font-sans p-6 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Trophy className="text-yellow-500 w-10 h-10" /> Hall of Alphyns
            </h1>
            <p className="text-alphyn-textMuted font-medium">DeFi's most elite sealed-strategy vaults. Track, learn, and follow.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {['pnl', 'sharpe', 'drawdown', 'epochs'].map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                  sort === s ? 'bg-alphyn-orange text-white border-white' : 'bg-alphyn-surface text-alphyn-textMuted border-alphyn-surfaceBorder hover:border-alphyn-surfaceBorder'
                }`}
              >
                {s === 'pnl' ? 'PnL %' : s === 'sharpe' ? 'Sharpe' : s === 'drawdown' ? 'Drawdown' : 'Epochs'}
              </button>
            ))}
            <div className="w-px h-6 bg-alphyn-surfaceBorder mx-2 hidden md:block" />
             {['24h', '7d', '30d', 'all'].map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  timeframe === t ? 'text-blue-500 underline underline-offset-8 decoration-2' : 'text-alphyn-textMuted hover:text-alphyn-textMuted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-alphyn-surfaceBorder text-alphyn-textMuted text-[10px] uppercase font-bold tracking-widest bg-alphyn-surface">
                <th className="px-6 py-4 w-12 text-center">Rank</th>
                <th className="px-6 py-4">Vault</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Performance</th>
                <th className="px-6 py-4 hidden md:table-cell">Sharpe</th>
                <th className="px-6 py-4 hidden md:table-cell">Drawdown</th>
                <th className="px-6 py-4 w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-alphyn-surfaceBorder">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-8"><div className="h-4 bg-alphyn-surfaceBorder rounded w-full" /></td>
                  </tr>
                ))
              ) : vaults.map((v) => (
                <tr key={v.chainVaultId} className="hover:bg-alphyn-surface transition-colors group">
                  <td className="px-6 py-6 text-center">
                    <span className={`text-sm font-mono font-bold ${v.rank <= 3 ? 'text-yellow-500' : 'text-alphyn-textMuted'}`}>
                      {v.rank.toString().padStart(2, '0')}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-alphyn-text group-hover:text-alphyn-orange transition-colors">{v.vaultName}</span>
                        {v.chainVaultId === userVaultId && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded font-bold border border-blue-500/20">YOU</span>}
                      </div>
                      <span className="text-[10px] text-alphyn-textMuted font-mono">{v.chainVaultId.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                     <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      v.category === 'aggressive' ? 'bg-orange-500/10 text-orange-400' :
                      v.category === 'balanced' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
                    }`}>
                      {v.category}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold font-mono ${v.pnlBps >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {v.pnlBps >= 0 ? '+' : ''}{(v.pnlBps / 100).toFixed(2)}%
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-alphyn-textMuted font-bold uppercase">
                        <Users className="w-3 h-3" /> {v.followerCount}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 hidden md:table-cell">
                    <span className="text-sm font-mono text-alphyn-textMuted">{v.sharpeRatio.toFixed(2)}</span>
                  </td>
                   <td className="px-6 py-6 hidden md:table-cell">
                    <span className="text-sm font-mono text-red-600/80">{(v.maxDrawdownBps / 100).toFixed(2)}%</span>
                  </td>
                  <td className="px-6 py-6">
                    {v.chainVaultId === userVaultId ? (
                      <button 
                         onClick={() => router.push(`/vault/${v.chainVaultId}`)}
                         className="p-2 rounded-full bg-alphyn-orange text-white hover:bg-alphyn-orangeDeep transition-all"
                      >
                         <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        disabled={!userVaultId}
                        onClick={() => { setSelectedVault(v); setIsFollowModalOpen(true); }}
                        className="px-4 py-1.5 text-xs font-bold rounded-lg bg-alphyn-surface border border-alphyn-surfaceBorder hover:border-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Follow
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="flex items-center justify-between px-8 py-6 bg-alphyn-surface">
            <p className="text-[10px] font-bold text-alphyn-textMuted uppercase tracking-widest">Page {page}</p>
            <div className="flex gap-2">
               <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 border border-alphyn-surfaceBorder rounded-lg disabled:opacity-20 translate-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                   onClick={() => setPage(p => p + 1)}
                   className="p-2 border border-alphyn-surfaceBorder rounded-lg translate-x-1"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
            </div>
          </div>
        </div>

        {/* Tooltip for no vault */}
        {!userVaultId && isConnected && (
            <div className="text-center py-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center gap-3">
                <Info className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-400 font-medium">Create your own vault to unlock following capabilities.</span>
                <button onClick={() => router.push('/create')} className="text-xs font-bold text-blue-500 underline">Get Started</button>
            </div>
        )}

        {/* Follow Modal */}
        {isFollowModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-alphyn-surface border border-alphyn-surfaceBorder w-full max-w-md rounded-3xl p-8 space-y-8 animate-in fade-in zoom-in duration-200">
               <div className="space-y-2">
                 <h2 className="text-2xl font-bold">Follow Strategy</h2>
                 <p className="text-alphyn-textMuted text-sm italic">You are following <span className="text-alphyn-text font-bold">{selectedVault?.vaultName}</span></p>
               </div>

               <div className="space-y-6">
                 <div>
                   <div className="flex justify-between text-xs font-bold uppercase text-alphyn-textMuted mb-4">
                     <span>Deployment Proportion</span>
                     <span className="text-alphyn-text font-black">{allocation}%</span>
                   </div>
                   <input 
                     type="range" min="1" max="100" 
                     value={allocation} 
                     onChange={(e) => setAllocation(parseInt(e.target.value))}
                     className="w-full accent-blue-500 bg-alphyn-surfaceBorder"
                   />
                   <p className="text-[10px] text-alphyn-textMuted mt-4 leading-relaxed italic">
                     * This percentage of your vault's available USDC will mirror the target's movements. 
                     The remaining stays in your current strategy.
                   </p>
                 </div>

                 <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
                    <p className="text-[10px] text-blue-400 leading-normal">
                       Following an Alphyn vault is an on-chain action. You will sign a transaction and pay a small gas fee.
                    </p>
                 </div>

                 <div className="flex gap-3">
                   <button 
                     onClick={() => setIsFollowModalOpen(false)}
                     className="flex-1 py-3 bg-neutral-950 border border-alphyn-surfaceBorder text-alphyn-textMuted font-bold rounded-xl hover:text-alphyn-orange transition-all"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleFollow}
                     disabled={isFollowSubmitting || isFollowWaiting}
                     className="flex-1 py-3 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all flex items-center justify-center gap-2"
                   >
                     {isFollowSubmitting || isFollowWaiting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                   </button>
                 </div>
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
