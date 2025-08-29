import { config } from '@signalco/ui-themes-minimal/config';
import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const tailwindConfig: Config = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    presets: [config],
    plugins: [tailwindcssAnimate, tailwindcssTypography],
};
export default tailwindConfig;
