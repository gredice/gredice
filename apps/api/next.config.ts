import { type SentryBuildOptions, withSentryConfig } from '@sentry/nextjs';
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
    productionBrowserSourceMaps: true,
    allowedDevOrigins: ['api.gredice.test'],
};

const sentryConfig: SentryBuildOptions = {};

export default withSentryConfig(nextConfig, sentryConfig);
