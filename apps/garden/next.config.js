// @ts-check
import vercelToolbar from '@vercel/toolbar/plugins/next'
import { withAxiom } from 'next-axiom';

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        reactCompiler: true,
    },
    productionBrowserSourceMaps: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'www.gredice.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.gredice.com',
            }
        ],
    },
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(withAxiom(nextConfig));
