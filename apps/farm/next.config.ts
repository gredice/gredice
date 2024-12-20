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
    productionBrowserSourceMaps: true,
};

export default withAxiom(nextConfig);
