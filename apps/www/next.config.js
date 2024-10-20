import { withAxiom } from 'next-axiom';

const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    }
};

export default withAxiom(nextConfig);
