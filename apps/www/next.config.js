import vercelToolbar from '@vercel/toolbar/plugins/next'
import { withAxiom } from 'next-axiom';

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
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
        ]
    },
    productionBrowserSourceMaps: true
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(withAxiom(nextConfig));