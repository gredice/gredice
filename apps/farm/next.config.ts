import { type SentryBuildOptions, withSentryConfig } from '@sentry/nextjs';
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
    productionBrowserSourceMaps: true,
    allowedDevOrigins: ['farma.gredice.test'],
};

const sentryConfig: SentryBuildOptions = {};

export default withSentryConfig(nextConfig, sentryConfig);
