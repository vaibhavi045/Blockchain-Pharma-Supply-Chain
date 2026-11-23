import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './context/Web3Context';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import ManufacturerPanel from './components/ManufacturerPanel';
import DistributorPanel from './components/DistributorPanel';
import PharmacyPanel from './components/PharmacyPanel';
import CustomerVerify from './components/CustomerVerify';
import DrugTimeline from './components/DrugTimeline';
import ConnectWallet from './components/ConnectWallet';

function App() {
  return (
    <Web3Provider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            borderRadius: '12px',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#f0fdf4' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fef2f2' },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="manufacturer" element={<ManufacturerPanel />} />
          <Route path="distributor" element={<DistributorPanel />} />
          <Route path="pharmacy" element={<PharmacyPanel />} />
          <Route path="verify" element={<CustomerVerify />} />
          <Route path="drug/:id" element={<DrugTimeline />} />
        </Route>
      </Routes>
    </Web3Provider>
  );
}

export default App;
