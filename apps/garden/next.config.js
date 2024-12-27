// @ts-check

import { withAxiom } from 'next-axiom';

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        reactCompiler: true,
    },
    productionBrowserSourceMaps: true,
};

export default withAxiom(nextConfig);
