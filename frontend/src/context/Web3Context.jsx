import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserProvider, JsonRpcProvider, Wallet, Contract } from 'ethers';
import contractData from '../contractData.json';
import toast from 'react-hot-toast';

export const TEST_ACCOUNTS = {
  admin: {
    key: 'admin',
    role: 1,
    name: 'System Admin',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    icon: '🛡️',
  },
  manufacturer: {
    key: 'manufacturer',
    role: 2,
    name: 'PharmaCorp India (Manufacturer)',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    icon: '🏭',
  },
  distributor: {
    key: 'distributor',
    role: 3,
    name: 'MedDistribute Logistics (Distributor)',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb272296ac6737420257cf7b456aed5607e3a56',
    icon: '🚛',
  },
  pharmacy: {
    key: 'pharmacy',
    role: 4,
    name: 'HealthPlus Pharmacy',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    icon: '🏪',
  },
  customer: {
    key: 'customer',
    role: 5,
    name: 'Viraj (Patient / Customer)',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec340f6c2c27027d1421633519c2a6f235882b5d44747230c14b2d49a0',
    icon: '👤',
  },
};

const Web3Context = createContext(null);

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) throw new Error('useWeb3 must be used within a Web3Provider');
  return context;
}

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [role, setRole] = useState(0);
  const [userName, setUserName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txHistory, setTxHistory] = useState([]);
  const [latestTxReceipt, setLatestTxReceipt] = useState(null);
  const [blockNumber, setBlockNumber] = useState(null);

  const hasMetaMask = typeof window !== 'undefined' && Boolean(window.ethereum);

  const fetchBlockNumber = useCallback(async (prov) => {
    try {
      const p = prov || provider;
      if (p) {
        const b = await p.getBlockNumber();
        setBlockNumber(Number(b));
      }
    } catch (e) {
      console.error('Failed to get block number:', e);
    }
  }, [provider]);

  const recordTx = useCallback((txData) => {
    const entry = {
      ...txData,
      id: txData.txHash || Math.random().toString(),
      timestamp: Date.now(),
    };
    setTxHistory((prev) => [entry, ...prev.slice(0, 24)]);
    setLatestTxReceipt(entry);
    if (provider) fetchBlockNumber(provider);
  }, [provider, fetchBlockNumber]);

  const detectRole = useCallback(async (contractInstance, addr) => {
    try {
      const user = await contractInstance.getUser(addr);
      const r = Number(user.role);
      setRole(r);
      setUserName(user.name || '');
      return r;
    } catch (err) {
      console.error('Error detecting role:', err);
      setRole(0);
      setUserName('');
      return 0;
    }
  }, []);

  // Switch MetaMask to Hardhat Localhost (Chain ID 31337 / 0x7a69)
  const switchToHardhatNetwork = useCallback(async () => {
    if (!window.ethereum) return false;
    const HARDHAT_CHAIN_ID_HEX = '0x7a69'; // 31337 in hex
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HARDHAT_CHAIN_ID_HEX }],
      });
      toast.success('Switched to Hardhat Localhost network!');
      return true;
    } catch (switchError) {
      // 4902 error code means the network is not yet added to MetaMask
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: HARDHAT_CHAIN_ID_HEX,
                chainName: 'Hardhat Localhost',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
          toast.success('Hardhat Localhost added and selected in MetaMask!');
          return true;
        } catch (addError) {
          console.error('Failed to add network:', addError);
          toast.error('Failed to add Hardhat Localhost to MetaMask');
          return false;
        }
      }
      console.error('Failed to switch network:', switchError);
      return false;
    }
  }, []);

  // Connect via MetaMask
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('MetaMask not detected! You can use One-Click Demo Mode below.', {
        duration: 5000,
      });
      return false;
    }

    setLoading(true);
    try {
      // Automatically ensure MetaMask is on the local Hardhat chain (31337)
      await switchToHardhatNetwork();

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const browserProvider = new BrowserProvider(window.ethereum);
      const userSigner = await browserProvider.getSigner();
      const contractInstance = new Contract(
        contractData.address,
        contractData.abi,
        userSigner
      );

      setProvider(browserProvider);
      setSigner(userSigner);
      setContract(contractInstance);
      setAccount(accounts[0]);
      setIsConnected(true);
      setIsSimulated(false);

      await detectRole(contractInstance, accounts[0]);
      toast.success('MetaMask connected to Hardhat Localhost!');
      return true;
    } catch (err) {
      console.error('Connection error:', err);
      if (err.code === 4001) {
        toast.error('Connection rejected by user.');
      } else {
        toast.error('Failed to connect MetaMask.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [detectRole, switchToHardhatNetwork]);

  // Connect via Built-in Hardhat Node RPC (No MetaMask required!)
  const connectAsTestAccount = useCallback(async (accountKey) => {
    const acc = TEST_ACCOUNTS[accountKey];
    if (!acc) return false;
    setLoading(true);
    try {
      const rpcUrl = 'http://127.0.0.1:8545';
      const rpcProvider = new JsonRpcProvider(rpcUrl);
      const testSigner = new Wallet(acc.privateKey, rpcProvider);
      const contractInstance = new Contract(
        contractData.address,
        contractData.abi,
        testSigner
      );

      setProvider(rpcProvider);
      setSigner(testSigner);
      setContract(contractInstance);
      setAccount(acc.address);
      setRole(acc.role);
      setUserName(acc.name);
      setIsConnected(true);
      setIsSimulated(true);

      toast.success(`Connected as ${acc.name}!`, { icon: acc.icon });
      return true;
    } catch (err) {
      console.error('Test account connect error:', err);
      toast.error(
        'Could not connect to http://127.0.0.1:8545. Please ensure "npm run node" is running in Terminal 1!',
        { duration: 6000 }
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect as Read-Only Guest (Public Explorer)
  const connectAsGuest = useCallback(async () => {
    setLoading(true);
    try {
      const rpcUrl = 'http://127.0.0.1:8545';
      const rpcProvider = new JsonRpcProvider(rpcUrl);
      const contractInstance = new Contract(
        contractData.address,
        contractData.abi,
        rpcProvider
      );
      setProvider(rpcProvider);
      setSigner(null);
      setContract(contractInstance);
      setAccount('0x0000000000000000000000000000000000000000');
      setRole(0);
      setUserName('Public Guest / Verifier');
      setIsConnected(true);
      setIsSimulated(true);
      toast.success('Connected in Public Explorer Mode!', { icon: '🔍' });
      return true;
    } catch (err) {
      console.error('Guest connect error:', err);
      toast.error('Local node at http://127.0.0.1:8545 not responding. Ensure "npm run node" is running.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setIsConnected(false);
    setRole(0);
    setUserName('');
    setSigner(null);
    setIsSimulated(false);
    toast('Disconnected', { icon: '👋' });
  }, []);

  // Handle MetaMask account changes
  useEffect(() => {
    if (!window.ethereum || isSimulated) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        const newAccount = accounts[0];
        setAccount(newAccount);

        if (contract) {
          const browserProvider = new BrowserProvider(window.ethereum);
          const userSigner = await browserProvider.getSigner();
          const newContract = new Contract(
            contractData.address,
            contractData.abi,
            userSigner
          );
          setProvider(browserProvider);
          setSigner(userSigner);
          setContract(newContract);
          await detectRole(newContract, newAccount);
          toast.success('Account switched in MetaMask!');
        }
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [contract, detectRole, disconnect, isSimulated]);

  // Poll block number whenever connected
  useEffect(() => {
    if (!provider) return;
    fetchBlockNumber(provider);
    const interval = setInterval(() => {
      fetchBlockNumber(provider);
    }, 5000);
    return () => clearInterval(interval);
  }, [provider, fetchBlockNumber]);

  const value = {
    account,
    provider,
    signer,
    contract,
    role,
    userName,
    isConnected,
    isSimulated,
    hasMetaMask,
    loading,
    txHistory,
    latestTxReceipt,
    setLatestTxReceipt,
    recordTx,
    blockNumber,
    fetchBlockNumber,
    connectWallet,
    switchToHardhatNetwork,
    connectAsTestAccount,
    connectAsGuest,
    disconnect,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export default Web3Context;
