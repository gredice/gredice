import vercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';
import {
    getAppAllowedDevOrigins,
    getAppByName,
} from '../../scripts/app-registry.ts';

const app = getAppByName('news');
const wwwApp = getAppByName('www');

const nextConfig: NextConfig = {
    basePath: '/novosti',
    reactStrictMode: true,
    typedRoutes: true,
    reactCompiler: true,
    logging: {
        browserToTerminal: true,
    },
    async rewrites() {
        const isDev =
            process.env.NODE_ENV === 'development' ||
            process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';
        const apiHost =
            process.env.GREDICE_API_HOST ??
            (isDev ? 'http://localhost:3005' : 'https://api.gredice.com');

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
