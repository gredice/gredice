import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    experimental: {
        reactCompiler: true,
        serverActions: {
            bodySizeLimit: '10mb'
        }
    },
    images: {
        remotePatterns: [
            {
                hostname: 'cdn.gredice.com',
                protocol: 'https',
            },
            {
                hostname: 'www.gredice.com',
                protocol: 'https'
            }
        ]
    },
    productionBrowserSourceMaps: true,
};

export default withAxiom(nextConfig);
