import { grediceAppThemePreset } from '@gredice/ui/theme';
import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@gredice/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [grediceAppThemePreset],
    plugins: [tailwindcssTypography],
};

export default tailwindConfig;
