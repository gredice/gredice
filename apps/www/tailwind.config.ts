import { grediceThemePreset } from '@gredice/ui/theme';
import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        '../../packages/game/src/**/*.{ts,tsx}',
        '../../packages/ui/src/**/*.{ts,tsx}',
    ],
    presets: [grediceThemePreset],
    plugins: [tailwindcssTypography],
};
export default tailwindConfig;
