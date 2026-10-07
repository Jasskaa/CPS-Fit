import type { MetadataRoute } from 'next'
import { APP_NAME, APP_TAGLINE } from '@/lib/config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} · C.P. Santjoanenc`,
    short_name: APP_NAME,
    description: APP_TAGLINE.ca,
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#090b16',
    theme_color: '#1f2fff',
    lang: 'ca',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Començar entrenament', url: '/app', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }],
  }
}
