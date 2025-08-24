import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    reactStrictMode: true,
    experimental: {
        typedEnv: true,
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
    },
    productionBrowserSourceMaps: true,
};

export default withAxiom(nextConfig);
