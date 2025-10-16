import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    // Enable WebAssembly support for fhevmjs
    config.experiments = config.experiments || {};
    config.experiments.asyncWebAssembly = true;

    return config;
  },
};

export default nextConfig;
