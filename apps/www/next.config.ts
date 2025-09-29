import vercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    experimental: {
        typedEnv: true,
        reactCompiler: true,
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
    productionBrowserSourceMaps: true,
    allowedDevOrigins: ['www.gredice.test'],
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(withAxiom(nextConfig));
