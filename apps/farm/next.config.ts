import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    experimental: {
        reactCompiler: true,
    },
    productionBrowserSourceMaps: true,
};

export default withAxiom(nextConfig);
