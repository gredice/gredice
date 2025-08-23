import type { NextConfig } from 'next';
import { withAxiom } from 'next-axiom';

const nextConfig: NextConfig = {
    typedRoutes: true,
    experimental: {
        typedEnv: true,
        reactCompiler: true,
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
    productionBrowserSourceMaps: true,
};

export default withAxiom(nextConfig);
