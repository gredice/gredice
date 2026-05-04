import type { Config } from 'tailwindcss';

const tailwindConfig: Config = {
    darkMode: 'media',
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
        '../www/components/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/cms-components-marketing/dist/**/*.{js,mjs}',
        './node_modules/@signalco/cms-core/dist/**/*.{js,mjs}',
    ],
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--background))',
                border: 'hsl(var(--border))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                foreground: 'hsl(var(--foreground))',
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                tertiary: {
                    DEFAULT: 'hsl(var(--tertiary))',
                    foreground: 'hsl(var(--tertiary-foreground))',
                },
            },
        },
    },
    plugins: [],
};

export default tailwindConfig;
