import vercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
    getAppDevPort,
    localAppHostnameUrl,
} from '../../scripts/app-registry.ts';
import { getBlockImageAssetVersion } from '../../scripts/block-image-version.ts';

const app = getAppByName('garden');
const apiApp = getAppByName('api');
const blockImageAssetVersion = getBlockImageAssetVersion([
    new URL('./public/assets/blocks/', import.meta.url),
    new URL('../www/public/assets/blocks/', import.meta.url),
]);
// Use the Vercel deployment ID (or git commit SHA) as a cache-busting tag.
// Assets are not truly immutable – they change when game models or sprites are updated.
// CDN (s-maxage) is purged automatically by Vercel on each deployment.
// Browsers cache for 1 day (max-age) so users pick up changes shortly after a new release.
// The Surrogate-Key header enables targeted CDN cache purging by deployment ID if needed.
const deploymentId =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    'local';
const gameProfileSourceCommit =
    process.env.NEXT_PUBLIC_GAME_PROFILE_SOURCE_COMMIT?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    'unknown';
const gameProfileSourceDirty =
    process.env.NEXT_PUBLIC_GAME_PROFILE_SOURCE_DIRTY?.trim() || 'unknown';
const gameProfileComparisonContractVersion =
    process.env.NEXT_PUBLIC_GAME_PROFILE_COMPARISON_CONTRACT_VERSION?.trim() ||
    '1';

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
    cacheComponents: true,
    partialPrefetching: true,
    env: {
        NEXT_PUBLIC_BLOCK_IMAGE_VERSION: blockImageAssetVersion,
        NEXT_PUBLIC_GAME_PROFILE_COMPARISON_CONTRACT_VERSION:
            gameProfileComparisonContractVersion,
        NEXT_PUBLIC_GAME_PROFILE_SOURCE_COMMIT: gameProfileSourceCommit,
        NEXT_PUBLIC_GAME_PROFILE_SOURCE_DIRTY: gameProfileSourceDirty,
    },
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
                source: '/assets/sprites/:path*',
                headers: assetCacheHeaders,
            },
            {
                source: '/assets/textures/:path*',
                headers: assetCacheHeaders,
            },
            {
                source: '/assets/hud/:path*',
                headers: assetCacheHeaders,
            },
            {
                source: '/assets/structures/:path*',
                headers: assetCacheHeaders,
            },
            {
                source: '/assets/blocks/:path*',
                headers: assetCacheHeaders,
            },
        ];
    },
    async rewrites() {
        const isDev =
            process.env.NODE_ENV === 'development' ||
            process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';
        const apiHost =
            process.env.GREDICE_API_HOST?.trim() ||
            (isDev
                ? localAppHostnameUrl(
                      apiApp,
                      'localhost',
                      getAppDevPort(apiApp),
                  )
                : 'https://api.gredice.com');

        return [
            {
                source: '/api/notifications/:path*',
                destination: `${apiHost}/api/notifications/:path*`,
            },
            {
                source: '/api/gredice/:path*',
                destination: `${apiHost}/:path*`,
            },
        ];
    },
    experimental: {
        turbopackRustReactCompiler: true,
        typedEnv: true,
        useTypeScriptCli: true,
        optimizePackageImports: [
            'three',
            '@react-three/drei',
            '@react-three/fiber',
        ],
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
    productionBrowserSourceMaps: !process.env.CI,
    images: {
        localPatterns: [
            {
                pathname: '**',
                search: '',
            },
            {
                // Block thumbnails carry a content hash so optimized images can
                // be cached without serving a stale asset after a replacement.
                pathname: '/assets/blocks/**',
                search: `?v=${blockImageAssetVersion}`,
            },
        ],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'www.gredice.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.gredice.com',
            },
            {
                protocol: 'https',
                hostname: 'vrt.gredice.com',
            },
            {
                // Garden - Vercel Blob
                protocol: 'https',
                hostname: 'myegtvromcktt2y7.public.blob.vercel-storage.com',
            },
            {
                // Public - Vercel Blob
                protocol: 'https',
                hostname: '7ql7fvz1vzzo6adz.public.blob.vercel-storage.com',
            },
        ],
    },
    allowedDevOrigins: getAppAllowedDevOrigins(app),
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(nextConfig);
