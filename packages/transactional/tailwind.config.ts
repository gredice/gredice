import { grediceThemePreset } from '@gredice/ui/theme';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './emails/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [grediceThemePreset],
};
export default tailwindConfig;
