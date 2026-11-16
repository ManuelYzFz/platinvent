import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desactivar el indicador de desarrollo ("N" flotante de Next.js)
  devIndicators: false,
  // Permitir el acceso al servidor de desarrollo (HMR, chunks, scripts) desde IPs de red local (móvil, tablet, etc.)
  allowedDevOrigins: [
    '192.168.1.5',
    '192.168.1.5:3000',
    '192.168.*.*',
    '192.168.1.*',
    '10.*.*.*',
    'localhost:3000',
    'localhost',
    'inventariadovtraxx.freedynamicdns.org',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      {
        source: '/reportes',
        destination: '/informes',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
      {
        source: '/service-worker.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;


