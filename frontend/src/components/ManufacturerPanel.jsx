import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress, formatTimestamp, statusToString, statusToColor } from '../utils/helpers';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function ManufacturerPanel() {
  const { contract, role, account, recordTx, connectAsTestAccount } = useWeb3();

  // Registration form
  const [drugName, setDrugName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [composition, setComposition] = useState('');
  const [registering, setRegistering] = useState(false);

  // Transfer form
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [distributorAddress, setDistributorAddress] = useState('');
  const [shipping, setShipping] = useState(false);

  // Cold Chain temperature form
  const [tempDrugId, setTempDrugId] = useState('');
  const [tempValue, setTempValue] = useState('4.5'); // default 4.5 °C
  const [tempLocation, setTempLocation] = useState('Factory Cold Room A');
  const [recordingTemp, setRecordingTemp] = useState(false);

  // QR Modal
  const [activeQR, setActiveQR] = useState(null);

  // Data lists
  const [myDrugs, setMyDrugs] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);

  const autofillPreset = (type) => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const dateStr = futureDate.toISOString().split('T')[0];

    if (type === 'amx') {
      setDrugName('Amoxicillin 500mg Capsules');
      setBatchNumber(`BATCH-AMX-${randomSuffix}`);
      setExpiryDate(dateStr);
      setComposition('Each capsule contains: Amoxicillin Trihydrate IP eq. to Amoxicillin 500mg, Excipients q.s.');
    } else if (type === 'ins') {
      setDrugName('Human Insulin 100 IU/ml (Cold-Chain)');
      setBatchNumber(`BATCH-INS-${randomSuffix}`);
      setExpiryDate(dateStr);
      setComposition('Recombinant Human Insulin 100 IU/ml, m-Cresol 2.5mg, Glycerol 16mg, Water for injection q.s.');
    } else {
      setDrugName('Azithromycin 500mg Tablets');
      setBatchNumber(`BATCH-AZM-${randomSuffix}`);
      setExpiryDate(dateStr);
      setComposition('Each film coated tablet contains: Azithromycin Dihydrate IP eq. to Anhydrous Azithromycin 500mg');
    }
    toast.success('Form autofilled with realistic pharmaceutical data!');
  };

  const fetchManufacturerData = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const totalDrugsBN = await contract.drugCount();
      const total = Number(totalDrugsBN);
      const drugs = [];

      for (let i = 1; i <= total; i++) {
        try {
          const d = await contract.getDrug(i);
          drugs.push({
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
        } catch (e) {
          console.error('Error fetching drug', i, e);
        }
      }
      setMyDrugs(drugs);

      // Fetch registered distributors for easy dropdown selection
      const addrs = await contract.getUsersList();
      const distList = [];
      for (const a of addrs) {
        try {
          const u = await contract.getUser(a);
          if (Number(u.role) === 3) {
            distList.push({ address: a, name: u.name, location: u.location });
          }
        } catch (e) {}
      }
      setDistributors(distList);
      if (distList.length > 0 && !distributorAddress) {
        setDistributorAddress(distList[0].address);
      }
    } catch (err) {
      console.error('Error loading manufacturer data:', err);
      toast.error('Failed to load manufacturer records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManufacturerData();
  }, [contract]);

  const handleRegisterDrug = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!drugName || !batchNumber || !expiryDate || !composition) {
      toast.error('Please fill in all drug batch details');
      return;
    }

    const expiryTimestamp = Math.floor(new Date(expiryDate).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (expiryTimestamp <= now) {
      toast.error('Expiry date must be in the future');
      return;
    }

    try {
      setRegistering(true);
      toast.loading('Mining drug batch registration on Ethereum…', { id: 'mfr' });
      const tx = await contract.registerDrug(drugName, batchNumber, expiryTimestamp, composition);
      const receipt = await tx.wait();
      recordTx({
        title: `Drug Batch Minted: ${drugName}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Batch ${batchNumber} (${drugName}) registered on-chain!`, { id: 'mfr' });
      setDrugName('');
      setBatchNumber('');
      setComposition('');
      setExpiryDate('');
      fetchManufacturerData();
    } catch (err) {
      console.error('Drug registration failed:', err);
      toast.error(err?.reason || err?.message || 'Transaction reverted', { id: 'mfr' });
    } finally {
      setRegistering(false);
    }
  };

  const handleShipToDistributor = async (e) => {
    e.preventDefault();
    if (!contract) return;
    if (!selectedDrugId || !distributorAddress) {
      toast.error('Please select a drug and distributor address');
      return;
    }

    try {
      setShipping(true);
      toast.loading(`Dispatching batch #${selectedDrugId} to distributor…`, { id: 'ship' });
      const tx = await contract.shipToDistributor(Number(selectedDrugId), distributorAddress);
      const receipt = await tx.wait();
      recordTx({
        title: `Dispatched to Distributor: Batch #${selectedDrugId}`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Batch #${selectedDrugId} status updated to ShippedToDistributor!`, { id: 'ship' });
      setSelectedDrugId('');
      fetchManufacturerData();
    } catch (err) {
      console.error('Shipping failed:', err);
      toast.error(err?.reason || err?.message || 'Shipment transaction failed', { id: 'ship' });
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
      toast.loading('Logging IoT cold-chain telemetry on-chain…', { id: 'temp' });
      const tx = await contract.recordTemperature(Number(tempDrugId), tempScaled, tempLocation);
      const receipt = await tx.wait();
      recordTx({
        title: `IoT Cold-Chain Telemetry: Batch #${tempDrugId} (${tempValue} °C)`,
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        from: receipt.from,
        to: receipt.to,
      });
      toast.success(`Logged ${tempValue} °C for batch #${tempDrugId}!`, { id: 'temp' });
      fetchManufacturerData();
    } catch (err) {
      console.error('Failed to log temperature:', err);
      toast.error(err?.reason || err?.message || 'Logging failed', { id: 'temp' });
    } finally {
      setRecordingTemp(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span>🏭</span> Pharmaceutical Manufacturer Console
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Mint new drug batches onto the blockchain ledger, generate cryptographic QR verification codes, and initiate supply-chain handovers.
        </p>
      </div>

      {role !== 2 && (
        <div className="bg-blue-50 border border-blue-300 text-blue-950 text-xs px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <strong>Active Wallet is not a Registered Manufacturer (Role #2).</strong>
              <div className="text-blue-800 text-[11px] mt-0.5">
                On Ethereum, minting drug batches and initial dispatch must be signed by the manufacturer's private key.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => connectAsTestAccount('manufacturer')}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm whitespace-nowrap"
          >
            ⚡ Switch to Manufacturer Wallet
          </button>
        </div>
      )}

      {/* Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Register Drug */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span>💊</span> Mint New Drug Batch
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Creates an immutable record on Ethereum with batch metadata, active ingredients, and expiration timestamp.
          </p>

          {/* Quick Demo Autofill Presets */}
          <div className="mb-5 p-3 rounded-2xl bg-cyan-50/80 border border-cyan-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-cyan-900 font-semibold flex items-center gap-1">
              <span>⚡</span> Demo Autofill:
            </span>
            <button
              type="button"
              onClick={() => autofillPreset('amx')}
              className="bg-white hover:bg-cyan-100 text-cyan-800 px-3 py-1 rounded-lg border border-cyan-300 font-medium transition shadow-xs"
            >
              💊 Amoxicillin 500mg
            </button>
            <button
              type="button"
              onClick={() => autofillPreset('ins')}
              className="bg-white hover:bg-cyan-100 text-cyan-800 px-3 py-1 rounded-lg border border-cyan-300 font-medium transition shadow-xs"
            >
              ❄️ Human Insulin (Cold-Chain)
            </button>
            <button
              type="button"
              onClick={() => autofillPreset('azm')}
              className="bg-white hover:bg-cyan-100 text-cyan-800 px-3 py-1 rounded-lg border border-cyan-300 font-medium transition shadow-xs"
            >
              💊 Azithromycin 500mg
            </button>
          </div>

          <form onSubmit={handleRegisterDrug} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Commercial Drug Name</label>
                <input
                  type="text"
                  placeholder="e.g. Amoxicillin 500mg Capsules"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unique Batch Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-AMX-2024-042"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value.trim())}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pharmaceutical Formulation / Composition</label>
              <textarea
                rows="2"
                placeholder="e.g. Each capsule contains: Amoxicillin Trihydrate IP equivalent to Amoxicillin 500mg, Excipients q.s."
                value={composition}
                onChange={(e) => setComposition(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={registering}
              className="w-full bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-sm disabled:opacity-50"
            >
              {registering ? 'Mining on Blockchain…' : 'Register Batch on Ethereum Ledger'}
            </button>
          </form>
        </div>

        {/* Transfer to Distributor + Cold Chain */}
        <div className="space-y-6">
          {/* Dispatch */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <span>🚛</span> Ship to Distributor
            </h2>
            <p className="text-xs text-slate-500 mb-3">Initiate custody handover to a licensed logistics hub.</p>
            <form onSubmit={handleShipToDistributor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Batch</label>
                <select
                  value={selectedDrugId}
                  onChange={(e) => setSelectedDrugId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                >
                  <option value="">-- Choose Batch --</option>
                  {myDrugs
                    .filter((d) => d.status === 0 && !d.isRecalled)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.id} - {d.name} ({d.batchNumber})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Distributor Address</label>
                {distributors.length > 0 ? (
                  <select
                    value={distributorAddress}
                    onChange={(e) => setDistributorAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none mb-2"
                  >
                    {distributors.map((dist, idx) => (
                      <option key={idx} value={dist.address}>
                        {dist.name} ({dist.location}) - {formatAddress(dist.address)}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  type="text"
                  placeholder="Or enter custom 0x... address"
                  value={distributorAddress}
                  onChange={(e) => setDistributorAddress(e.target.value.trim())}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={shipping}
                className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition shadow-sm disabled:opacity-50"
              >
                {shipping ? 'Transferring…' : 'Dispatch Shipment to Distributor'}
              </button>
            </form>
          </div>

          {/* IoT Temperature Simulation */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <span>🌡️</span> IoT Cold-Chain Logger
            </h2>
            <p className="text-xs text-slate-500 mb-3">Simulate smart warehouse sensor telemetry.</p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setTempValue('4.5');
                  setTempLocation('Factory Cold Storage Unit A');
                  toast.success('Preset: 4.5°C (Safe Range: 2°C - 8°C)');
                }}
                className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition"
              >
                ❄️ Safe (4.5°C)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempValue('14.0');
                  setTempLocation('Refrigeration Failure Alarm');
                  toast.error('Preset: 14.0°C (Violation Alert)');
                }}
                className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition"
              >
                ⚠️ Alert (14.0°C)
              </button>
            </div>

            <form onSubmit={handleRecordTemp} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Drug ID</label>
                  <input
                    type="number"
                    placeholder="e.g. 1"
                    value={tempDrugId}
                    onChange={(e) => setTempDrugId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="4.5"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Facility / Telemetry Location</label>
                <input
                  type="text"
                  placeholder="e.g. Warehouse Cold Unit 2"
                  value={tempLocation}
                  onChange={(e) => setTempLocation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={recordingTemp}
                className="w-full bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition disabled:opacity-50"
              >
                {recordingTemp ? 'Recording…' : 'Log Temperature on Blockchain'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Manufactured Drugs Inventory */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📋</span> Manufactured Batches Inventory ({myDrugs.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">View batch lifecycle, dispatch to logistics, or generate verification QR</p>
          </div>
          <button
            onClick={fetchManufacturerData}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg transition font-medium"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Current Custody</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4 text-right">QR / Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myDrugs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono font-bold text-cyan-700">#{d.id}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{d.batchNumber}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusToColor(d.status)}`}>
                      {statusToString(d.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">
                    {formatAddress(d.currentHolder)}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {formatTimestamp(d.expiryDate)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setActiveQR(d)}
                        className="bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs px-2.5 py-1.5 rounded-lg border border-cyan-300 font-semibold transition"
                      >
                        📱 QR Code
                      </button>
                      <a
                        href={`/drug/${d.id}`}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs px-2.5 py-1.5 rounded-lg font-medium transition"
                      >
                        Audit
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      {activeQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
            <button
              onClick={() => setActiveQR(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg font-bold"
            >
              ✕
            </button>
            <div className="text-3xl mb-2">💊</div>
            <h3 className="text-lg font-bold text-slate-900">{activeQR.name}</h3>
            <p className="text-xs font-mono text-cyan-700 font-semibold mb-4">{activeQR.batchNumber}</p>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl inline-block shadow-inner mb-4">
              <QRCodeSVG
                value={JSON.stringify({
                  id: activeQR.id,
                  batch: activeQR.batchNumber,
                  name: activeQR.name,
                  mfr: activeQR.manufacturer,
                  verifyUrl: `${window.location.origin}/verify?batch=${activeQR.batchNumber}`,
                })}
                size={180}
              />
            </div>

            <p className="text-xs text-slate-600 mb-5">
              Scan this cryptographic QR to verify provenance and authenticity on the PharmaChain network.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs py-2.5 rounded-xl font-semibold transition"
              >
                🖨️ Print Label
              </button>
              <button
                onClick={() => setActiveQR(null)}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs py-2.5 rounded-xl font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
