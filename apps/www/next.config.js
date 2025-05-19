import vercelToolbar from '@vercel/toolbar/plugins/next'
import { withAxiom } from 'next-axiom';

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        reactCompiler: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'www.gredice.com',
                port: '',
                pathname: '/assets/**',
            },
        ]
    },
    productionBrowserSourceMaps: true,
    logging: {
        fetches: {
            fullUrl: true
        }
    }
};

const withVercelToolbar = vercelToolbar();

export default withVercelToolbar(withAxiom(nextConfig));