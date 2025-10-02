import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    experimental: {
        typedEnv: true,
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    // Ignore TypeScript errors in the build process
    typescript: {
        ignoreBuildErrors: true,
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
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
    productionBrowserSourceMaps: true,
    allowedDevOrigins: ['app.gredice.test'],
};

export default withAxiom(nextConfig);
