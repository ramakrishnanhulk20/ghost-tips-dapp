"use client";
import { useState, useEffect } from "react";
import { Contract } from "ethers";

interface ReceivedTip {
  sender: string;
  encryptedAmount: string;
  message: string;
  timestamp: number;
}

interface MyTipsProps {
  contract: Contract | null;
}

export default function MyTips({ contract }: MyTipsProps) {
  const [myJars, setMyJars] = useState<number[]>([]);
  const [selectedJar, setSelectedJar] = useState<number | null>(null);
  const [tips, setTips] = useState<ReceivedTip[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contract) {
      fetchMyJars();
    }
  }, [contract]);

  const fetchMyJars = async () => {
    if (!contract) return;
    
    try {
      const jars = await contract.getMyJars();
      setMyJars(jars.map((id: any) => Number(id)));
    } catch (error) {
      console.error("Failed to fetch jars:", error);
      setMyJars([]);
    }
  };

  const fetchTipsForJar = async (jarId: number) => {
    if (!contract) return;
    
    setLoading(true);
    try {
      const [senders, encryptedAmounts, messages, timestamps] = await contract.getMyTips(jarId);
      
      const formattedTips: ReceivedTip[] = [];
      for (let i = 0; i < senders.length; i++) {
        formattedTips.push({
          sender: senders[i],
          encryptedAmount: encryptedAmounts[i].toString(),
          message: messages[i],
          timestamp: Number(timestamps[i]),
        });
      }
      
      setTips(formattedTips);
      setSelectedJar(jarId);
    } catch (error) {
      console.error("Failed to fetch tips:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!contract) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Connect your wallet to view received tips</p>
      </div>
    );
  }

  if (myJars.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">You don't have any tip jars yet</p>
        <p className="text-sm text-gray-500 mt-2">Create one in the Create Jar tab!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Your Tip Jars</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {myJars.map((jarId) => (
            <button
              key={jarId}
              onClick={() => fetchTipsForJar(jarId)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedJar === jarId
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 hover:border-purple-400 bg-gray-800"
              }`}
            >
              <div className="text-2xl mb-2">👻</div>
              <div className="text-sm font-bold text-white">Jar #{jarId}</div>
            </button>
          ))}
        </div>
      </div>

      {selectedJar && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4">
            Tips Received (Jar #{selectedJar})
          </h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl">👻</div>
              <p className="text-gray-400 mt-4">Loading tips...</p>
            </div>
          ) : tips.length === 0 ? (
            <div className="text-center py-8 bg-gray-800 rounded-lg">
              <p className="text-gray-400">No tips received yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tips.map((tip, index) => (
                <div
                  key={index}
                  className="bg-gray-800 p-4 rounded-lg border border-gray-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">👻</span>
                      <div>
                        <p className="text-xs text-gray-400">From</p>
                        <p className="text-sm font-mono text-white">
                          {tip.sender.slice(0, 6)}...{tip.sender.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Encrypted Amount</p>
                      <p className="text-sm font-mono text-purple-400">
                        🔐 {tip.encryptedAmount.slice(0, 10)}...
                      </p>
                    </div>
                  </div>
                  
                  {tip.message && (
                    <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Message:</p>
                      <p className="text-sm text-white">{tip.message}</p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(tip.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
