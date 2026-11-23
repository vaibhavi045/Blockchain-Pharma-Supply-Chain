import React from 'react';
import { useWeb3, TEST_ACCOUNTS } from '../context/Web3Context';
import { formatAddress } from '../utils/helpers';

export default function ConnectWallet() {
  const { connectWallet, switchToHardhatNetwork, connectAsTestAccount, connectAsGuest, hasMetaMask, loading } = useWeb3();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12 text-slate-800">
      <div className="relative z-10 max-w-3xl w-full text-center">
        {/* Brand Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-cyan-600 to-teal-500 rounded-3xl shadow-lg shadow-cyan-500/20 mb-4 text-white">
            <span className="text-4xl">💊</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Pharma<span className="text-cyan-600">Chain</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto font-medium">
            Blockchain-Based Pharmaceutical Supply-Chain Traceability &amp; Anti-Counterfeit Verification
          </p>
        </div>

        {/* Feature Highlights (White Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-left shadow-sm hover:border-cyan-300 transition">
            <div className="text-2xl mb-1.5">⛓️</div>
            <h3 className="text-sm font-bold text-slate-900 mb-0.5">Chain of Custody</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Manufacturer $\rightarrow$ Distributor $\rightarrow$ Pharmacy $\rightarrow$ Patient
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-left shadow-sm hover:border-teal-300 transition">
            <div className="text-2xl mb-1.5">✅</div>
            <h3 className="text-sm font-bold text-slate-900 mb-0.5">Anti-Counterfeit Check</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scan cryptographic QR to detect counterfeit, diverted, or recalled medicines
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-left shadow-sm hover:border-emerald-300 transition">
            <div className="text-2xl mb-1.5">❄️</div>
            <h3 className="text-sm font-bold text-slate-900 mb-0.5">IoT Cold-Chain Logs</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              On-chain excursion tracking for temperature-sensitive biologics &amp; vaccines
            </p>
          </div>
        </div>

        {/* PRIMARY CONNECTION CARD (Pure White) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-left mb-6">
          {/* Method 1: MetaMask */}
          <div className="mb-6 pb-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🦊</span>
                <h3 className="text-base font-bold text-slate-900">Option 1: Connect via MetaMask Wallet</h3>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Use your browser's MetaMask extension configured with local Hardhat network (<code>http://127.0.0.1:8545</code>).
              </p>
              {!hasMetaMask && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-xl flex items-center gap-1.5 font-medium">
                  <span>ℹ️</span> MetaMask extension not detected.
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-cyan-700 hover:text-cyan-800 font-bold ml-1"
                  >
                    Install MetaMask
                  </a>
                  {' '}or simply use Option 2 below!
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {hasMetaMask && (
                <button
                  onClick={switchToHardhatNetwork}
                  type="button"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2.5 rounded-xl font-bold border border-slate-200 transition"
                  title="Switch network in MetaMask to Hardhat Localhost (Chain ID 31337)"
                >
                  🔄 Switch to Hardhat
                </button>
              )}
              <button
                onClick={connectWallet}
                disabled={loading}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-md shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>🦊</span> Connect MetaMask
              </button>
            </div>
          </div>

          {/* Method 2: One-Click Demo Mode (NO MetaMask Needed!) */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">⚡</span>
              <h3 className="text-base font-bold text-cyan-800">Option 2: 1-Click Interactive Demo (No Extension Needed)</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 font-medium">
              Connect directly through your local running node. Perfect for evaluations, presentations, and fast testing:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(TEST_ACCOUNTS).map((acc) => (
                <button
                  key={acc.key}
                  onClick={() => connectAsTestAccount(acc.key)}
                  disabled={loading}
                  className="bg-slate-50 hover:bg-cyan-50/60 border border-slate-200 hover:border-cyan-300 p-3.5 rounded-2xl text-left transition group shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg">{acc.icon}</span>
                    <span className="text-[10px] font-mono text-cyan-700 font-bold bg-cyan-100/60 px-2 py-0.5 rounded-md border border-cyan-200">
                      {formatAddress(acc.address)}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-cyan-700 transition">
                    {acc.name}
                  </div>
                </button>
              ))}

              {/* Public Explorer / Guest button */}
              <button
                onClick={connectAsGuest}
                disabled={loading}
                className="bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 p-3.5 rounded-2xl text-left transition group shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg">🔍</span>
                  <span className="text-[10px] text-teal-700 font-bold bg-teal-100/60 px-2 py-0.5 rounded-md border border-teal-200">
                    Read-Only
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition">
                  Public Guest (Verify &amp; Explorer)
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Local Node Status Pill */}
        <div className="p-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-600 inline-flex items-center gap-2 shadow-xs font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Node RPC: <code className="text-cyan-700 font-mono font-bold">http://127.0.0.1:8545</code> (Chain ID: 31337)</span>
        </div>
      </div>
    </div>
  );
}
