import type { MetadataRoute } from 'next';
import { APP_METADATA } from '@/lib/constants';
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_METADATA.name,
    short_name: APP_METADATA.shortName,
    description: APP_METADATA.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: APP_METADATA.themeColor,
    icons: [
      {
        src: '/pwa/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pwa/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}