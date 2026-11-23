import React from 'react';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function TxSuccessModal() {
  const { latestTxReceipt, setLatestTxReceipt } = useWeb3();

  if (!latestTxReceipt) return null;

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={() => setLatestTxReceipt(null)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 transition"
        >
          ✕
        </button>

        {/* Header Icon */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-3xl shadow-sm mb-3">
            ⛓️
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mb-1.5">
              EVM Transaction Confirmed &amp; Mined
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">
            {latestTxReceipt.title || 'Smart Contract State Mutated'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Cryptographically signed and permanently appended to the Ethereum ledger.
          </p>
        </div>

        {/* Cryptographic Transaction Receipt Table */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <span>🧱</span> Block Number:
            </span>
            <span className="font-mono font-bold text-cyan-800 bg-cyan-50 px-2.5 py-0.5 rounded border border-cyan-200">
              #{latestTxReceipt.blockNumber ?? 'Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <span>⛽</span> Gas Consumed:
            </span>
            <span className="font-mono text-slate-800 font-semibold">
              {latestTxReceipt.gasUsed ? `${latestTxReceipt.gasUsed} gas units` : 'N/A'}
            </span>
          </div>

          <div className="pb-2 border-b border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <span>🔗</span> Transaction Hash:
              </span>
              <button
                onClick={() => copyToClipboard(latestTxReceipt.txHash, 'Transaction Hash')}
                className="text-[10px] text-cyan-700 hover:underline font-bold"
              >
                Copy
              </button>
            </div>
            <code className="block bg-white p-2.5 rounded-xl text-[11px] font-mono text-cyan-800 break-all border border-slate-200 select-all font-semibold">
              {latestTxReceipt.txHash}
            </code>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px] font-sans">Signed By (From):</span>
              <span className="text-slate-800 font-medium">{formatAddress(latestTxReceipt.from)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] font-sans">Contract (To):</span>
              <span className="text-slate-800 font-medium">{formatAddress(latestTxReceipt.to)}</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setLatestTxReceipt(null)}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm"
          >
            Acknowledge &amp; Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
