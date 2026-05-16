import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
} from '../../scripts/app-registry.ts';

const app = getAppByName('status');
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
    },
    productionBrowserSourceMaps: !process.env.CI,
    allowedDevOrigins: getAppAllowedDevOrigins(app),
};

export default nextConfig;
