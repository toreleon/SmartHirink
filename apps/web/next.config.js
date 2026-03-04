/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@smarthirink/core'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
  async rewrites() {
    const apiTarget = process.env.API_PROXY_TARGET || process.env.API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
