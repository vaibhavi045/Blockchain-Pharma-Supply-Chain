import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress, formatTimestamp, statusToString, statusToColor } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function CustomerVerify() {
  const { contract, account, recordTx } = useWeb3();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('batch'); // 'batch' or 'id'
  const [loading, setLoading] = useState(false);

  // Verification results
  const [searched, setSearched] = useState(false);
  const [drugData, setDrugData] = useState(null);
  const [transferHistory, setTransferHistory] = useState([]);

  // Report counterfeit
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  // Check URL query on mount
  useEffect(() => {
    const batchParam = searchParams.get('batch');
    const idParam = searchParams.get('id');

    if (batchParam) {
      setQuery(batchParam);
      setSearchType('batch');
      if (contract) verifyDrugQuery(batchParam, 'batch');
    } else if (idParam) {
      setQuery(idParam);
      setSearchType('id');
      if (contract) verifyDrugQuery(idParam, 'id');
    }
  }, [searchParams, contract]);

  const verifyDrugQuery = async (searchVal, type) => {
    if (!contract || !searchVal) return;

    setLoading(true);
    setSearched(true);
    setDrugData(null);
    setTransferHistory([]);

    try {
      let drugIdToFetch = null;

      if (type === 'id') {
        drugIdToFetch = Number(searchVal);
      } else {
        // Query by batch number
        const res = await contract.verifyByBatch(searchVal.trim());
        if (res.exists) {
          drugIdToFetch = Number(res.drugId);
        }
      }

      if (!drugIdToFetch || drugIdToFetch === 0) {
        // Drug does not exist on blockchain -> COUNTERFEIT ALERT
        setDrugData({ notFound: true, queryVal: searchVal });
        setLoading(false);
        return;
      }

      // Call verifyDrug on contract
      const v = await contract.verifyDrug(drugIdToFetch);
      const rawDrug = await contract.getDrug(drugIdToFetch);
      const history = await contract.getDrugHistory(drugIdToFetch);

      setDrugData({
        notFound: false,
        id: drugIdToFetch,
        exists: v.exists,
        isAuthentic: v.isAuthentic,
        isRecalled: v.isRecalled,
        isExpired: v.isExpired,
        hasTempViolation: v.hasTempViolation,
        name: v.name,
        batchNumber: v.batchNumber,
        manufacturerName: v.manufacturer,
        manufacturerAddr: rawDrug.manufacturer,
        manufactureDate: Number(v.manufactureDate),
        expiryDate: Number(v.expiryDate),
        composition: rawDrug.composition,
        status: Number(v.status),
        currentHolder: rawDrug.currentHolder,
      });

      setTransferHistory(
        history.map((h) => ({
          timestamp: Number(h.timestamp),
          from: h.fromAddress,
          to: h.toAddress,
          status: Number(h.status),
          location: h.location,
        }))
      );
    } catch (err) {
      console.error('Verification error:', err);
      toast.error('Failed to verify batch on blockchain');
      setDrugData({ notFound: true, queryVal: searchVal });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Please enter a Drug ID or Batch Number');
      return;
    }
    verifyDrugQuery(query.trim(), searchType);
  };

  const handleReportCounterfeit = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!drugData || drugData.notFound || !drugData.id) {
      toast.error('Cannot file report on unindexed batch');
      return;
    }
    if (!reportReason.trim()) {
      toast.error('Please specify the reason for reporting');
      return;
    }

    try {
      setReporting(true);
      toast.loading('Logging counterfeit incident report to blockchain…', { id: 'report' });
      const tx = await contract.reportCounterfeit(drugData.id, reportReason.trim());
      const receipt = await tx.wait();
      recordTx({
        title: `Counterfeit Fraud Report: Batch #${drugData.id}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success('Counterfeit report permanently logged on ledger! Regulatory authorities notified.', { id: 'report' });
      setReportReason('');
    } catch (err) {
      console.error('Report failed:', err);
      toast.error(err?.reason || err?.message || 'Report transaction failed', { id: 'report' });
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 text-cyan-700 rounded-2xl shadow-sm mb-4 border border-cyan-200">
          <span className="text-3xl">🔍</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900">
          Pharmaceutical Authenticity &amp; Verification Portal
        </h1>
        <p className="text-slate-600 text-sm mt-2 max-w-lg mx-auto">
          Verify whether your medicine is genuine, unexpired, and safe from recalls by querying the immutable Ethereum blockchain directly.
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="sm:w-48">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              >
                <option value="batch">🏷️ Batch Number</option>
                <option value="id">🔢 Drug ID</option>
              </select>
            </div>

            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={
                  searchType === 'batch'
                    ? 'Enter batch number (e.g. BATCH-PCM-2024-001)'
                    : 'Enter numeric Drug ID (e.g. 1)'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-2xl px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="animate-spin">🔄</span> Verifying…
                </>
              ) : (
                <>
                  <span>⚡</span> Verify Authenticity
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Try quick sample:</span>
          <button
            type="button"
            onClick={() => {
              setQuery('BATCH-PCM-2024-001');
              setSearchType('batch');
              verifyDrugQuery('BATCH-PCM-2024-001', 'batch');
            }}
            className="text-cyan-700 hover:underline font-mono bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200 font-medium"
          >
            BATCH-PCM-2024-001
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('BATCH-FAKE-999');
              setSearchType('batch');
              verifyDrugQuery('BATCH-FAKE-999', 'batch');
            }}
            className="text-red-700 hover:underline font-mono bg-red-50 px-2.5 py-1 rounded-md border border-red-200 font-medium"
          >
            BATCH-FAKE-999 (Simulate Counterfeit)
          </button>
        </div>
      </div>

      {/* Results View */}
      {searched && (
        <div className="space-y-6">
          {drugData?.notFound ? (
            /* COUNTERFEIT WARNING CARD */
            <div className="bg-red-50 border-2 border-red-300 rounded-3xl p-8 shadow-sm text-center space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full border border-red-200 text-4xl mb-2">
                ❌
              </div>
              <h2 className="text-2xl font-black text-red-900">
                WARNING: SUSPECTED COUNTERFEIT OR UNREGISTERED DRUG
              </h2>
              <p className="text-slate-700 text-sm max-w-lg mx-auto">
                No record for batch identifier <code className="bg-red-100 px-2 py-1 rounded font-mono text-red-800 font-semibold">{drugData.queryVal}</code> exists in the official Ethereum supply-chain smart contract.
              </p>
              <div className="p-4 bg-white rounded-2xl border border-red-200 text-xs text-red-900 max-w-md mx-auto text-left space-y-1.5 shadow-xs">
                <div>⚠️ <strong>Do NOT consume this product.</strong></div>
                <div>• The batch was not minted by an authorized pharmaceutical manufacturer.</div>
                <div>• It could be counterfeit, contaminated, or illegally diverted.</div>
                <div>• Please report this medication to health authorities or your pharmacy immediately below.</div>
              </div>
            </div>
          ) : drugData ? (
            /* AUTHENTIC / DETAILED RESULT */
            <div className="space-y-6">
              {/* Main Authenticity Status Card */}
              <div className={`rounded-3xl p-6 sm:p-8 border shadow-sm ${
                drugData.isRecalled
                  ? 'bg-red-50 border-red-300'
                  : drugData.isExpired
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-emerald-50 border-emerald-300'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">
                      {drugData.isRecalled ? '🚨' : drugData.isExpired ? '⏰' : '✅'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full border bg-white text-slate-700 border-slate-300 shadow-xs">
                          Blockchain Verified
                        </span>
                        {drugData.hasTempViolation && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            ⚠️ Temp Compromised
                          </span>
                        )}
                      </div>
                      <h2 className={`text-2xl sm:text-3xl font-extrabold mt-1 ${
                        drugData.isRecalled
                          ? 'text-red-900'
                          : drugData.isExpired
                          ? 'text-amber-900'
                          : 'text-emerald-950'
                      }`}>
                        {drugData.isRecalled
                          ? 'RECALLED BATCH — DO NOT DISPENSE'
                          : drugData.isExpired
                          ? 'EXPIRED MEDICINE — NOT SAFE'
                          : 'AUTHENTIC & VERIFIED GENUINE'}
                      </h2>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                    >
                      🖨️ Print Certificate
                    </button>
                    <button
                      onClick={() => navigate(`/drug/${drugData.id}`)}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      Audit Trail →
                    </button>
                  </div>
                </div>
              </div>

              {/* Drug Specifications Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span>💊</span> Drug Specifications &amp; Ledger Metadata
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Commercial Name</span>
                    <strong className="text-slate-900 text-base">{drugData.name}</strong>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Batch Number</span>
                    <code className="text-cyan-700 font-mono font-bold text-base">{drugData.batchNumber}</code>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Current Supply-Chain Status</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusToColor(drugData.status)}`}>
                      {statusToString(drugData.status)}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Manufacturer</span>
                    <span className="text-slate-900 font-medium">{drugData.manufacturerName}</span>
                    <span className="text-xs text-slate-500 font-mono block mt-0.5">{formatAddress(drugData.manufacturerAddr)}</span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Manufacture Date</span>
                    <span className="text-slate-800">{formatTimestamp(drugData.manufactureDate)}</span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Expiration Date</span>
                    <span className={drugData.isExpired ? 'text-red-600 font-bold' : 'text-slate-800'}>
                      {formatTimestamp(drugData.expiryDate)}
                    </span>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <span className="text-xs text-slate-500 block mb-1">Active Formulation / Chemical Ingredients</span>
                    <p className="text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                      {drugData.composition}
                    </p>
                  </div>
                </div>
              </div>

              {/* Supply Chain Journey Timeline */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span>⛓️</span> Verified Custody Handover Log ({transferHistory.length} checkpoints)
                </h3>

                <div className="space-y-3">
                  {transferHistory.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-cyan-200">
                        {idx + 1}
                      </div>
                      <div className="flex-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold border ${statusToColor(item.status)}`}>
                            {statusToString(item.status)}
                          </span>
                          <span className="text-slate-500">{formatTimestamp(item.timestamp)}</span>
                        </div>
                        <div className="text-slate-800">
                          Facility Location: <strong>{item.location || 'On Network'}</strong>
                        </div>
                        <div className="text-slate-500 font-mono mt-0.5">
                          From: {formatAddress(item.from)} → To: {formatAddress(item.to)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Report Counterfeit Suspicion */}
              <div className="bg-white border border-amber-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-amber-900 mb-1 flex items-center gap-2">
                  <span>🛡️</span> Report Suspicious or Counterfeit Packaging
                </h3>
                <p className="text-xs text-slate-600 mb-4">
                  Witness unusual packaging, altered holograms, or adverse side effects? Submit an immutable report to regulatory authorities on-chain.
                </p>

                <form onSubmit={handleReportCounterfeit} className="space-y-3">
                  <textarea
                    rows="2"
                    placeholder="Describe suspicious physical markers, missing seals, or retail location where purchased…"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={reporting}
                    className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                  >
                    {reporting ? 'Submitting Report…' : 'Submit Tamper Report to Blockchain'}
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
