import { config } from '@signalco/ui-themes-minimal/config';
import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/ui-primitives/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/ui/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [config],
    theme: {
        extend: {
            keyframes: {
                progress: {
                    '0%': { transform: 'translateX(0) scaleX(0)' },
                    '40%': { transform: 'translateX(0) scaleX(0.4)' },
                    '100%': { transform: 'translateX(100%) scaleX(0.5)' },
                },
                wobble: {
                    '0%, 100%': { transform: 'rotate(0deg)' },
                    '15%': { transform: 'rotate(-5deg)' },
                    '30%': { transform: 'rotate(4deg)' },
                    '45%': { transform: 'rotate(-4deg)' },
                    '60%': { transform: 'rotate(3deg)' },
                    '75%': { transform: 'rotate(-2deg)' },
                },
            },
            animation: {
                progress: 'progress 1s infinite linear',
                wobble: 'wobble 0.5s ease-in-out',
            },
        },
    },
    plugins: [tailwindcssTypography],
};
export default tailwindConfig;
