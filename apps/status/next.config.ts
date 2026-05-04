import type { NextConfig } from 'next';

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
    allowedDevOrigins: ['status.gredice.test'],
};

export default nextConfig;
