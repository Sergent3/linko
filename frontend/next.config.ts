import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Ottimizzato per Docker

  // Proxy trasparente verso il backend: /api/* → backend:3001/*
  // In dev punta a localhost, in Docker usa il nome del servizio interno
  async rewrites() {
    const internalApiUrl = process.env.INTERNAL_API_URL ?? 'http://backend:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
