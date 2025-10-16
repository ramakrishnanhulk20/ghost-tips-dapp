"use client";
import dynamic from "next/dynamic";

const GhostTips = dynamic(() => import("../components/GhostTips"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading GhostTips...</div>
    </div>
  ),
});

export default function Home() {
  return <GhostTips />;
}
