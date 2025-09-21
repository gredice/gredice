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
        qualities: [80, 100],
    },
    productionBrowserSourceMaps: true,
    allowedDevOrigins: ['localhost:3005', 'api.gredice.local'],
};

export default withAxiom(nextConfig);
