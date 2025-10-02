import vercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    experimental: {
        typedEnv: true,
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
    productionBrowserSourceMaps: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'www.gredice.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.gredice.com',
            },
            {
                protocol: 'https',
                hostname: 'vrt.gredice.com',
            },
            {
                // Garden - Vercel Blob
                protocol: 'https',
                hostname: 'myegtvromcktt2y7.public.blob.vercel-storage.com',
            },
            {
                // Public - Vercel Blob
                protocol: 'https',
                hostname: '7ql7fvz1vzzo6adz.public.blob.vercel-storage.com',
            },
        ],
    },
    allowedDevOrigins: ['vrt.gredice.test'],
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(withAxiom(nextConfig));
