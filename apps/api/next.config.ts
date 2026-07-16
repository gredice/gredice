import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
} from '../../scripts/app-registry.ts';

const app = getAppByName('api');
const nextConfig: NextConfig = {
    reactStrictMode: true,
    logging: {
        browserToTerminal: true,
    },
    experimental: {
        typedEnv: true,
        turbopackFileSystemCacheForDev: true,
        useTypeScriptCli: true,
    },
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
        ],
        qualities: [80, 100],
    },
    productionBrowserSourceMaps: !process.env.CI,
    allowedDevOrigins: getAppAllowedDevOrigins(app),
    skipTrailingSlashRedirect: true,
};

export default nextConfig;
