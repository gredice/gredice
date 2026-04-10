import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const shouldSkipSentrySourceMaps = Boolean(process.env.CI);

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
    productionBrowserSourceMaps: !shouldSkipSentrySourceMaps,
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

export default withSentryConfig(nextConfig, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: 'gredice',

    project: 'api',

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: !shouldSkipSentrySourceMaps,
    sourcemaps: {
        disable: shouldSkipSentrySourceMaps,
    },

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",
});
