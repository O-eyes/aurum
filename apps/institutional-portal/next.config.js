/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || "11155111",
  },
  webpack: (config) => {
    // wagmi/walletconnect/metamask SDK reference optional deps that don't exist
    // in a web build. Mark them absent so webpack stops trying to resolve them
    // (kills the "@react-native-async-storage/async-storage" error and speeds
    // up dev compiles).
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
