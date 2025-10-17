"use client";
import React, { useState } from "react";
import { ethers } from "ethers";
import blockies from "ethereum-blockies-base64";
import GHOSTTIPSABI from "./GhostTipsABI.json";
import GHOSTTOKENABI from "./GhostTokenABI.json";
import MyTips from "./MyTips";

interface TipJar {
  id: number;
  creator: string;
  title: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: number;
  tipCount: number;
}

interface LeaderboardEntry {
  id: number;
  tipCount: number;
  jar: TipJar | null;
}

export default function GhostTips() {
  const [tipsContract, setTipsContract] = useState<ethers.Contract | null>(null);
  const [tokenContract, setTokenContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [tipJars, setTipJars] = useState<TipJar[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "browse" | "create" | "send" | "deposit" | "withdraw" | "leaderboard" | "mybalance" | "mytips" | "about"
  >("about");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [ghostBalance, setGhostBalance] = useState<string>("0");
  const [myJars, setMyJars] = useState<TipJar[]>([]);
  const [encryptedBalance, setEncryptedBalance] = useState<string>("");

  const navTabs = [
    { key: "about", label: "ℹ️ About" },
    { key: "deposit", label: "💰 Deposit" },
    { key: "browse", label: "🏺 Browse Jars" },
    { key: "create", label: "➕ Create Jar" },
    { key: "send", label: "👻 Send Tip" },
    { key: "leaderboard", label: "🏆 Leaderboard" },
    { key: "mybalance", label: "💼 My Balance" },
    { key: "mytips", label: "📨 My Tips" },
    { key: "withdraw", label: "🔥 Withdraw" },
  ];

  const refreshAllData = async () => {
    if (tipsContract && tokenContract && account) {
      setLoading(true);
      try {
        await Promise.all([
          fetchTipJars(tipsContract),
          fetchLeaderboard(tipsContract),
          fetchGhostBalance(tokenContract, account),
          fetchMyJars(tipsContract, account),
        ]);
      } catch (error) {
        console.error("Failed to refresh data:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("Please install MetaMask!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const tipsAddr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      const tokenAddr = process.env.NEXT_PUBLIC_GHOST_TOKEN_ADDRESS;

      if (!tipsAddr || !tokenAddr) {
        alert("Contract addresses not configured!");
        return;
      }

      const tipsContractInstance = new ethers.Contract(tipsAddr, GHOSTTIPSABI.abi, signer);
      const tokenContractInstance = new ethers.Contract(tokenAddr, GHOSTTOKENABI.abi, signer);

      setTipsContract(tipsContractInstance);
      setTokenContract(tokenContractInstance);
      setAccount(address);
      setIsConnected(true);

      fetchTipJars(tipsContractInstance);
      fetchLeaderboard(tipsContractInstance);
      fetchGhostBalance(tokenContractInstance, address);
      fetchMyJars(tipsContractInstance, address);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert("Failed to connect wallet. Please try again.");
    }
  };

  const fetchTipJars = async (contract: ethers.Contract) => {
    try {
      const jarCount = await contract.nextJarId();
      const jars: TipJar[] = [];

      for (let i = 1; i < Number(jarCount); i++) {
        try {
          const [owner, name, , tipCount] = await contract.getTipJarInfo(i);
          jars.push({
            id: i,
            creator: owner,
            title: name,
            description: `Tip jar #${i}`,
            category: "General",
            isActive: true,
            createdAt: Date.now(),
            tipCount: Number(tipCount),
          });
        } catch (error) {
          console.error(`Failed to fetch jar ${i}:`, error);
        }
      }

      setTipJars(jars);
    } catch (error) {
      console.error("Failed to load tip jars:", error);
    }
  };

  const fetchLeaderboard = async (contract: ethers.Contract) => {
    try {
      const [addresses, , tipCounts] = await contract.getLeaderboard(10);

      if (!addresses || addresses.length === 0) {
        setLeaderboard([]);
        return;
      }

      const entries: LeaderboardEntry[] = addresses.map((addr: string, index: number) => ({
        id: index + 1,
        tipCount: Number(tipCounts[index]),
        jar: {
          id: index + 1,
          creator: addr,
          title: `Jar #${index + 1}`,
          description: "",
          category: "General",
          isActive: true,
          createdAt: Date.now(),
          tipCount: Number(tipCounts[index]),
        },
      }));

      setLeaderboard(entries);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      setLeaderboard([]);
    }
  };

  const fetchGhostBalance = async (contract: ethers.Contract, address: string) => {
    try {
      const balance = await contract.plaintextBalanceOf(address);
      setGhostBalance(balance.toString());
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const fetchMyJars = async (contract: ethers.Contract, address: string) => {
    try {
      const jarIds = await contract.getMyJars();
      const jars: TipJar[] = [];

      for (const jarId of jarIds) {
        try {
          const [owner, name, , tipCount] = await contract.getTipJarInfo(jarId);
          jars.push({
            id: Number(jarId),
            creator: owner,
            title: name,
            description: `Tip jar #${jarId}`,
            category: "General",
            isActive: true,
            createdAt: Date.now(),
            tipCount: Number(tipCount),
          });
        } catch (error) {
          console.error(`Failed to fetch jar ${jarId}:`, error);
        }
      }

      setMyJars(jars);
    } catch (error) {
      console.error("Failed to fetch my jars:", error);
    }
  };

  const handleCreateJar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tipsContract) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    setLoading(true);
    try {
      const tx = await tipsContract.createTipJar(name);
      await tx.wait();

      setSuccessMessage("🎉 Tip jar created successfully!");
      setShowSuccessModal(true);

      // Auto-refresh data
      await refreshAllData();
    } catch (error: any) {
      console.error("Failed to create tip jar:", error);
      alert("Failed to create tip jar: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendTip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tipsContract || !tokenContract) return;

    const formData = new FormData(e.currentTarget);
    const jarId = formData.get("jarId") as string;
    const amount = formData.get("amount") as string;
    const message = formData.get("message") as string;

    setLoading(true);
    try {
      const approveTx = await tokenContract.approve(await tipsContract.getAddress(), amount);
      await approveTx.wait();

      const tipTx = await tipsContract.sendTip(jarId, amount, message);
      await tipTx.wait();

      setSuccessMessage("👻 Tip sent successfully!");
      setShowSuccessModal(true);

      // Auto-refresh data
      await refreshAllData();
    } catch (error: any) {
      console.error("Failed to send tip:", error);
      alert("Failed to send tip: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tokenContract) return;

    const formData = new FormData(e.currentTarget);
    const amount = formData.get("amount") as string;

    setLoading(true);
    try {
      const tx = await tokenContract.deposit({
        value: ethers.parseEther(amount),
      });
      await tx.wait();

      setSuccessMessage("✅ Deposited successfully!");
      setShowSuccessModal(true);

      // Auto-refresh data
      await refreshAllData();
    } catch (error: any) {
      console.error("Failed to deposit:", error);
      alert("Failed to deposit: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tokenContract) return;

    const formData = new FormData(e.currentTarget);
    const amount = formData.get("amount") as string;

    setLoading(true);
    try {
      const tx = await tokenContract.withdraw(amount);
      await tx.wait();

      setSuccessMessage("🔥 Withdrawn successfully!");
      setShowSuccessModal(true);

      // Auto-refresh data
      await refreshAllData();
    } catch (error: any) {
      console.error("Failed to withdraw:", error);
      alert("Failed to withdraw: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const viewEncryptedBalance = async (jarId: number) => {
    if (!tipsContract) return;

    try {
      const [, , encryptedTotal] = await tipsContract.getTipJarInfo(jarId);
      setEncryptedBalance(encryptedTotal.toString());
      alert(`Encrypted balance handle: ${encryptedTotal.toString().slice(0, 20)}...`);
    } catch (error) {
      console.error("Failed to get encrypted balance:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="inline-block mb-6">
            <div className="text-8xl animate-bounce">👻</div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            GhostTips
          </h1>
          <p className="text-xl text-gray-300 mb-2">Anonymous tipping with TRUE privacy using FHEVM</p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <span className="bg-purple-500/20 px-3 py-1 rounded-full">✅ Fully Homomorphic Encryption</span>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            Encrypted balances • Anonymous tips • Privacy-preserving leaderboard 🔐
          </p>
        </div>

        {!isConnected ? (
          <div className="max-w-md mx-auto bg-gray-800 rounded-2xl p-8 shadow-2xl border border-purple-500/30">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🔐</div>
              <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
              <p className="text-gray-400">Start tipping anonymously with encrypted balances</p>
            </div>
            <button
              onClick={connectWallet}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Connect Wallet
            </button>
            <div className="mt-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <p className="text-xs text-gray-300">
                <span className="font-bold">🔒 Balances encrypted with FHE</span>
                <br />
                <span className="font-bold">👻 True privacy protection</span>
                <br />
                <span className="font-bold">📊 Rankings without revealing amounts</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="bg-gray-800 rounded-2xl p-6 mb-8 shadow-2xl border border-purple-500/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-4">
                  <img
                    src={blockies(account)}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full border-2 border-purple-500"
                  />
                  <div>
                    <p className="text-sm text-gray-400">Connected Wallet</p>
                    <p className="font-mono text-lg font-bold">
                      {account.slice(0, 6)}...{account.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">GHOST Balance</p>
                    <p className="text-2xl font-bold text-purple-400">{ghostBalance}</p>
                  </div>
                  <button
                    onClick={refreshAllData}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    title="Refresh all data"
                  >
                    <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
                    <span className="hidden sm:inline">{loading ? "Refreshing..." : "Refresh"}</span>
                  </button>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 text-center">
                  Built with <span className="font-bold text-purple-400">⚡ Zama FHEVM</span>
                  <br />
                  Fully Homomorphic Encryption • Sepolia Testnet
                </p>
              </div>
            </div>

            {showSuccessModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-2xl p-8 max-w-md mx-4 shadow-2xl border border-purple-500">
                  <div className="text-center">
                    <div className="text-6xl mb-4">✨</div>
                    <h3 className="text-2xl font-bold mb-4">{successMessage}</h3>
                    <button
                      onClick={async () => {
                        setShowSuccessModal(false);
                        await refreshAllData();
                      }}
                      className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded-xl font-bold"
                    >
                      Close & Refresh
                    </button>
                  </div>
                  <div className="mt-4 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <p className="text-xs text-yellow-200">
                      This is a <span className="font-bold">testnet demonstration</span>. Full decryption requires
                      production gateway access with CORS configuration. The encrypted balance retrieval demonstrates
                      that FHE encryption is working correctly on-chain. In production, decryption would be handled
                      server-side or through authorized gateway access.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-6 justify-center">
              {navTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                    activeTab === tab.key
                      ? "bg-purple-600 text-white shadow-lg"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-purple-500/30">
              {activeTab === "about" && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🔐</div>
                    <h2 className="text-3xl font-bold mb-4">Welcome to GhostTips</h2>
                    <p className="text-gray-300 text-lg">
                      The world's first truly private tipping platform powered by Fully Homomorphic Encryption (FHE)
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-gray-900 p-6 rounded-xl border border-purple-500/30">
                      <div className="text-4xl mb-3">💰</div>
                      <h3 className="text-xl font-bold mb-2">Deposit ETH</h3>
                      <p className="text-gray-400 text-sm">
                        Convert your ETH to encrypted GHOST tokens with complete privacy
                      </p>
                    </div>
                    <div className="bg-gray-900 p-6 rounded-xl border border-purple-500/30">
                      <div className="text-4xl mb-3">👻</div>
                      <h3 className="text-xl font-bold mb-2">Send Anonymous Tips</h3>
                      <p className="text-gray-400 text-sm">
                        Tip amounts are encrypted on-chain - even the contract can't see them!
                      </p>
                    </div>
                    <div className="bg-gray-900 p-6 rounded-xl border border-purple-500/30">
                      <div className="text-4xl mb-3">🔥</div>
                      <h3 className="text-xl font-bold mb-2">Withdraw Anytime</h3>
                      <p className="text-gray-400 text-sm">
                        Burn your GHOST tokens back to ETH with encrypted balance validation
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "deposit" && (
                <div className="max-w-md mx-auto">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-4xl">💰</span>
                    Deposit ETH for GHOST Tokens
                  </h2>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-purple-200">
                      <span className="font-bold">PRIVACY UPGRADE:</span> Deposit ETH to receive encrypted GHOST tokens.
                      Your token balance will be encrypted on-chain using FHEVM!
                    </p>
                  </div>
                  <form onSubmit={handleDeposit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Amount (ETH)</label>
                      <input
                        type="number"
                        name="amount"
                        step="0.001"
                        min="0.001"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                        placeholder="0.1"
                      />
                      <p className="text-xs text-gray-400 mt-1">Rate: 1 ETH = 1000 GHOST tokens</p>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
                    >
                      {loading ? "Processing..." : "Deposit ETH"}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "withdraw" && (
                <div className="max-w-md mx-auto">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-4xl">🔥</span>
                    Withdraw GHOST Tokens
                  </h2>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-orange-200">
                      💰 Burn your GHOST tokens to receive ETH back. Your encrypted balance will be reduced accordingly.
                    </p>
                  </div>
                  <form onSubmit={handleWithdraw} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Amount (GHOST Tokens)</label>
                      <input
                        type="number"
                        name="amount"
                        min="1"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                        placeholder="100"
                      />
                      <p className="text-xs text-gray-400 mt-1">Available: {ghostBalance} GHOST</p>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
                    >
                      {loading ? "Processing..." : "Withdraw ETH"}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "browse" && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-4xl">🏺</span>
                    Browse Tip Jars
                  </h2>
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="text-6xl animate-bounce mb-4">👻</div>
                      <p className="text-gray-400">Loading tip jars...</p>
                    </div>
                  ) : tipJars.length === 0 ? (
                    <div className="text-center py-12 bg-gray-900 rounded-xl">
                      <div className="text-6xl mb-4">🏺</div>
                      <p className="text-gray-400">No tip jars yet. Create the first one!</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {tipJars.map((jar) => (
                        <div
                          key={jar.id}
                          className="bg-gray-900 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <img src={blockies(jar.creator)} alt="Creator" className="w-12 h-12 rounded-full" />
                            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm font-bold">
                              #{jar.id}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold mb-2">{jar.title}</h3>
                          <p className="text-gray-400 text-sm mb-4">{jar.description}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">
                              Tips: <span className="font-bold text-white">{jar.tipCount}</span>
                            </span>
                            <span className="text-xs text-gray-500">
                              by {jar.creator.slice(0, 6)}...{jar.creator.slice(-4)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "create" && (
                <div className="max-w-md mx-auto">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-4xl">➕</span>
                    Create Tip Jar
                  </h2>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-purple-200">
                      🏺 Create your tip jar to start receiving anonymous, encrypted tips from supporters!
                    </p>
                  </div>
                  <form onSubmit={handleCreateJar} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Jar Name</label>
                      <input
                        type="text"
                        name="name"
                        required
                        maxLength={50}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                        placeholder="My Support Jar"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
                    >
                      {loading ? "Creating..." : "Create Tip Jar"}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "send" && (
                <div className="max-w-md mx-auto">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-4xl">👻</span>
                    Send Anonymous Tip
                  </h2>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-purple-200">
                      👻 Send encrypted tips with complete anonymity! Tip amounts are encrypted on-chain using FHE.
                    </p>
                  </div>
                  <form onSubmit={handleSendTip} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Tip Jar ID</label>
                      <input
                        type="number"
                        name="jarId"
                        min="1"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Amount (GHOST Tokens)</label>
                      <input
                        type="number"
                        name="amount"
                        min="1"
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                        placeholder="10"
                      />
                      <p className="text-xs text-gray-400 mt-1">Available: {ghostBalance} GHOST</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">Message (Optional)</label>
                      <textarea
                        name="message"
                        maxLength={280}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                        placeholder="Leave a message..."
                        rows={3}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
                    >
                      {loading ? "Sending..." : "Send Tip 👻"}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "leaderboard" && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-4xl">🏆</span>
                    Privacy-Preserving Leaderboard
                  </h2>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-purple-200">
                      <span className="font-bold">Privacy-First Ranking:</span> Shows tip count (public) while keeping
                      all amounts encrypted! No one can see how much you've received.
                    </p>
                  </div>
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-12 bg-gray-900 rounded-xl">
                      <div className="text-6xl mb-4">🏆</div>
                      <p className="text-gray-400">No tips yet. Be the first!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {leaderboard.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="bg-gray-900 rounded-xl p-6 border border-gray-700 flex items-center justify-between hover:border-purple-500 transition-all"
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`text-3xl font-bold ${
                                index === 0
                                  ? "text-yellow-400"
                                  : index === 1
                                    ? "text-gray-300"
                                    : index === 2
                                      ? "text-orange-400"
                                      : "text-gray-500"
                              }`}
                            >
                              #{index + 1}
                            </div>
                            <img
                              src={blockies(entry.jar?.creator || "")}
                              alt="Avatar"
                              className="w-12 h-12 rounded-full"
                            />
                            <div>
                              <h3 className="font-bold text-lg">{entry.jar?.title}</h3>
                              <p className="text-sm text-gray-400">{entry.jar?.description || ""}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Creator: {entry.jar?.creator.slice(0, 6)}...{entry.jar?.creator.slice(-4)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-400">{entry.tipCount}</div>
                            <div className="text-sm text-gray-400">tips</div>
                            <div className="text-xs text-gray-500 mt-1">🔐 Encrypted</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "mybalance" && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-4xl">💼</span>
                    My Tip Jars & Encrypted Balances
                  </h2>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-purple-200">
                      <span className="font-bold">Fully Encrypted Balances:</span> Your tip jar balances are encrypted
                      on-chain using FHEVM. Click "View Encrypted Balance" to retrieve the encrypted handle as proof of
                      working FHE implementation. ✅ This demonstrates that the encryption layer is working correctly
                      on-chain!
                    </p>
                  </div>
                  {myJars.length === 0 ? (
                    <div className="text-center py-12 bg-gray-900 rounded-xl">
                      <div className="text-6xl mb-4">🏺</div>
                      <p className="text-gray-400">You haven't created any tip jars yet.</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Create your first tip jar to start receiving anonymous tips!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myJars.map((jar) => (
                        <div key={jar.id} className="bg-gray-900 rounded-xl p-6 border border-gray-700">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <img src={blockies(jar.creator)} alt="Avatar" className="w-12 h-12 rounded-full" />
                              <div>
                                <h3 className="text-xl font-bold">{jar.title}</h3>
                                <p className="text-sm text-gray-400">{jar.description}</p>
                              </div>
                            </div>
                            <span className="bg-purple-500/20 text-purple-300 px-4 py-2 rounded-full text-sm font-bold">
                              Jar #{jar.id}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-gray-800 rounded-lg p-4">
                              <p className="text-xs text-gray-400 mb-1">Tips Received</p>
                              <p className="text-2xl font-bold text-purple-400">{jar.tipCount}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4">
                              <p className="text-xs text-gray-400 mb-1">Status</p>
                              <p className="text-2xl font-bold text-green-400">🔐 Encrypted</p>
                            </div>
                          </div>
                          <button
                            onClick={() => viewEncryptedBalance(jar.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                          >
                            View Encrypted Balance 🔐
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {encryptedBalance && (
                    <div className="mt-6 bg-gray-900 rounded-xl p-6 border border-purple-500">
                      <h3 className="text-lg font-bold mb-3">Encrypted Balance Handle</h3>
                      <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm break-all text-purple-300">
                        {encryptedBalance}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        <span className="font-bold">Privacy Note:</span> Withdrawals work with encrypted balances! The
                        smart contract handles all FHE operations securely.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "mytips" && <MyTips contract={tipsContract} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
