import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        reactCompiler: true,
    },
    images: {
        domains: ['www.gredice.com'],
    },
    productionBrowserSourceMaps: true,
};

export default withAxiom(nextConfig);
