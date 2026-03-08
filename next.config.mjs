/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Only apply COOP/COEP on workspace pages (where WebContainers runs)
        source: '/workspace/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
