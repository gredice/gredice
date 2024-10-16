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
        useLightningcss: true
    }
};

export default withAxiom(nextConfig);
