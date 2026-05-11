import type { NextConfig } from 'next';
import { getAppByName } from '../../scripts/app-registry.ts';

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
        ],
    },
    productionBrowserSourceMaps: !process.env.CI,
    allowedDevOrigins: [app.localDomain],
};

export default nextConfig;
