import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    experimental: {
        typedEnv: true,
        turbopackFileSystemCacheForDev: true,
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
    allowedDevOrigins: ['api.gredice.test'],
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
    skipTrailingSlashRedirect: true,
};

export default nextConfig;
