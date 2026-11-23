import React from 'react';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress, formatTimestamp } from '../utils/helpers';
import contractData from '../contractData.json';
import toast from 'react-hot-toast';

export default function BlockchainInspector({ isOpen, onClose }) {
  const { blockNumber, txHistory, fetchBlockNumber } = useWeb3();

  if (!isOpen) return null;

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 bg-cyan-50 border border-cyan-200 rounded-xl">🔬</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Blockchain Ledger &amp; EVM Inspector
              </h2>
              <p className="text-xs text-slate-500">
                Live cryptographic verification of blocks, gas consumption, and smart contract state
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchBlockNumber()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs px-3 py-1.5 rounded-lg transition font-medium"
            >
              🔄 Refresh Block
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Network & Node Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-slate-500 block mb-1">Current Block Height</span>
            <span className="text-lg font-mono font-bold text-cyan-800">
              #{blockNumber ?? '—'}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-slate-500 block mb-1">Network Chain ID</span>
            <span className="text-lg font-mono font-bold text-teal-700">
              31337 (Localhost)
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-slate-500 block mb-1">Contract Deployment</span>
            <span
              onClick={() => copyText(contractData.address, 'Contract Address')}
              className="text-xs font-mono text-cyan-700 truncate block cursor-pointer hover:underline font-semibold"
              title={contractData.address}
            >
              {formatAddress(contractData.address)} 📋
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-slate-500 block mb-1">EVM Compiler</span>
            <span className="text-xs font-mono font-semibold text-slate-800 block">
              Solidity 0.8.20 (200 runs)
            </span>
          </div>
        </div>

        {/* Transactions Feed */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📋</span> Session On-Chain Transactions ({txHistory.length})
            </h3>
            <span className="text-[11px] text-slate-500">Mined directly on the local Ethereum node</span>
          </div>

          {txHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              No transactions recorded in this browser session yet. Perform an action (registering a batch, transferring custody, or recording temperature) to see the transaction receipt appear here!
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Block</th>
                    <th className="py-2.5 px-3">Gas Used</th>
                    <th className="py-2.5 px-3">Tx Hash</th>
                    <th className="py-2.5 px-3">Signer (From)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {txHistory.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                        {tx.title}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-800 font-bold">
                        #{tx.blockNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {tx.gasUsed}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          onClick={() => copyText(tx.txHash, 'Transaction Hash')}
                          className="text-cyan-700 hover:underline cursor-pointer font-semibold"
                        >
                          {formatAddress(tx.txHash)} 📋
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {formatAddress(tx.from)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 font-sans">
                          ✓ Mined
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Target RPC: <code>http://127.0.0.1:8545</code></span>
          <button
            onClick={onClose}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
