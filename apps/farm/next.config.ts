import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    experimental: {
        turbopackFileSystemCacheForDev: true,
        typedEnv: true,
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
    productionBrowserSourceMaps: !process.env.CI,
    allowedDevOrigins: ['farma.gredice.test'],
    async rewrites() {
        return [
            {
                source: '/ingest/static/:path*',
                destination: `${process.env.NEXT_PUBLIC_POSTHOG_HOST}/static/:path*`,
            },
            {
                source: '/ingest/:path*',
                destination: `${process.env.NEXT_PUBLIC_POSTHOG_HOST}/:path*`,
            },
        ];
    },
};

export default nextConfig;
