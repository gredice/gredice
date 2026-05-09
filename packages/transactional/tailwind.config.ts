import { config } from '@signalco/ui-themes-minimal/config';
import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    content: [
        './emails/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    presets: [config],
};
export default tailwindConfig;
