/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@smarthirink/core'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;
