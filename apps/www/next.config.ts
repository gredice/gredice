import vercelToolbar from '@vercel/toolbar/plugins/next';
import { withAxiom } from 'next-axiom';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: {
        reactCompiler: true,
        // Scope hoisting is disabled as a workaround for current compatibility issues with Turbopack and our codebase.
        // This should be revisited in future Next.js versions as the underlying issues may be resolved.
        turbopackScopeHoisting: false
    },
    expireTime: 10800, // CDN ISR expiration time: 3 hour in seconds
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'www.gredice.com',
                port: '',
                pathname: '/assets/**',
            },
            {
                protocol: 'https',
                hostname: 'cdn.gredice.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '*.public.blob.vercel-storage.com',
                port: '',
                pathname: '/**',
            },
        ]
    },
    productionBrowserSourceMaps: true
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(withAxiom(nextConfig));