import type { NextConfig } from 'next';
import { getAppByName } from '../../scripts/app-registry.ts';

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
    allowedDevOrigins: [app.localDomain],
};

export default nextConfig;
