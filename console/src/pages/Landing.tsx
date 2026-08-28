import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, Users, ArrowRight, Globe, MessageCircle, Layers, Zap, Code2,
  ChevronRight, BarChart3, Activity, Cpu, ArrowUpRight, Wallet, Info, AlertTriangle,
} from 'lucide-react';
import { useDapp } from '../dapp/DappContext';

const CAT = ['conservative', 'balanced', 'aggressive'];
// Local bridge by default; set VITE_BRIDGE_URL when the executor is hosted (e.g.
// a deployed showcase points at a public bridge, or leaves it unset to skip).
const BRIDGE = (import.meta.env.VITE_BRIDGE_URL as string | undefined) ?? 'http://localhost:6363';
// Public assets resolve against Vite's base ('/app/'), so prefix with BASE_URL
// rather than a bare '/…' which would 404 under the app's base path.
const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

function ScrollReveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const { phase, connect, address, wrongNetwork } = useDapp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topVaults, setTopVaults] = useState<any[]>([]);

  const connected = phase === 'ready';
  const connecting = busy || phase === 'connecting';

  // Connect the Midnight wallet (identity + it signs each mint), then enter the
  // strategy quiz. On rejection or no wallet, stay on the landing with an error.
  const launchApp = async () => {
    if (connected) {
      nav('/create');
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await connect();
    setBusy(false);
    if (ok) nav('/create');
    else setError('Connect a Midnight wallet (1AM or Lace) on Preprod to launch.');
  };

  // Best-effort live preview from the local bridge; silently empty if it is down.
  useEffect(() => {
    fetch(`${BRIDGE}/leaderboard`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) =>
        setTopVaults(
          Array.isArray(data)
            ? data.filter((v: any) => v.active).sort((a: any, b: any) => Number(b.netPnlScaled) - Number(a.netPnlScaled)).slice(0, 3)
            : [],
        ),
      )
      .catch(() => setTopVaults([]));
  }, []);

  return (
    <div className="min-h-screen bg-background text-alphyn-text selection:bg-alphyn-orange/30 font-sans flex flex-col">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float1 { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-20px) } }
        @keyframes float2 { 0%, 100% { transform: translateY(0) rotate(12deg) translateX(8rem) translateY(3rem) } 50% { transform: translateY(-15px) rotate(12deg) translateX(8rem) translateY(3rem) } }
        @keyframes float3 { 0%, 100% { transform: translateY(0) rotate(-6deg) translateX(-8rem) translateY(-4rem) } 50% { transform: translateY(-15px) rotate(-6deg) translateX(-8rem) translateY(-4rem) } }
        .animate-float-1 { animation: float1 6s ease-in-out infinite; }
        .animate-float-2 { animation: float2 7.5s ease-in-out infinite; }
        .animate-float-3 { animation: float3 8s ease-in-out infinite; }
      `}} />

      {wrongNetwork && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm font-bold px-6 py-2.5 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Switch your wallet to Preprod to transact safely.
        </div>
      )}

      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-alphyn-surfaceBorder">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={asset('/logo/logo-orange.png')} alt="Alphyn" className="w-10 h-10 rounded-xl shadow-lg shadow-alphyn-orange/20 group-hover:scale-105 transition-transform" />
            <span className="text-2xl font-black tracking-tighter">Alphyn</span>
          </div>

          <div className="hidden lg:flex items-center gap-10">
            <a href="#how-it-works" className="text-sm font-bold text-alphyn-textMuted hover:text-alphyn-orange transition-colors uppercase tracking-widest">Mechanism</a>
            <a href="#leaderboard" className="text-sm font-bold text-alphyn-textMuted hover:text-alphyn-orange transition-colors uppercase tracking-widest">Leaderboard</a>
            {connected && (
              <button onClick={() => nav('/dashboard')} className="text-sm font-bold text-alphyn-text hover:text-alphyn-orange transition-colors uppercase tracking-widest">Dashboard</button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {connected && address ? (
              <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-alphyn-surfaceBorder text-xs font-mono font-semibold text-alphyn-textMuted">
                <Wallet className="w-3.5 h-3.5 text-alphyn-orange" /> {address.slice(0, 10)}…{address.slice(-5)}
              </span>
            ) : (
              <button
                onClick={launchApp}
                disabled={connecting}
                className="px-5 py-2.5 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all disabled:opacity-60"
              >
                {connecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-20">
        {/* Hero */}
        <section className="relative px-6 lg:px-12 pt-8 pb-24 max-w-7xl mx-auto overflow-hidden">
          <div className="absolute top-20 right-10 lg:right-32 w-64 h-64 bg-alphyn-orange/10 blur-[100px] rounded-full -z-10 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-10 left-10 lg:left-32 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full -z-10" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10 z-10">
              <h1 className="text-6xl lg:text-7xl xl:text-[5.5rem] font-black tracking-tight leading-[1.05]">
                AI-generated<br />
                <span className="relative inline-block cursor-crosshair group/secret">
                  <span className="inline-block text-alphyn-text/10 blur-[4px] transition-all duration-700 group-hover/secret:opacity-0 group-hover/secret:blur-xl">private</span>
                  <span className="absolute left-0 top-0 opacity-0 group-hover/secret:opacity-100 group-hover/secret:-translate-y-2 transition-all duration-700 bg-clip-text text-transparent bg-gradient-to-br from-[#8B5CF6] via-[#A78BFA] to-[#DDD6FE] drop-shadow-[0_10px_25px_rgba(139,92,246,0.6)]">private</span>
                </span><br />
                vault strategy.
              </h1>

              <p className="text-xl text-alphyn-textMuted leading-relaxed max-w-lg font-medium">
                AI builds your strategy. A zero-knowledge proof keeps it private on Midnight — only aggregate PnL is ever public.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-5 pt-4">
                <button
                  onClick={launchApp} disabled={connecting}
                  className="w-full sm:w-auto px-10 py-5 bg-[#8B5CF6] text-white font-black text-lg rounded-2xl active:translate-y-1 active:border-b-0 hover:bg-[#7C3AED] transition-all flex items-center justify-center gap-3 border-b-4 border-[#6D28D9] shadow-xl shadow-purple-500/20 disabled:opacity-60"
                >
                  {connecting ? 'Connecting…' : connected ? 'Launch App' : 'Connect & Launch'} <ArrowRight className="w-5 h-5" />
                </button>
                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto px-10 py-5 bg-alphyn-surface border border-alphyn-surfaceBorder text-alphyn-text font-black text-lg rounded-2xl hover:bg-alphyn-surfaceHover hover:border-alphyn-orange/60 transition-all text-center"
                >
                  See How It Works
                </a>
              </div>
              {error && <p className="text-sm text-red-400 max-w-md break-words">{error}</p>}
            </div>

            {/* Hero Visual */}
            <div className="relative h-[500px] w-full hidden lg:block">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-float-1 relative z-20 w-80 bg-background border border-alphyn-surfaceBorder rounded-3xl p-6 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-alphyn-orange rounded-xl flex items-center justify-center shadow-inner">
                      <Lock className="text-white w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/10 text-green-600 border border-green-500/20 uppercase tracking-widest">Active</span>
                  </div>
                  <h3 className="font-bold text-xl mb-1">Alpha Strategy X</h3>
                  <p className="text-sm text-alphyn-textMuted mb-6 font-medium">Strategy kept private with zero-knowledge proofs.</p>
                  <div className="space-y-3">
                    <div className="h-2 bg-alphyn-surfaceBorder rounded-full overflow-hidden">
                      <div className="h-full bg-alphyn-orange w-3/4"></div>
                    </div>
                    <div className="flex justify-between text-sm font-bold font-mono">
                      <span className="text-alphyn-textMuted uppercase tracking-widest font-sans text-xs">TVL</span>
                      <span>$142,500</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold font-mono">
                      <span className="text-alphyn-textMuted uppercase tracking-widest font-sans text-xs">APY</span>
                      <span className="text-green-600">+14.2%</span>
                    </div>
                  </div>
                </div>

                <div className="animate-float-2 absolute z-10 w-72 bg-alphyn-surface/90 border border-alphyn-surfaceBorder rounded-3xl p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-3 mb-4">
                    <Cpu className="w-8 h-8 text-blue-500" />
                    <span className="font-bold text-sm uppercase tracking-widest text-alphyn-textMuted">AI Model</span>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2.5 bg-alphyn-surfaceBorder rounded-full w-full"></div>
                    <div className="h-2.5 bg-alphyn-surfaceBorder rounded-full w-5/6"></div>
                    <div className="h-2.5 bg-alphyn-surfaceBorder rounded-full w-4/6"></div>
                  </div>
                </div>

                <div className="animate-float-3 absolute z-10 w-72 bg-alphyn-surface/90 border border-alphyn-surfaceBorder rounded-3xl p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="w-8 h-8 text-green-600" />
                    <span className="font-bold text-sm uppercase tracking-widest text-alphyn-textMuted">Market Analysis</span>
                  </div>
                  <div className="flex items-end gap-2 h-14 mt-4">
                    <div className="w-1/4 bg-green-500/20 border border-green-500/30 rounded-t h-1/2"></div>
                    <div className="w-1/4 bg-green-500/40 border border-green-500/50 rounded-t h-3/4"></div>
                    <div className="w-1/4 bg-green-500/60 border border-green-500/70 rounded-t h-full"></div>
                    <div className="w-1/4 bg-green-500 rounded-t h-5/6 shadow-[0_0_15px_rgba(34,197,94,0.4)]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DEX note */}
          <div className="mt-8 flex gap-2 bg-alphyn-orange/5 border border-alphyn-orange/20 rounded-2xl px-4 py-3 max-w-3xl">
            <Info className="w-4 h-4 text-alphyn-orange shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-alphyn-textMuted">
              <span className="font-bold text-alphyn-text">Note:</span> Vaults custody real tNIGHT on-chain (deposit/withdraw are live circuits).
              Allocations stay private, PnL is proven in zero-knowledge, and oracle-priced basket swaps are rolling out (see the Path A plan).
            </p>
          </div>
        </section>

        {/* Features Bento */}
        <section id="features" className="px-6 lg:px-12 py-32 bg-alphyn-surface border-y border-alphyn-surfaceBorder">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <ScrollReveal>
                <h2 className="text-4xl lg:text-5xl font-black">The Alphyn Standard</h2>
                <p className="text-alphyn-textMuted text-lg font-medium mt-4">Personalized by AI. Kept private with zero-knowledge proofs. Followable by the world.</p>
              </ScrollReveal>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <ScrollReveal delay={0} className="lg:col-span-2">
                <div className="h-full bg-background border border-alphyn-surfaceBorder p-10 rounded-[2rem] group hover:border-alphyn-orange/60 hover:-translate-y-1 transition-all duration-300 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-8">
                    <Zap className="w-7 h-7 text-blue-500" />
                  </div>
                  <h3 className="text-3xl font-bold mb-3">AI Personalization</h3>
                  <p className="text-alphyn-textMuted text-lg font-medium max-w-md">
                    An AI model synthesizes a bespoke strategy based solely on your risk profile.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={150}>
                <div className="h-full bg-background border border-alphyn-surfaceBorder p-10 rounded-[2rem] group hover:border-alphyn-orange/60 hover:-translate-y-1 transition-all duration-300 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-8">
                    <Lock className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Private by Proof</h3>
                  <p className="text-alphyn-textMuted font-medium">
                    Your allocation stays private on Midnight; every rebalance is ZK-proven. Zero strategy leakage.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={300}>
                <div className="h-full bg-background border border-alphyn-surfaceBorder p-10 rounded-[2rem] group hover:border-alphyn-orange/60 hover:-translate-y-1 transition-all duration-300 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-alphyn-orange/10 border border-alphyn-orange/20 flex items-center justify-center mb-8">
                    <Users className="w-7 h-7 text-alphyn-orange" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Followable Alpha</h3>
                  <p className="text-alphyn-textMuted font-medium">
                    Earn fees by letting others follow your track record, not your recipe.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={450} className="lg:col-span-2">
                <div className="h-full bg-background border border-alphyn-surfaceBorder p-10 rounded-[2rem] group hover:border-alphyn-orange/60 hover:-translate-y-1 transition-all duration-300 shadow-sm overflow-hidden relative">
                  <div className="relative z-10 w-full lg:w-2/3">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-8">
                      <BarChart3 className="w-7 h-7 text-purple-600" />
                    </div>
                    <h3 className="text-3xl font-bold mb-3">Real-Time Analytics</h3>
                    <p className="text-alphyn-textMuted text-lg font-medium max-w-md">
                      Monitor PnL and track follower deposits through a beautifully minimal interface.
                    </p>
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                    <BarChart3 className="w-96 h-96" />
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-6 lg:px-12 py-32 max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-4xl lg:text-5xl font-black">How Alphyn Works</h2>
            <p className="text-alphyn-textMuted text-lg max-w-2xl mx-auto font-medium">From idea to execution in four steps. The protocol handles the complexity while you maintain complete control of your funds.</p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto flex flex-col gap-8 lg:block lg:h-[1000px] mt-20">
            {[
              { step: '01', title: 'Survey', desc: 'Complete a brief assessment of your risk tolerance and goals.', icon: Layers, position: 'lg:top-0 lg:left-0', rotation: 'lg:-rotate-3' },
              { step: '02', title: 'Generate', desc: 'An AI model builds a bespoke allocation from your risk profile.', icon: Zap, position: 'lg:top-[240px] lg:right-0', rotation: 'lg:rotate-2' },
              { step: '03', title: 'Commit & Prove', desc: 'Your allocation is committed on Midnight; only a hash is public.', icon: Lock, position: 'lg:top-[480px] lg:left-12', rotation: 'lg:-rotate-2' },
              { step: '04', title: 'Rebalance & Prove', desc: 'Each epoch is ZK-proven to follow your committed strategy. Climb the public leaderboard.', icon: ArrowUpRight, position: 'lg:top-[720px] lg:right-12', rotation: 'lg:rotate-3' },
            ].map((item) => (
              <div key={item.step} className={`lg:absolute ${item.position} ${item.rotation} lg:w-[420px] bg-background border border-alphyn-surfaceBorder rounded-3xl p-6 hover:border-alphyn-orange/60 transition-all duration-500 group shadow-2xl text-left flex flex-col relative z-10 hover:rotate-0 hover:scale-[1.02] hover:z-20`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-alphyn-surface border border-alphyn-surfaceBorder rounded-xl flex items-center justify-center shadow-inner group-hover:bg-[#8B5CF6] group-hover:border-[#8B5CF6] transition-colors duration-300">
                    <item.icon className="text-alphyn-text group-hover:text-white w-6 h-6 transition-colors duration-300" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 uppercase tracking-widest">Step {item.step}</span>
                </div>
                <h3 className="font-bold text-xl mb-1">{item.title}</h3>
                <p className="text-sm text-alphyn-textMuted font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Leaderboard */}
        <section id="leaderboard" className="px-6 lg:px-12 py-32 bg-alphyn-surface border-y border-alphyn-surfaceBorder">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
              <div>
                <h2 className="text-4xl font-black mb-2">Top Performers</h2>
                <p className="text-alphyn-textMuted font-medium">The most successful private vaults on the network.</p>
              </div>
              <button onClick={launchApp} className="px-6 py-3 bg-background border border-alphyn-surfaceBorder font-bold rounded-xl hover:border-alphyn-orange/60 transition-all flex items-center gap-2 shadow-sm">
                View Full Leaderboard <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-background border border-alphyn-surfaceBorder rounded-[2rem] shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-6 border-b border-alphyn-surfaceBorder bg-alphyn-surface/50 text-[10px] font-bold uppercase tracking-widest text-alphyn-textMuted">
                <div className="col-span-2 md:col-span-1">Rank</div>
                <div className="col-span-5 md:col-span-6">Vault</div>
                <div className="col-span-2 hidden md:block text-right">Category</div>
                <div className="col-span-5 md:col-span-3 text-right">All-Time PnL</div>
              </div>
              <div className="divide-y divide-alphyn-surfaceBorder">
                {topVaults.length > 0 ? topVaults.map((v, i) => {
                  const pnlPct = Number(v.netPnlScaled) / 10000;
                  const cat = CAT[v.category] ?? 'unknown';
                  return (
                    <div key={v.id ?? i} className="grid grid-cols-12 gap-4 p-6 items-center hover:bg-alphyn-surfaceHover transition-colors cursor-pointer group" onClick={launchApp}>
                      <div className="col-span-2 md:col-span-1 text-alphyn-textMuted font-mono font-bold group-hover:text-alphyn-orange transition-colors">0{i + 1}</div>
                      <div className="col-span-5 md:col-span-6 font-bold text-lg truncate pr-4 font-mono">{String(v.id).slice(0, 12)}…</div>
                      <div className="col-span-2 hidden md:block text-right">
                        <span className={`inline-block text-[10px] font-bold px-3 py-1 rounded-lg tracking-widest uppercase border ${cat === 'aggressive' ? 'bg-alphyn-orange/10 text-alphyn-orange border-alphyn-orange/20' :
                            cat === 'balanced' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                              'bg-green-500/10 text-green-600 border-green-500/20'}`}>
                          {cat}
                        </span>
                      </div>
                      <div className="col-span-5 md:col-span-3 text-right">
                        <span className={`text-xl font-black font-mono ${pnlPct >= 0 ? 'text-green-600' : 'text-red-400'}`}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="p-12 text-center text-alphyn-textMuted font-bold">Awaiting first epochs…</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-12 py-32 max-w-4xl mx-auto text-center space-y-8 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent -z-10 blur-xl"></div>
          <h2 className="text-5xl lg:text-6xl font-black tracking-tight">Ready to secure your alpha?</h2>
          <p className="text-xl text-alphyn-textMuted max-w-2xl mx-auto font-medium">Join the next generation of DeFi where strategy creation is intelligent and execution is absolutely private.</p>
          <button
            onClick={launchApp} disabled={connecting}
            className="px-12 py-6 bg-[#8B5CF6] text-white font-black text-xl rounded-2xl active:translate-y-1 active:border-b-0 hover:bg-[#7C3AED] transition-all inline-flex items-center justify-center gap-3 border-b-4 border-[#6D28D9] shadow-2xl shadow-purple-500/30 mt-8 disabled:opacity-60"
          >
            {connecting ? 'Connecting…' : connected ? 'Launch App' : 'Connect & Launch'} <ArrowRight className="w-6 h-6" />
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-alphyn-surface border-t border-alphyn-surfaceBorder pt-20 pb-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            <div className="col-span-1 md:col-span-6 space-y-6">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <img src={asset('/logo/logo-white.png')} alt="Alphyn" className="w-10 h-10 rounded-xl border border-alphyn-surfaceBorder" />
                <span className="text-2xl font-black tracking-tighter">Alphyn</span>
              </div>
              <p className="text-alphyn-textMuted leading-relaxed max-w-sm font-medium">
                The privacy-first AI portfolio vault on Midnight. Powered by AI and zero-knowledge proofs.
              </p>
            </div>

            <div className="col-span-1 md:col-span-3 space-y-6">
              <h4 className="font-bold text-sm uppercase tracking-widest text-alphyn-textMuted">Protocol</h4>
              <ul className="space-y-4">
                <li><a href="#how-it-works" className="font-bold hover:text-alphyn-orange transition-colors">Mechanism</a></li>
                <li><a href="#leaderboard" className="font-bold hover:text-alphyn-orange transition-colors">Leaderboard</a></li>
              </ul>
            </div>

            <div className="col-span-1 md:col-span-3 space-y-6">
              <h4 className="font-bold text-sm uppercase tracking-widest text-alphyn-textMuted">Connect</h4>
              <ul className="space-y-4">
                <li><a href="https://github.com/woydarko/alphyn-mid" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold hover:text-alphyn-orange transition-colors"><Code2 className="w-4 h-4" /> GitHub</a></li>
                <li><a href="https://alphynvault.netlify.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold hover:text-alphyn-orange transition-colors"><Globe className="w-4 h-4" /> Website</a></li>
                <li><a href="https://x.com/AlphynVault" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold hover:text-alphyn-orange transition-colors"><MessageCircle className="w-4 h-4" /> X (Twitter)</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-alphyn-surfaceBorder pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-[10px] text-alphyn-textMuted font-mono uppercase tracking-widest font-bold">Hackathon 2026. Non-production demo.</p>
            <p className="text-[10px] text-alphyn-textMuted font-bold uppercase tracking-widest">© 2026 Alphyn Protocol</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
