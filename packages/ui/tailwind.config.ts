import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import { grediceThemePreset } from './src/theme';

const tailwindConfig: Config = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    presets: [grediceThemePreset],
    plugins: [tailwindcssTypography],
};
export default tailwindConfig;
