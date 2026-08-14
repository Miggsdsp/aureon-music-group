import type { NextConfig } from 'next';

const ONE_YEAR = 60 * 60 * 24 * 365;

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: ONE_YEAR,
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1440, 1600, 1920, 2560],
    imageSizes: [24, 32, 48, 64, 96, 128, 192, 256, 384],
    qualities: [50, 60, 70, 75, 80, 85, 90],
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.(svg|png|jpg|jpeg|webp|avif|ico|woff|woff2)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*.(mp3|m4a|aac|wav|ogg|flac)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Access-Control-Expose-Headers', value: 'Accept-Ranges, Content-Length, Content-Range' },
        ],
      },
      {
        source: '/:path*.(mp4|webm|mov|m4v)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Access-Control-Expose-Headers', value: 'Accept-Ranges, Content-Length, Content-Range' },
        ],
      },
      {
        source: '/(sitemap.xml|image-sitemap.xml|video-sitemap.xml|robots.txt)',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' }],
      },
      {
        source: '/(artists|music|videos|news|about|legal|community)',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=86400' }],
      },
      {
        source: '/(artists|music|videos|news)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
