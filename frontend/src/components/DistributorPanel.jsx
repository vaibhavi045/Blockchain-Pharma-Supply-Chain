import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress, formatTimestamp, statusToString, statusToColor } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function DistributorPanel() {
  const { contract, role, account, recordTx, connectAsTestAccount } = useWeb3();

  // Ship to pharmacy form
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [shipping, setShipping] = useState(false);

  // Temperature form
  const [tempDrugId, setTempDrugId] = useState('');
  const [tempValue, setTempValue] = useState('5.0');
  const [tempLocation, setTempLocation] = useState('Distributor Transit Vehicle #09');
  const [recordingTemp, setRecordingTemp] = useState(false);

  // Data lists
  const [incomingDrugs, setIncomingDrugs] = useState([]);
  const [inStockDrugs, setInStockDrugs] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDistributorData = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const totalBN = await contract.drugCount();
      const total = Number(totalBN);

      const incoming = [];
      const inStock = [];

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

          // Status 1: ShippedToDistributor
          if (drugObj.status === 1) {
            incoming.push(drugObj);
          }
          // Status 2: ReceivedByDistributor
          if (drugObj.status === 2) {
            inStock.push(drugObj);
          }
        } catch (e) {
          console.error('Error fetching drug', i, e);
        }
      }

      setIncomingDrugs(incoming);
      setInStockDrugs(inStock);

      // Fetch registered pharmacies
      const addrs = await contract.getUsersList();
      const pharmList = [];
      for (const a of addrs) {
        try {
          const u = await contract.getUser(a);
          if (Number(u.role) === 4) {
            pharmList.push({ address: a, name: u.name, location: u.location });
          }
        } catch (e) {}
      }
      setPharmacies(pharmList);
      if (pharmList.length > 0 && !pharmacyAddress) {
        setPharmacyAddress(pharmList[0].address);
      }
    } catch (err) {
      console.error('Error loading distributor data:', err);
      toast.error('Failed to load distributor batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributorData();
  }, [contract]);

  const handleReceiveShipment = async (drugId) => {
    if (!contract) return;
    if (role !== 3) {
      toast.error('Only a registered distributor wallet can sign receipt! Please click "Switch to Distributor Wallet" above.', { duration: 5000 });
      return;
    }
    try {
      toast.loading(`Confirming receipt of batch #${drugId} on blockchain…`, { id: 'recv' });
      const tx = await contract.receiveByDistributor(drugId);
      const receipt = await tx.wait();
      recordTx({
        title: `Custody Acknowledged: Batch #${drugId}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Custody of batch #${drugId} successfully verified & received!`, { id: 'recv' });
      fetchDistributorData();
    } catch (err) {
      console.error('Receipt confirmation failed:', err);
      toast.error(err?.reason || err?.message || 'Transaction reverted', { id: 'recv' });
    }
  };

  const handleShipToPharmacy = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!selectedDrugId || !pharmacyAddress) {
      toast.error('Please select batch and destination pharmacy');
      return;
    }

    try {
      setShipping(true);
      toast.loading(`Shipping batch #${selectedDrugId} to pharmacy…`, { id: 'shippharm' });
      const tx = await contract.shipToPharmacy(Number(selectedDrugId), pharmacyAddress);
      const receipt = await tx.wait();
      recordTx({
        title: `Dispatched to Pharmacy: Batch #${selectedDrugId}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Batch #${selectedDrugId} status updated to ShippedToPharmacy!`, { id: 'shippharm' });
      setSelectedDrugId('');
      fetchDistributorData();
    } catch (err) {
      console.error('Shipment to pharmacy failed:', err);
      toast.error(err?.reason || err?.message || 'Transaction failed', { id: 'shippharm' });
    } finally {
      setShipping(false);
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
      toast.loading('Logging transit cold-chain reading…', { id: 'disttemp' });
      const tx = await contract.recordTemperature(Number(tempDrugId), tempScaled, tempLocation);
      const receipt = await tx.wait();
      recordTx({
        title: `In-Transit Temperature: Batch #${tempDrugId} (${tempValue} °C)`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Logged ${tempValue} °C on-chain!`, { id: 'disttemp' });
      fetchDistributorData();
    } catch (err) {
      console.error('Failed to log temperature:', err);
      toast.error(err?.reason || err?.message || 'Logging failed', { id: 'disttemp' });
    } finally {
      setRecordingTemp(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span>🚛</span> Wholesale Logistics &amp; Distributor Console
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Acknowledge reception of manufacturer batches, record cold-chain telemetry during transit, and route shipments to licensed retail pharmacies.
        </p>
      </div>

      {role !== 3 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <strong>Active Wallet is not a Distributor (Role #3).</strong>
              <div className="text-amber-800 text-[11px] mt-0.5">
                On Ethereum, transactions must be signed by the registered distributor's private key.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => connectAsTestAccount('distributor')}
            className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm whitespace-nowrap"
          >
            ⚡ Switch to Distributor Wallet
          </button>
        </div>
      )}

      {/* Action Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Forward to Pharmacy */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span>🏪</span> Forward Stock to Licensed Pharmacy
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Dispatches verified batches stored in distributor warehouse to retail pharmacy custody.
          </p>

          <form onSubmit={handleShipToPharmacy} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Received Batch</label>
              <select
                value={selectedDrugId}
                onChange={(e) => setSelectedDrugId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              >
                <option value="">-- Choose In-Stock Batch --</option>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Pharmacy</label>
              {pharmacies.length > 0 && (
                <select
                  value={pharmacyAddress}
                  onChange={(e) => setPharmacyAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none mb-2"
                >
                  {pharmacies.map((pharm, idx) => (
                    <option key={idx} value={pharm.address}>
                      {pharm.name} ({pharm.location}) - {formatAddress(pharm.address)}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Or enter 0x... pharmacy address"
                value={pharmacyAddress}
                onChange={(e) => setPharmacyAddress(e.target.value.trim())}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={shipping}
              className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-sm disabled:opacity-50"
            >
              {shipping ? 'Executing Transfer…' : 'Dispatch Shipment to Pharmacy'}
            </button>
          </form>
        </div>

        {/* Cold-Chain Transit Telemetry */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span>🌡️</span> Log In-Transit Cold-Chain Telemetry
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Record automated IoT temperature telemetry while cargo is in refrigerated transport or warehouse.
          </p>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setTempValue('5.0');
                setTempLocation('Refrigerated Transit Vehicle #09');
                toast.success('Preset: 5.0°C (Compliant Transit 2°C - 8°C)');
              }}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition"
            >
              ❄️ Normal (5.0°C)
            </button>
            <button
              type="button"
              onClick={() => {
                setTempValue('13.5');
                setTempLocation('Reefer Unit Power Failure');
                toast.error('Preset: 13.5°C (Excursion Alert)');
              }}
              className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition"
            >
              ⚠️ Excursion (13.5°C)
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temperature (°C)</label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transit Route / Location</label>
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
              {recordingTemp ? 'Logging…' : 'Record Telemetry on Blockchain'}
            </button>
          </form>
        </div>
      </div>

      {/* Incoming Shipments Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📥</span> Incoming Shipments Pending Distributor Receipt ({incomingDrugs.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">Batches dispatched by manufacturers awaiting confirmation</p>
          </div>
          <button
            onClick={fetchDistributorData}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg transition font-medium"
          >
            Refresh
          </button>
        </div>

        {incomingDrugs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No incoming shipments currently awaiting distributor confirmation.
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
                        className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition shadow-sm"
                      >
                        ✓ Confirm Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* In-Stock Batches Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>📦</span> Warehoused Batches Ready for Pharmacy Dispatch ({inStockDrugs.length})
          </h2>
          <p className="text-xs text-slate-500 mt-1">Batches physically received and available for pharmacy transfer</p>
        </div>

        {inStockDrugs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No batches currently in warehouse inventory.
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
                  <th className="py-3 px-4">Alerts</th>
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
                        <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">⚠️ Temp Alert</span>
                      ) : (
                        <span className="text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">✓ Safe Cold Chain</span>
                      )}
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
