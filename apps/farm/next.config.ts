import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
} from '../../scripts/app-registry.ts';

const app = getAppByName('farm');
const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    logging: {
        browserToTerminal: true,
    },
    experimental: {
        turbopackFileSystemCacheForDev: true,
        typedEnv: true,
        optimizePackageImports: [
            '@signalco/ui-primitives',
            '@signalco/ui-icons',
        ],
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.gredice.com',
            },
            {
                protocol: 'https',
                hostname: 'myegtvromcktt2y7.public.blob.vercel-storage.com',
            },
            {
                protocol: 'https',
                hostname: '7ql7fvz1vzzo6adz.public.blob.vercel-storage.com',
            },
        ],
    },
    productionBrowserSourceMaps: !process.env.CI,
    allowedDevOrigins: getAppAllowedDevOrigins(app),
};

export default nextConfig;
