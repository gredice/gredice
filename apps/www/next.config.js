import { withAxiom } from 'next-axiom';

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
