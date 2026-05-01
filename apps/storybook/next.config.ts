import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    images: {
        remotePatterns: [
            {
                hostname: 'cdn.gredice.com',
                protocol: 'https',
            },
            {
                hostname: 'www.gredice.com',
                protocol: 'https',
            },
            {
                hostname: 'vrt.gredice.com',
                protocol: 'https',
            },
            {
                hostname: 'myegtvromcktt2y7.public.blob.vercel-storage.com',
                protocol: 'https',
            },
            {
                hostname: '7ql7fvz1vzzo6adz.public.blob.vercel-storage.com',
                protocol: 'https',
            },
        ],
    },
};

export default nextConfig;
