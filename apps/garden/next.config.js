// @ts-check

import { withAxiom } from 'next-axiom';

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        reactCompiler: true,
    }
};

export default withAxiom(nextConfig);
