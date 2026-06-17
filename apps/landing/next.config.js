/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
    NEXT_PUBLIC_INVESTOR_URL:
      process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3001",
    NEXT_PUBLIC_INSTITUTIONAL_URL:
      process.env.NEXT_PUBLIC_INSTITUTIONAL_URL || "http://localhost:3002",
  },
};

module.exports = nextConfig;
