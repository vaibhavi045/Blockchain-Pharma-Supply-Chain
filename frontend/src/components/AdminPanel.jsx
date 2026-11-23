import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress, formatTimestamp, roleToString, roleToColor } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function AdminPanel() {
  const { contract, role, account, recordTx } = useWeb3();

  // Registration state
  const [userAddress, setUserAddress] = useState('');
  const [userName, setUserName] = useState('');
  const [userLocation, setUserLocation] = useState('');
  const [userRole, setUserRole] = useState(2); // default Manufacturer
  const [registering, setRegistering] = useState(false);

  // Recall state
  const [recallDrugId, setRecallDrugId] = useState('');
  const [recallReason, setRecallReason] = useState('');
  const [recalling, setRecalling] = useState(false);

  // Data lists
  const [usersList, setUsersList] = useState([]);
  const [reportsList, setReportsList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    if (!contract) return;
    try {
      setLoading(true);

      // Fetch users
      const addrs = await contract.getUsersList();
      const usersData = [];
      for (const addr of addrs) {
        try {
          const u = await contract.getUser(addr);
          usersData.push({
            address: addr,
            name: u.name,
            location: u.location,
            role: Number(u.role),
            isRegistered: u.isRegistered,
          });
        } catch (e) {
          console.error('Error fetching user', addr, e);
        }
      }
      setUsersList(usersData);

      // Fetch counterfeit reports
      const rCountBN = await contract.reportCount();
      const rCount = Number(rCountBN);
      const reportsData = [];
      for (let i = 1; i <= rCount; i++) {
        try {
          const r = await contract.reports(i);
          reportsData.push({
            id: Number(r.id),
            drugId: Number(r.drugId),
            reporter: r.reporter,
            reason: r.reason,
            timestamp: Number(r.timestamp),
            resolved: r.resolved,
          });
        } catch (e) {
          console.error('Error fetching report', i, e);
        }
      }
      setReportsList(reportsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      toast.error('Failed to fetch admin data from blockchain');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [contract]);

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!userAddress || !userName || !userLocation) {
      toast.error('Please fill in all participant details');
      return;
    }

    try {
      setRegistering(true);
      toast.loading('Mining registration transaction…', { id: 'reg' });
      const tx = await contract.registerUser(userAddress, userName, userLocation, Number(userRole));
      const receipt = await tx.wait();
      recordTx({
        title: `Authorized Stakeholder: ${userName}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Successfully registered ${userName} on blockchain!`, { id: 'reg' });
      setUserAddress('');
      setUserName('');
      setUserLocation('');
      fetchAdminData();
    } catch (err) {
      console.error('Registration failed:', err);
      toast.error(err?.reason || err?.message || 'Transaction failed', { id: 'reg' });
    } finally {
      setRegistering(false);
    }
  };

  const handleRecallDrug = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!recallDrugId || !recallReason) {
      toast.error('Please specify Drug ID and recall reason');
      return;
    }

    try {
      setRecalling(true);
      toast.loading('Submitting on-chain recall order…', { id: 'rcl' });
      const tx = await contract.recallDrug(Number(recallDrugId), recallReason);
      const receipt = await tx.wait();
      recordTx({
        title: `Emergency Global Recall: Batch #${recallDrugId}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Batch #${recallDrugId} officially recalled from supply chain!`, { id: 'rcl' });
      setRecallDrugId('');
      setRecallReason('');
    } catch (err) {
      console.error('Recall failed:', err);
      toast.error(err?.reason || err?.message || 'Recall transaction failed', { id: 'rcl' });
    } finally {
      setRecalling(false);
    }
  };

  const handleResolveReport = async (reportId) => {
    if (!contract) return;
    try {
      toast.loading('Resolving counterfeit incident…', { id: 'res' });
      const tx = await contract.resolveReport(reportId);
      const receipt = await tx.wait();
      recordTx({
        title: `Counterfeit Incident Resolved: Report #${reportId}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Report #${reportId} marked as resolved!`, { id: 'res' });
      fetchAdminData();
    } catch (err) {
      console.error('Failed to resolve report:', err);
      toast.error(err?.reason || 'Resolution failed', { id: 'res' });
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>🛡️</span> Supply-Chain Administrator Console
          </h1>
          <p className="text-slate-600 text-sm mt-0.5 font-medium">
            Manage authorized participants, execute emergency batch recalls, and review flagged counterfeits.
          </p>
        </div>
        {role !== 1 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-2xs">
            <span>⚠️</span> You are not currently connected as Admin (Role #1). Switch to Admin to register users or recall.
          </div>
        )}
      </div>

      {/* Grid: Register User + Emergency Recall (White Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Register Participant Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span>➕</span> Authorize New Participant
          </h2>
          <p className="text-xs text-slate-500 mb-4 font-medium">
            Registers an Ethereum address with an authorized role in the contract registry.
          </p>

          <form onSubmit={handleRegisterUser} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ethereum Wallet Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value.trim())}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Organization / Person Name</label>
              <input
                type="text"
                placeholder="e.g. Novartis Pharma Lab"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Facility Location</label>
                <input
                  type="text"
                  placeholder="e.g. Hyderabad, India"
                  value={userLocation}
                  onChange={(e) => setUserLocation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supply Chain Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                >
                  <option value={2}>🏭 Manufacturer</option>
                  <option value={3}>🚛 Distributor</option>
                  <option value={4}>🏪 Pharmacy</option>
                  <option value={5}>👤 Customer</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={registering}
              className="w-full mt-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm disabled:opacity-50"
            >
              {registering ? 'Mining on Blockchain…' : 'Register Participant on Ledger'}
            </button>
          </form>
        </div>

        {/* Emergency Recall Form */}
        <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-rose-700 mb-1 flex items-center gap-2">
              <span>🚨</span> Emergency Drug Recall Order
            </h2>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Immutably flags a drug batch as RECALLED on-chain. This immediately halts all transfers and pharmacy sales globally.
            </p>

            <form onSubmit={handleRecallDrug} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Drug ID to Recall</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={recallDrugId}
                  onChange={(e) => setRecallDrugId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Reason for Recall</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Failed lab quality assay; chemical impurities detected in batch samples"
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={recalling}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm disabled:opacity-50"
              >
                {recalling ? 'Broadcasting Recall…' : 'Broadcast Global Recall Order'}
              </button>
            </form>
          </div>

          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 flex items-center gap-2 font-medium">
            <span>ℹ️</span> Smart contract modifier <code>notRecalled</code> prevents any party from selling or transferring this batch once marked.
          </div>
        </div>
      </div>

      {/* Registered Participants Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>👥</span> Authorized Participants Directory ({usersList.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Verified stakeholders with permissioned keys in contract</p>
          </div>
          <button
            onClick={fetchAdminData}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold transition"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Organization / Name</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Ethereum Address</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersList.map((u, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shadow-2xs ${roleToColor(u.role)}`}>
                      {roleToString(u.role)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-600">{u.location}</td>
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-cyan-700">{u.address}</td>
                  <td className="py-3 px-4 text-xs font-semibold text-emerald-700">✓ Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Counterfeit Reports Section */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>🛡️</span> Flagged Counterfeit Incident Reports ({reportsList.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Consumer and stakeholder submitted fraud alerts logged on ledger</p>
        </div>

        {reportsList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-medium">
            No counterfeit reports on record. All batches healthy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Report ID</th>
                  <th className="py-3 px-4">Drug ID</th>
                  <th className="py-3 px-4">Reported By</th>
                  <th className="py-3 px-4">Report Reason</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportsList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">#{r.id}</td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-700">#{r.drugId}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatAddress(r.reporter)}</td>
                    <td className="py-3 px-4 text-xs text-slate-800 font-medium">{r.reason}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatTimestamp(r.timestamp)}</td>
                    <td className="py-3 px-4">
                      {r.resolved ? (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Resolved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleResolveReport(r.id)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded-lg font-bold transition shadow-2xs"
                        >
                          Mark Resolved
                        </button>
                      )}
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
