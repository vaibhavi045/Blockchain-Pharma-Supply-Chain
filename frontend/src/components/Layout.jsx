import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useWeb3, TEST_ACCOUNTS } from '../context/Web3Context';
import ConnectWallet from './ConnectWallet';
import TxSuccessModal from './TxSuccessModal';
import BlockchainInspector from './BlockchainInspector';
import { formatAddress, roleToString, roleToColor } from '../utils/helpers';

const NAV_ITEMS = {
  1: [ // Admin
    { path: '/',       label: 'Dashboard', icon: '📊' },
    { path: '/admin',  label: 'Admin Panel', icon: '🛡️' },
    { path: '/verify', label: 'Verify Drug', icon: '🔍' },
  ],
  2: [ // Manufacturer
    { path: '/',             label: 'Dashboard', icon: '📊' },
    { path: '/manufacturer', label: 'Manufacturer', icon: '🏭' },
    { path: '/verify',       label: 'Verify Drug', icon: '🔍' },
  ],
  3: [ // Distributor
    { path: '/',            label: 'Dashboard', icon: '📊' },
    { path: '/distributor', label: 'Distributor', icon: '🚛' },
    { path: '/verify',      label: 'Verify Drug', icon: '🔍' },
  ],
  4: [ // Pharmacy
    { path: '/',         label: 'Dashboard', icon: '📊' },
    { path: '/pharmacy', label: 'Pharmacy', icon: '🏪' },
    { path: '/verify',   label: 'Verify Drug', icon: '🔍' },
  ],
  0: [ // None / unregistered / guest
    { path: '/',       label: 'Dashboard', icon: '📊' },
    { path: '/verify', label: 'Verify Drug', icon: '🔍' },
  ],
  5: [ // Customer
    { path: '/',       label: 'Dashboard', icon: '📊' },
    { path: '/verify', label: 'Verify Drug', icon: '🔍' },
  ],
};

export default function Layout() {
  const { isConnected, account, role, userName, isSimulated, blockNumber, connectAsTestAccount, disconnect } = useWeb3();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const navigate = useNavigate();

  if (!isConnected) {
    return <ConnectWallet />;
  }

  const navItems = NAV_ITEMS[role] || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + hamburger */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => navigate('/')}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                  <span className="text-xl">💊</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">
                    Pharma<span className="text-cyan-600">Chain</span>
                  </h1>
                  <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block">
                    Enterprise Provenance Ledger
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Wallet info + Role Switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Blockchain Inspector Button */}
              <button
                onClick={() => setInspectorOpen(true)}
                className="hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition font-mono"
                title="Open Real-time Blockchain & EVM Ledger Inspector"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>EVM Block #{blockNumber ?? '—'}</span>
              </button>

              {/* Quick Role Switcher (handy for demo & presentation) */}
              <div className="relative">
                <button
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center gap-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <span>⚡ Switch Role</span>
                  <span className="text-[10px]">▼</span>
                </button>

                {roleMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-600 tracking-wider border-b border-slate-100">
                      Switch Role (Simulation)
                    </div>
                    {Object.values(TEST_ACCOUNTS).map((acc) => (
                      <button
                        key={acc.key}
                        onClick={() => {
                          connectAsTestAccount(acc.key);
                          setRoleMenuOpen(false);
                          if (acc.role === 1) navigate('/admin');
                          else if (acc.role === 2) navigate('/manufacturer');
                          else if (acc.role === 3) navigate('/distributor');
                          else if (acc.role === 4) navigate('/pharmacy');
                          else navigate('/');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 transition ${
                          role === acc.role ? 'text-cyan-700 font-bold bg-cyan-50/70' : 'text-slate-700'
                        }`}
                      >
                        <span className="text-base">{acc.icon}</span>
                        <div className="flex-1 truncate">
                          <div className="font-semibold">{acc.name}</div>
                          <div className="text-[10px] text-slate-600 font-mono">{formatAddress(acc.address)}</div>
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          disconnect();
                          setRoleMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 font-medium"
                      >
                        <span>🚪</span> Disconnect Wallet
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {userName && (
                <span className="hidden lg:inline text-xs text-slate-600 font-medium">
                  {userName}
                </span>
              )}

              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-sm ${roleToColor(role)}`}>
                {roleToString(role)}
              </span>

              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-semibold text-slate-700">
                  {formatAddress(account)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 fixed md:static inset-y-0 left-0 z-40
          w-64 bg-white border-r border-slate-200
          transition-transform duration-300 ease-in-out pt-16 md:pt-0 shadow-sm
        `}>
          <div className="flex flex-col h-full p-4">
            <div className="flex-1 space-y-1.5 mt-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Sidebar footer */}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
              {isSimulated && (
                <div className="px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-200 text-[11px] text-cyan-800 text-center font-semibold">
                  ⚡ <strong>Interactive Demo Node</strong>
                </div>
              )}
              <div className="px-4 py-1 text-xs text-slate-600 text-center font-medium">
                ⛓️ Ethereum Blockchain<br />Solidity 0.8.20 Smart Contract
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p className="font-medium text-slate-600">
          💊 PharmaChain — Pharmaceutical Drug Supply-Chain Traceability &amp; Anti-Counterfeit System
        </p>
        <p className="mt-0.5 text-slate-600">Powered by Ethereum Blockchain | Built with React, Vite &amp; Solidity</p>
      </footer>

      {/* Real-time Blockchain Proof Modals */}
      <TxSuccessModal />
      <BlockchainInspector isOpen={inspectorOpen} onClose={() => setInspectorOpen(false)} />
    </div>
  );
}
