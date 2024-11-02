// src/app/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { Aptos, Network, AptosConfig, Types } from '@aptos-labs/ts-sdk';

// Initialize Aptos client
const config = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(config);

interface NFT {
  creator: string;
  price: number;
  name: string;
  isListed: boolean;
}

export default function NFTMarketplace() {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [newNFT, setNewNFT] = useState({
    name: '',
    price: 0
  });
  const [walletAddress, setWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moduleAddress = process.env.NEXT_PUBLIC_MODULE_ADDRESS || '0xe9c0c69b92cd4937ee32cefb571cb7ad10d155edfbabdfe0d65bef7771a9d1d6';

  useEffect(() => {
    const checkWallet = async () => {
      try {
        // @ts-ignore
        const petra = window.petra;
        if (!petra) {
          setError('Petra wallet not installed. Please install Petra wallet extension.');
          return;
        }
      } catch (err) {
        console.error('Error checking wallet:', err);
        setError('Error checking wallet status');
      }
    };

    checkWallet();
  }, []);

  const connectWallet = async () => {
    try {
      setError(null);
      // @ts-ignore
      const petra = window.petra;
      if (!petra) {
        setError('Petra wallet not installed');
        return;
      }

      const response = await petra.connect();
      setWalletAddress(response.address);

      // After connecting, fetch listed NFTs for this address
      await fetchListedNFTs(response.address);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet. Please try again.');
    }
  };

  const fetchListedNFTs = async (address: string) => {
    try {
      const resources = await aptos.getAccountResources({
        accountAddress: address
      });

      const nftResources = resources.filter(resource =>
        resource.type.includes('SimpleMarketplace::ListedNFT')
      );

      const fetchedNFTs = nftResources.map(resource => ({
        creator: resource.data.creator,
        price: Number(resource.data.price) / 100,
        name: resource.data.name,
        isListed: resource.data.is_listed
      }));

      setNfts(fetchedNFTs);
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError('Failed to fetch listed NFTs');
    }
  };

  const listNFT = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // @ts-ignore
      const petra = window.petra;
      if (!petra) {
        throw new Error('Petra wallet not found');
      }

      const priceInSmallestUnits = Math.floor(newNFT.price * 100);

      const payload: Types.EntryFunctionPayload = {
        function: `${moduleAddress}::SimpleMarketplace::list_nft`,
        type_arguments: [],
        arguments: [newNFT.name, priceInSmallestUnits.toString()]
      };

      const transaction = await petra.signAndSubmitTransaction(payload);
      await aptos.waitForTransaction({ transactionHash: transaction.hash });

      // Refresh NFT listings
      await fetchListedNFTs(walletAddress);

      setNewNFT({ name: '', price: 0 });
      alert('NFT listed successfully!');
    } catch (err: any) {
      console.error('Error listing NFT:', err);
      setError(err.message || 'Failed to list NFT');
    } finally {
      setIsLoading(false);
    }
  };

  const buyNFT = async (creator: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // @ts-ignore
      const petra = window.petra;
      if (!petra) {
        throw new Error('Petra wallet not found');
      }

      const payload: Types.EntryFunctionPayload = {
        function: `${moduleAddress}::SimpleMarketplace::buy_nft`,
        type_arguments: [],
        arguments: [creator]
      };

      const transaction = await petra.signAndSubmitTransaction(payload);
      await aptos.waitForTransaction({ transactionHash: transaction.hash });

      // Refresh NFT listings after purchase
      await fetchListedNFTs(walletAddress);

      alert('NFT purchased successfully!');
    } catch (err: any) {
      console.error('Error buying NFT:', err);
      const errorMessage = err.message || 'Failed to buy NFT';

      if (errorMessage.includes('ENFT_NOT_LISTED')) {
        setError('This NFT is no longer listed for sale');
      } else if (errorMessage.includes('EINSUFFICIENT_FUNDS')) {
        setError('Insufficient funds to purchase this NFT');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {error && (
        <div className="mb-4 p-4 bg-red-500 text-white rounded-lg">
          {error}
        </div>
      )}

      <nav className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-blue-400">NFT Marketplace</h1>
        {!walletAddress ? (
          <button
            onClick={connectWallet}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="bg-gray-800 px-4 py-2 rounded-lg">
            <p className="text-gray-300">Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
          </div>
        )}
      </nav>

      {walletAddress && (
        <form onSubmit={listNFT} className="mb-8 bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-blue-400">List New NFT</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">NFT Name</label>
              <input
                type="text"
                value={newNFT.name}
                onChange={(e) => setNewNFT({ ...newNFT, name: e.target.value })}
                className="mt-1 block w-full rounded bg-gray-700 border-gray-600 text-white p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Price (APT)</label>
              <input
                type="number"
                value={newNFT.price}
                onChange={(e) => setNewNFT({ ...newNFT, price: Number(e.target.value) })}
                min="0"
                step="0.01"
                className="mt-1 block w-full rounded bg-gray-700 border-gray-600 text-white p-2"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full px-4 py-2 rounded-lg text-white font-medium ${
                isLoading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 transition-colors'
              }`}
            >
              {isLoading ? 'Listing...' : 'List NFT'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nfts.map((nft, index) => (
          <div key={index} className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h3 className="text-xl font-semibold mb-2 text-blue-400">{nft.name}</h3>
            <p className="text-gray-300">Price: {nft.price} APT</p>
            <p className="text-gray-300">Creator: {nft.creator.slice(0, 6)}...{nft.creator.slice(-4)}</p>
            <p className="text-gray-300">Status: {nft.isListed ? 'Listed' : 'Sold'}</p>
            {nft.isListed && nft.creator !== walletAddress && (
              <button
                onClick={() => buyNFT(nft.creator)}
                disabled={isLoading}
                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Buy NFT
              </button>
            )}
          </div>
        ))}
      </div>

      {nfts.length === 0 && walletAddress && (
        <div className="text-center text-gray-400 mt-8">
          No NFTs listed yet. List your first NFT above!
        </div>
      )}
    </div>
  );
}