// @ts-check
import vercelToolbar from '@vercel/toolbar/plugins/next'
import { withAxiom } from 'next-axiom';

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        reactCompiler: true,
        // Scope hoisting is disabled as a workaround for current compatibility issues with Turbopack and our codebase.
        // This should be revisited in future Next.js versions as the underlying issue may be resolved.
        turbopackScopeHoisting: false
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
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
