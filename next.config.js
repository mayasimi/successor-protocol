/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Suppress optional peer dep warnings from WalletConnect / MetaMask SDK
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
      encoding: false,
    };
    return config;
  },
};

module.exports = nextConfig;
