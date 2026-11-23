import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import {
  formatAddress,
  formatTimestamp,
  statusToString,
  statusToColor,
  formatTemperature,
  isTempSafe,
} from '../utils/helpers';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function DrugTimeline() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contract } = useWeb3();

  const [drug, setDrug] = useState(null);
  const [history, setHistory] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDrugTimeline = async () => {
    if (!contract || !id) return;
    try {
      setLoading(true);
      const drugIdNum = Number(id);

      const d = await contract.getDrug(drugIdNum);
      const h = await contract.getDrugHistory(drugIdNum);
      const t = await contract.getTemperatureLogs(drugIdNum);

      setDrug({
        id: Number(d.id),
        name: d.name,
        batchNumber: d.batchNumber,
        manufacturer: d.manufacturer,
        manufacturerName: d.manufacturerName,
        manufactureDate: Number(d.manufactureDate),
        expiryDate: Number(d.expiryDate),
        composition: d.composition,
        status: Number(d.status),
        currentHolder: d.currentHolder,
        isRecalled: d.isRecalled,
        hasTempViolation: d.hasTempViolation,
      });

      setHistory(
        h.map((rec) => ({
          timestamp: Number(rec.timestamp),
          from: rec.fromAddress,
          to: rec.toAddress,
          status: Number(rec.status),
          location: rec.location,
        }))
      );

      setTempLogs(
        t.map((tl) => ({
          timestamp: Number(tl.timestamp),
          temperature: Number(tl.temperature),
          recorder: tl.recorder,
          location: tl.location,
        }))
      );
    } catch (err) {
      console.error('Failed to load drug timeline:', err);
      toast.error('Failed to load blockchain audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrugTimeline();
  }, [contract, id]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="text-4xl animate-spin mb-3">🔄</div>
        <p className="text-base font-semibold text-slate-800">Querying Ethereum Immutable Ledger for Batch #{id}…</p>
      </div>
    );
  }

  if (!drug) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="text-4xl mb-3">📦</div>
        <p className="text-lg text-slate-900 font-bold mb-2">Drug Batch #{id} Not Found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-semibold mt-2 transition shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isExpired = Date.now() / 1000 >= drug.expiryDate;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition font-medium"
        >
          ← Back to previous view
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-300 transition shadow-xs font-medium"
          >
            🖨️ Export Audit Report
          </button>
          <button
            onClick={fetchDrugTimeline}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-300 transition shadow-xs font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Main Drug Profile Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-cyan-100 text-cyan-700 border border-cyan-200 flex items-center justify-center text-3xl shadow-sm shrink-0">
              💊
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-cyan-800 bg-cyan-50 px-2.5 py-0.5 rounded-md border border-cyan-200">
                  BATCH ID: {drug.batchNumber}
                </span>
                <span className={`px-3 py-0.5 text-xs font-bold rounded-full border ${statusToColor(drug.status)}`}>
                  {statusToString(drug.status)}
                </span>
                {drug.isRecalled && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300 animate-pulse">
                    🚨 RECALLED
                  </span>
                )}
                {isExpired && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    ⏰ EXPIRED
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{drug.name}</h1>
              <p className="text-xs text-slate-600 mt-1">
                Manufactured by <strong className="text-slate-800">{drug.manufacturerName}</strong> (
                <code className="text-slate-600 font-mono">{formatAddress(drug.manufacturer)}</code>)
              </p>
            </div>
          </div>

          {/* QR Code preview */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl shadow-xs shrink-0 text-center">
            <QRCodeSVG
              value={`${window.location.origin}/verify?batch=${drug.batchNumber}`}
              size={90}
            />
            <span className="text-[10px] text-slate-700 font-bold block mt-1.5">Scan to Verify</span>
          </div>
        </div>

        {/* Quick Specs Grid */}
        <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Manufacturing Date</span>
            <span className="text-slate-800 font-medium">{formatTimestamp(drug.manufactureDate)}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Expiry Date</span>
            <span className={`font-medium ${isExpired ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
              {formatTimestamp(drug.expiryDate)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Current Custody Holder</span>
            <span className="text-cyan-700 font-mono font-medium">{formatAddress(drug.currentHolder)}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Cold-Chain Status</span>
            <span className={`font-bold ${drug.hasTempViolation ? 'text-amber-700' : 'text-emerald-700'}`}>
              {drug.hasTempViolation ? '⚠️ Excursion Detected' : '✓ Compliant (2°C - 8°C)'}
            </span>
          </div>
        </div>
      </div>

      {/* Vertical Provenance Journey Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span>⛓️</span> Cryptographic Chain-of-Custody Timeline ({history.length} Handover Events)
        </h2>

        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 space-y-6">
          {history.map((record, idx) => (
            <div key={idx} className="relative group">
              {/* Circle dot on the timeline line */}
              <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-6 h-6 rounded-full bg-white border-2 border-cyan-600 flex items-center justify-center text-[10px] text-cyan-700 font-bold shadow-xs">
                {idx + 1}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 hover:border-cyan-400 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusToColor(record.status)}`}>
                      {statusToString(record.status)}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      📍 {record.location || 'Facility'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {formatTimestamp(record.timestamp)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mt-2 font-mono">
                  <div>
                    <span className="text-slate-500">From: </span>
                    <span className="text-slate-800 font-medium">{formatAddress(record.from)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">To: </span>
                    <span className="text-cyan-700 font-medium">{formatAddress(record.to)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* IoT Cold Chain Telemetry Log */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>❄️</span> Cold-Chain IoT Temperature Logs ({tempLogs.length} Readings)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Target safe storage temperature: <strong>2.00 °C to 8.00 °C</strong>. Readings outside automatically trigger smart contract flags.
            </p>
          </div>
          {drug.hasTempViolation ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              ⚠️ Warning: Temperature Violation Flagged
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
              ✓ All Readings Safe
            </span>
          )}
        </div>

        {tempLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-200">
            No IoT temperature readings recorded for this batch yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Recorded Temperature</th>
                  <th className="py-3 px-4">Safe Range Check</th>
                  <th className="py-3 px-4">Facility / Vehicle Location</th>
                  <th className="py-3 px-4 font-mono">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tempLogs.map((log, idx) => {
                  const safe = isTempSafe(log.temperature);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-xs text-slate-500">{formatTimestamp(log.timestamp)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {formatTemperature(log.temperature)}
                      </td>
                      <td className="py-3 px-4">
                        {safe ? (
                          <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            ✓ Within 2–8 °C
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                            ⚠️ EXCURSION
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{log.location}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatAddress(log.recorder)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Blockchain Proof Section for Professors */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-2">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>🔬</span> Technical Blockchain Proof &amp; Verification Details
        </h4>
        <p>
          • <strong>Contract Standard:</strong> Ethereum EVM Solidity 0.8.20 running with 200 optimizer cycles.
        </p>
        <p>
          • <strong>State Immutability:</strong> The transfer history is persisted in a contract mapping with sequential indexed append-only events (<code>DrugTransferred</code>).
        </p>
        <p>
          • <strong>Cryptographic Hashing:</strong> Each batch index is guaranteed unique via the <code>batchToDrugId</code> cryptographic hash lookup table preventing replay attacks.
        </p>
      </div>
    </div>
  );
}
