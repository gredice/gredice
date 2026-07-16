import vercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
} from '../../scripts/app-registry.ts';

const app = getAppByName('news');
const wwwApp = getAppByName('www');
const newsBasePath = '/novosti';
const productionNewsOrigin = 'https://novosti.gredice.com';

function isDevelopmentEnv() {
    return (
        process.env.NODE_ENV === 'development' ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'development'
    );
}

function isProductionDeployment() {
    return (
        process.env.VERCEL_ENV === 'production' ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
    );
}

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/u, '');
}

function newsRootRedirectDestination() {
    if (!isProductionDeployment()) {
        return newsBasePath;
    }

    const wwwOrigin = process.env.NEXT_PUBLIC_GREDICE_WWW_ORIGIN?.trim();
    return `${wwwOrigin ? trimTrailingSlash(wwwOrigin) : 'https://www.gredice.com'}${newsBasePath}`;
}

const nextConfig: NextConfig = {
    assetPrefix: isProductionDeployment()
        ? `${productionNewsOrigin}${newsBasePath}`
        : undefined,
    basePath: newsBasePath,
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    logging: {
        browserToTerminal: true,
    },
    async redirects() {
        return [
            {
                source: '/',
                destination: newsRootRedirectDestination(),
                permanent: true,
                basePath: false,
            },
        ];
    },
    async rewrites() {
        const apiHost =
            process.env.GREDICE_API_HOST ??
            (isDevelopmentEnv()
                ? 'http://localhost:3005'
                : 'https://api.gredice.com');

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
        useTypeScriptCli: true,
    },
    expireTime: 10800,
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
    allowedDevOrigins: [
        ...getAppAllowedDevOrigins(app),
        ...getAppAllowedDevOrigins(wwwApp),
    ],
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(nextConfig);
