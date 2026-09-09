import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**'
      }
    ]
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://edubridge-1-69f4.onrender.com'
  }
};

export default nextConfig;
