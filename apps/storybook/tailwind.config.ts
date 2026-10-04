import { grediceAppThemePreset } from '@gredice/ui/theme';
import tailwindcssTypography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './.storybook/**/*.{js,ts,jsx,tsx,mdx}',
        './stories/**/*.{js,ts,jsx,tsx,mdx}',
        '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
        '../../packages/game/src/**/*.{js,ts,jsx,tsx,mdx}',
        '../app/components/**/*.{js,ts,jsx,tsx,mdx}',
        '../farm/components/**/*.{js,ts,jsx,tsx,mdx}',
        '../garden/components/**/*.{js,ts,jsx,tsx,mdx}',
        '../www/components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [grediceAppThemePreset],
    plugins: [tailwindcssTypography],
};

export default tailwindConfig;
