/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@smarthirink/core'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;
