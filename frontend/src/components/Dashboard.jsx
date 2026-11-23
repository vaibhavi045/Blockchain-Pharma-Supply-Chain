import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress, formatTimestamp, statusToString, statusToColor, roleToString, roleToColor } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { contract, role, account, userName } = useWeb3();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalDrugs: 0,
    totalUsers: 0,
    totalReports: 0,
    recalledCount: 0,
  });
  const [recentDrugs, setRecentDrugs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const drugCountBN = await contract.drugCount();
      const userCountBN = await contract.getRegisteredUserCount();
      const reportCountBN = await contract.reportCount();

      const totalD = Number(drugCountBN);
      const totalU = Number(userCountBN);
      const totalR = Number(reportCountBN);

      let recalled = 0;
      const drugsList = [];

      // Fetch latest up to 8 drugs
      for (let i = totalD; i >= 1 && drugsList.length < 8; i--) {
        try {
          const d = await contract.getDrug(i);
          if (d.isRecalled) recalled++;
          drugsList.push({
            id: Number(d.id),
            name: d.name,
            batchNumber: d.batchNumber,
            manufacturerName: d.manufacturerName,
            status: Number(d.status),
            currentHolder: d.currentHolder,
            expiryDate: d.expiryDate,
            isRecalled: d.isRecalled,
            hasTempViolation: d.hasTempViolation,
          });
        } catch (e) {
          console.error(`Failed to fetch drug ${i}:`, e);
        }
      }

      setStats({
        totalDrugs: totalD,
        totalUsers: totalU,
        totalReports: totalR,
        recalledCount: recalled,
      });
      setRecentDrugs(drugsList);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      toast.error('Failed to load blockchain dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [contract]);

  return (
    <div className="space-y-6 text-slate-800">
      {/* Welcome Banner (Clean White Card) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">💊</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                PharmaChain <span className="text-cyan-600">Overview</span>
              </h1>
            </div>
            <p className="text-slate-600 text-sm max-w-xl font-medium leading-relaxed">
              Decentralized pharmaceutical drug provenance and counterfeit detection system powered by Ethereum smart contracts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 transition"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> Refresh Ledger
            </button>
            <button
              onClick={() => navigate('/verify')}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
            >
              🔍 Verify Drug Batch
            </button>
          </div>
        </div>

        {/* User Role Card snippet */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
          <span>Connected as: <strong className="text-slate-900">{userName || 'Unregistered Guest'}</strong></span>
          <span>•</span>
          <span>Role: <span className={`px-2.5 py-0.5 rounded-full font-bold border shadow-2xs ${roleToColor(role)}`}>{roleToString(role)}</span></span>
          <span>•</span>
          <span>Wallet: <code className="text-cyan-700 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded">{formatAddress(account)}</code></span>
        </div>
      </div>

      {/* Metrics Row (Crisp White KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-cyan-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Registered Drugs</span>
            <span className="text-2xl p-2 bg-cyan-50 rounded-xl">📦</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{loading ? '…' : stats.totalDrugs}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">Recorded on Ethereum ledger</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-teal-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Authorized Stakeholders</span>
            <span className="text-2xl p-2 bg-teal-50 rounded-xl">👥</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{loading ? '…' : stats.totalUsers}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">Mfrs, Distributors, Pharmacies</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-amber-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Counterfeit Reports</span>
            <span className="text-2xl p-2 bg-amber-50 rounded-xl">⚠️</span>
          </div>
          <div className="text-3xl font-extrabold text-amber-700">{loading ? '…' : stats.totalReports}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">Flagged suspicious batches</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-rose-300 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Recalled Batches</span>
            <span className="text-2xl p-2 bg-rose-50 rounded-xl">🚨</span>
          </div>
          <div className="text-3xl font-extrabold text-rose-700">{loading ? '…' : stats.recalledCount}</div>
          <div className="text-xs text-slate-500 mt-1 font-medium">Halted from distribution</div>
        </div>
      </div>

      {/* Supply Chain Workflow Visualizer (Clean Card) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span>🔄</span> Supply-Chain State Machine Flow
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs mb-1">
              <span>🏭</span> 1. Manufacture
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">Minted on-chain with formulation &amp; future expiry date.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs mb-1">
              <span>🚛</span> 2. In Transit
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">Distributor confirms reception and records custody.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-teal-700 font-bold text-xs mb-1">
              <span>🏪</span> 3. Pharmacy
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">Pharmacy acknowledges custody; available on shelf.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-1">
              <span>👤</span> 4. Sold / Patient
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">Dispensed to patient wallet; ownership completes.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs mb-1">
              <span>🔍</span> 5. Verification
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">QR scan verifies authenticity against smart contract.</p>
          </div>
        </div>
      </div>

      {/* Recent Drugs Table (High Contrast White Table) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📋</span> Recent Drug Batches on Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Live entries queried directly from the smart contract</p>
          </div>
          {role === 2 && (
            <button
              onClick={() => navigate('/manufacturer')}
              className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs"
            >
              + Register New Drug
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-block animate-spin text-3xl mb-2">🔄</div>
            <div className="text-xs font-semibold">Querying Ethereum Blockchain...</div>
          </div>
        ) : recentDrugs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="text-3xl mb-2">📦</div>
            <div className="text-sm font-semibold text-slate-800">No drug batches registered on this contract yet.</div>
            {role === 2 && (
              <button
                onClick={() => navigate('/manufacturer')}
                className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs"
              >
                Register the First Drug
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Drug Name</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Manufacturer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Holder</th>
                  <th className="py-3 px-4">Alerts</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDrugs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-cyan-700">#{d.id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{d.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">{d.batchNumber}</td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">{d.manufacturerName}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-2xs ${statusToColor(d.status)}`}>
                        {statusToString(d.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {formatAddress(d.currentHolder)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        {d.isRecalled && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            RECALLED
                          </span>
                        )}
                        {d.hasTempViolation && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            TEMP ALERT
                          </span>
                        )}
                        {!d.isRecalled && !d.hasTempViolation && (
                          <span className="text-xs font-semibold text-emerald-700">✓ Normal</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/drug/${d.id}`)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-bold border border-slate-200 transition"
                      >
                        Audit Trail →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
