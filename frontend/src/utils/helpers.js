/**
 * Utility helpers for the PharmaChain frontend.
 */

/**
 * Truncate an Ethereum address: 0x1234…5678
 */
export function formatAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Convert a Unix timestamp (seconds) to a readable date string.
 */
export function formatTimestamp(unix) {
  if (!unix) return 'N/A';
  const ts = typeof unix === 'bigint' ? Number(unix) : Number(unix);
  if (ts === 0) return 'N/A';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Map DrugStatus enum index to a human-readable string.
 */
const STATUS_LABELS = [
  'Manufactured',
  'Shipped to Distributor',
  'Received by Distributor',
  'Shipped to Pharmacy',
  'Received by Pharmacy',
  'Sold',
  'Recalled',
];

export function statusToString(statusEnum) {
  const idx = typeof statusEnum === 'bigint' ? Number(statusEnum) : Number(statusEnum);
  return STATUS_LABELS[idx] || 'Unknown';
}

/**
 * Map Role enum index to a human-readable string.
 */
const ROLE_LABELS = [
  'None',
  'Admin',
  'Manufacturer',
  'Distributor',
  'Pharmacy',
  'Customer',
];

export function roleToString(roleEnum) {
  const idx = typeof roleEnum === 'bigint' ? Number(roleEnum) : Number(roleEnum);
  return ROLE_LABELS[idx] || 'Unknown';
}

/**
 * Return a Tailwind color class string for a given DrugStatus (High contrast Light Theme).
 */
export function statusToColor(statusEnum) {
  const idx = typeof statusEnum === 'bigint' ? Number(statusEnum) : Number(statusEnum);
  const map = {
    0: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',        // Manufactured
    1: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',     // ShippedToDistributor
    2: 'bg-teal-50 text-teal-700 border-teal-200 font-semibold',        // ReceivedByDistributor
    3: 'bg-orange-50 text-orange-800 border-orange-200 font-semibold',  // ShippedToPharmacy
    4: 'bg-sky-50 text-sky-700 border-sky-200 font-semibold',           // ReceivedByPharmacy
    5: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',// Sold
    6: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',        // Recalled
  };
  return map[idx] || 'bg-slate-100 text-slate-700 border-slate-200 font-semibold';
}

/**
 * Return a Tailwind color class string for a given Role (High contrast Light Theme).
 */
export function roleToColor(roleEnum) {
  const idx = typeof roleEnum === 'bigint' ? Number(roleEnum) : Number(roleEnum);
  const map = {
    0: 'bg-slate-100 text-slate-700 border-slate-200 font-semibold',
    1: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold',   // Admin
    2: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',         // Manufacturer
    3: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',      // Distributor
    4: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',// Pharmacy
    5: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',   // Customer
  };
  return map[idx] || 'bg-slate-100 text-slate-700 border-slate-200 font-semibold';
}

/**
 * Format temperature from contract value (Celsius × 100) to display string.
 */
export function formatTemperature(tempValue) {
  const t = typeof tempValue === 'bigint' ? Number(tempValue) : Number(tempValue);
  return `${(t / 100).toFixed(2)} °C`;
}

/**
 * Check if a temperature value is within the safe cold-chain range.
 */
export function isTempSafe(tempValue) {
  const t = typeof tempValue === 'bigint' ? Number(tempValue) : Number(tempValue);
  return t >= 200 && t <= 800;
}
