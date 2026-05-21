import { grediceAppThemePreset } from '@gredice/ui/theme';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [grediceAppThemePreset],
};
export default tailwindConfig;
