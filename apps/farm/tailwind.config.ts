import { config } from '@signalco/ui-themes-minimal-app/config';
import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/auth-client/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/auth-server/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/ui/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/ui-primitives/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [config],
    plugins: [tailwindcssTypography],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'sans-serif'],
            },
        },
    },
};
export default tailwindConfig;
