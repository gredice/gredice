import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
} from '../../scripts/app-registry.ts';

const app = getAppByName('app');
const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    logging: {
        browserToTerminal: true,
    },
    experimental: {
        authInterrupts: true,
        typedEnv: true,
        turbopackFileSystemCacheForDev: true,
        optimizePackageImports: [
            'three',
            '@react-three/drei',
            '@react-three/fiber',
        ],
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
    productionBrowserSourceMaps: !process.env.CI,
    allowedDevOrigins: getAppAllowedDevOrigins(app),
};

export default nextConfig;
