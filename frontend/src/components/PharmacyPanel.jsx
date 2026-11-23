import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress, formatTimestamp, statusToString, statusToColor } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function PharmacyPanel() {
  const { contract, role, account, recordTx } = useWeb3();

  // Sell form
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selling, setSelling] = useState(false);

  // Pharmacy temperature check
  const [tempDrugId, setTempDrugId] = useState('');
  const [tempValue, setTempValue] = useState('4.0');
  const [tempLocation, setTempLocation] = useState('Pharmacy Refrigerator Unit 1');
  const [recordingTemp, setRecordingTemp] = useState(false);

  // Data
  const [incomingDrugs, setIncomingDrugs] = useState([]);
  const [inStockDrugs, setInStockDrugs] = useState([]);
  const [soldDrugs, setSoldDrugs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPharmacyData = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const totalBN = await contract.drugCount();
      const total = Number(totalBN);

      const incoming = [];
      const inStock = [];
      const sold = [];

      for (let i = 1; i <= total; i++) {
        try {
          const d = await contract.getDrug(i);
          const drugObj = {
            id: Number(d.id),
            name: d.name,
            batchNumber: d.batchNumber,
            manufacturerName: d.manufacturerName,
            status: Number(d.status),
            currentHolder: d.currentHolder,
            isRecalled: d.isRecalled,
            hasTempViolation: d.hasTempViolation,
            expiryDate: Number(d.expiryDate),
          };

          // Status 3: ShippedToPharmacy
          if (drugObj.status === 3) incoming.push(drugObj);
          // Status 4: ReceivedByPharmacy
          if (drugObj.status === 4) inStock.push(drugObj);
          // Status 5: Sold
          if (drugObj.status === 5) sold.push(drugObj);
        } catch (e) {
          console.error('Error fetching drug', i, e);
        }
      }

      setIncomingDrugs(incoming);
      setInStockDrugs(inStock);
      setSoldDrugs(sold);

      // Fetch registered customers
      const addrs = await contract.getUsersList();
      const custList = [];
      for (const a of addrs) {
        try {
          const u = await contract.getUser(a);
          if (Number(u.role) === 5) {
            custList.push({ address: a, name: u.name, location: u.location });
          }
        } catch (e) {}
      }
      setCustomers(custList);
      if (custList.length > 0 && !customerAddress) {
        setCustomerAddress(custList[0].address);
      }
    } catch (err) {
      console.error('Error loading pharmacy data:', err);
      toast.error('Failed to load pharmacy inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPharmacyData();
  }, [contract]);

  const handleReceiveShipment = async (drugId) => {
    if (!contract) return;
    try {
      toast.loading(`Acknowledging delivery of batch #${drugId}…`, { id: 'pharmrecv' });
      const tx = await contract.receiveByPharmacy(drugId);
      const receipt = await tx.wait();
      recordTx({
        title: `Pharmacy Delivery Accepted: Batch #${drugId}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Batch #${drugId} received into pharmacy inventory!`, { id: 'pharmrecv' });
      fetchPharmacyData();
    } catch (err) {
      console.error('Receipt confirmation failed:', err);
      toast.error(err?.reason || err?.message || 'Transaction failed', { id: 'pharmrecv' });
    }
  };

  const handleSellToCustomer = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!selectedDrugId || !customerAddress) {
      toast.error('Please choose a drug batch and buyer address');
      return;
    }

    try {
      setSelling(true);
      toast.loading(`Dispensing batch #${selectedDrugId} to patient…`, { id: 'sell' });
      const tx = await contract.sellToCustomer(Number(selectedDrugId), customerAddress);
      const receipt = await tx.wait();
      recordTx({
        title: `Medication Dispensed to Patient: Batch #${selectedDrugId}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Batch #${selectedDrugId} dispensed & logged on blockchain!`, { id: 'sell' });
      setSelectedDrugId('');
      fetchPharmacyData();
    } catch (err) {
      console.error('Dispensing failed:', err);
      toast.error(err?.reason || err?.message || 'Dispense transaction failed', { id: 'sell' });
    } finally {
      setSelling(false);
    }
  };

  const handleRecordTemp = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!tempDrugId || !tempValue || !tempLocation) {
      toast.error('Please specify Drug ID, temperature, and location');
      return;
    }

    const tempScaled = Math.round(parseFloat(tempValue) * 100);

    try {
      setRecordingTemp(true);
      toast.loading('Logging refrigerator telemetry on-chain…', { id: 'pharmtemp' });
      const tx = await contract.recordTemperature(Number(tempDrugId), tempScaled, tempLocation);
      const receipt = await tx.wait();
      recordTx({
        title: `Pharmacy Cold-Storage Telemetry: Batch #${tempDrugId} (${tempValue} °C)`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Logged ${tempValue} °C!`, { id: 'pharmtemp' });
      fetchPharmacyData();
    } catch (err) {
      console.error('Failed to log temperature:', err);
      toast.error(err?.reason || err?.message || 'Logging failed', { id: 'pharmtemp' });
    } finally {
      setRecordingTemp(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span>🏪</span> Licensed Retail Pharmacy Console
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Receive shipments from distributors, manage shelf inventory, check cold-chain integrity, and safely dispense genuine medications to patients.
        </p>
      </div>

      {role !== 4 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
          <span className="text-base">ℹ️</span> You are not currently connected as a Pharmacy (Role #4). Switch roles using the top right switcher to sign as a registered pharmacy.
        </div>
      )}

      {/* Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dispense Drug to Patient */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span>💊</span> Dispense / Sell Medicine to Patient
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Executes final transfer from pharmacy custody to patient. Smart contract verifies batch is non-expired and non-recalled.
          </p>

          <form onSubmit={handleSellToCustomer} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select In-Stock Medicine</label>
              <select
                value={selectedDrugId}
                onChange={(e) => setSelectedDrugId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              >
                <option value="">-- Choose Medicine from Shelf --</option>
                {inStockDrugs
                  .filter((d) => !d.isRecalled)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.id} - {d.name} ({d.batchNumber})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient / Customer Wallet</label>
              {customers.length > 0 && (
                <select
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none mb-2"
                >
                  {customers.map((c, idx) => (
                    <option key={idx} value={c.address}>
                      {c.name} ({c.location}) - {formatAddress(c.address)}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Or enter patient 0x... address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value.trim())}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={selling}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-sm disabled:opacity-50"
            >
              {selling ? 'Recording Dispense…' : 'Dispense to Patient & Complete Chain of Custody'}
            </button>
          </form>
        </div>

        {/* Pharmacy Cold Storage Telemetry */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span>❄️</span> Pharmacy Cold-Storage Monitoring
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Verify refrigerator temperatures for vaccines or heat-sensitive pharmaceuticals stored on-site.
          </p>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setTempValue('4.0');
                setTempLocation('Pharmacy Refrigerator Unit #1');
                toast.success('Preset: 4.0°C (Compliant Storage 2°C - 8°C)');
              }}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition"
            >
              ❄️ Normal (4.0°C)
            </button>
            <button
              type="button"
              onClick={() => {
                setTempValue('16.0');
                setTempLocation('Pharmacy Freezer Door Left Open');
                toast.error('Preset: 16.0°C (Storage Breach)');
              }}
              className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition"
            >
              ⚠️ Breach (16.0°C)
            </button>
          </div>

          <form onSubmit={handleRecordTemp} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Drug ID</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={tempDrugId}
                  onChange={(e) => setTempDrugId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Unit Name</label>
              <input
                type="text"
                value={tempLocation}
                onChange={(e) => setTempLocation(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={recordingTemp}
              className="w-full bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-sm disabled:opacity-50"
            >
              {recordingTemp ? 'Logging…' : 'Log Storage Temperature on Blockchain'}
            </button>
          </form>
        </div>
      </div>

      {/* Incoming Deliveries Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🚚</span> Deliveries Pending Pharmacy Acceptance ({incomingDrugs.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">Dispatched by distributors awaiting pharmacy signature</p>
          </div>
          <button
            onClick={fetchPharmacyData}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg transition font-medium"
          >
            Refresh
          </button>
        </div>

        {incomingDrugs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No incoming deliveries currently waiting for pharmacy receipt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Drug Name</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Manufacturer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incomingDrugs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-700">#{d.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{d.batchNumber}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{d.manufacturerName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusToColor(d.status)}`}>
                        {statusToString(d.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleReceiveShipment(d.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition shadow-sm"
                      >
                        ✓ Accept Delivery
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Shelf Stock */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>📦</span> Pharmacy Shelf Stock ({inStockDrugs.length})
          </h2>
          <p className="text-xs text-slate-500 mt-1">Verified genuine medications currently available for patient dispensing</p>
        </div>

        {inStockDrugs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Pharmacy shelf currently empty.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Drug Name</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cold-Chain Status</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">Audit Trail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inStockDrugs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-700">#{d.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{d.batchNumber}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusToColor(d.status)}`}>
                        {statusToString(d.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {d.hasTempViolation ? (
                        <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">⚠️ Cold Chain Breached</span>
                      ) : (
                        <span className="text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">✓ Safe Cold Chain</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {formatTimestamp(d.expiryDate)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/drug/${d.id}`}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs px-2.5 py-1.5 rounded-lg font-medium transition"
                      >
                        Inspect →
                      </a>
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
