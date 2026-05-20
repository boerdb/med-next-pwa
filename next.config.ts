import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow the dev server to be accessed from other devices on the local network
  // (fixes HMR WebSocket failures when browsing from a phone or other machine)
  allowedDevOrigins: ['*'],
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/manifest.webmanifest',
      headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
    },
  ],
};

export default nextConfig;
