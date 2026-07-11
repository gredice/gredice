import vercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
    getAppDevPort,
    localAppHostnameUrl,
} from '../../scripts/app-registry.ts';

const app = getAppByName('www');
const apiApp = getAppByName('api');
const newsApp = getAppByName('news');
// Use the Vercel deployment ID (or git commit SHA) as a cache-busting tag.
// Assets are not truly immutable – they change when game models or sprites are updated.
// CDN (s-maxage) is purged automatically by Vercel on each deployment.
// Browsers cache for 1 day (max-age) so users pick up changes shortly after a new release.
// The Surrogate-Key header enables targeted CDN cache purging by deployment ID if needed.
const deploymentId =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    'local';

const assetCacheHeaders = [
    {
        key: 'Cache-Control',
        value: 'public, s-maxage=31536000, max-age=86400',
    },
    {
        key: 'Surrogate-Key',
        value: `game-assets game-assets-${deploymentId}`,
    },
];

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    logging: {
        browserToTerminal: true,
    },
    async headers() {
        return [
            {
                source: '/assets/models/:path*',
                headers: assetCacheHeaders,
            },
            {
                source: '/assets/plants/:path*',
                headers: assetCacheHeaders,
            },
            {
                source: '/assets/sprites/:path*',
                headers: assetCacheHeaders,
            },
            {
                source: '/assets/textures/:path*',
                headers: assetCacheHeaders,
            },
        ];
    },
    async rewrites() {
        const isDev =
            process.env.NODE_ENV === 'development' ||
            process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';
        const apiHost =
            process.env.GREDICE_API_HOST ??
            (isDev
                ? localAppHostnameUrl(
                      apiApp,
                      'localhost',
                      getAppDevPort(apiApp),
                  )
                : 'https://api.gredice.com');
        const newsHost =
            process.env.GREDICE_NEWS_HOST ??
            (isDev
                ? localAppHostnameUrl(
                      newsApp,
                      'localhost',
                      getAppDevPort(newsApp),
                  )
                : 'https://novosti.gredice.com');

        return [
            {
                source: '/novosti',
                destination: `${newsHost}/novosti`,
            },
            {
                source: '/novosti/:path*',
                destination: `${newsHost}/novosti/:path*`,
            },
            {
                source: '/api/gredice/:path*',
                destination: `${apiHost}/:path*`,
            },
        ];
    },
    experimental: {
        turbopackFileSystemCacheForDev: true,
        typedEnv: true,
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
                hostname: 'vrt.gredice.com',
                port: '',
                pathname: '/assets/**',
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
    allowedDevOrigins: getAppAllowedDevOrigins(app),
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(nextConfig);
