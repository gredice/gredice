import { config } from '@signalco/ui-themes-minimal-app/config';
import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const tailwindConfig: Config = {
    content: [
        './.storybook/**/*.{js,ts,jsx,tsx,mdx}',
        './stories/**/*.{js,ts,jsx,tsx,mdx}',
        '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
        '../app/components/**/*.{js,ts,jsx,tsx,mdx}',
        '../farm/components/**/*.{js,ts,jsx,tsx,mdx}',
        '../garden/components/**/*.{js,ts,jsx,tsx,mdx}',
        '../www/components/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/ui/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/ui-primitives/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [config],
    plugins: [tailwindcssAnimate, tailwindcssTypography],
};

export default tailwindConfig;
