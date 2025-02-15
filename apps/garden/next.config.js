// @ts-check

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

export default withAxiom(nextConfig);
