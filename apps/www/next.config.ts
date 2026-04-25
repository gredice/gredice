import vercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';

const immutableAssetHeaders = [
    {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable',
    },
];

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    async headers() {
        return [
            {
                source: '/assets/models/:path*',
                headers: immutableAssetHeaders,
            },
            {
                source: '/assets/sprites/:path*',
                headers: immutableAssetHeaders,
            },
            {
                source: '/assets/textures/:path*',
                headers: immutableAssetHeaders,
            },
        ];
    },
    async rewrites() {
        const isDev =
            process.env.NODE_ENV === 'development' ||
            process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';
        const apiHost = isDev
            ? 'http://localhost:3005'
            : 'https://api.gredice.com';

        return [
            {
                source: '/api/gredice/:path*',
                destination: `${apiHost}/:path*`,
            },
        ];
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
                hostname: 'www.gredice.com',
                port: '',
                pathname: '/assets/**',
            },
            {
                protocol: 'https',
                hostname: 'cdn.gredice.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '*.public.blob.vercel-storage.com',
                port: '',
                pathname: '/**',
            },
        ],
    },
    productionBrowserSourceMaps: !process.env.CI,
    allowedDevOrigins: ['www.gredice.test'],
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(nextConfig);
