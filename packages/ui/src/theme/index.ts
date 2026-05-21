import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const themeExtend = {
    colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))',
        },
        tertiary: {
            DEFAULT: 'hsl(var(--tertiary))',
            foreground: 'hsl(var(--tertiary-foreground))',
        },
        destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))',
            transparent: 'hsl(var(--card-transparent))',
        },
    },
    borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
    },
    keyframes: {
        'accordion-down': {
            from: { height: '0px' },
            to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
            from: { height: 'var(--radix-accordion-content-height)' },
            to: { height: '0px' },
        },
        'scroll-reveal': {
            '0%': { opacity: '0' },
            '2%': { opacity: '1' },
        },
        scroll: {
            '0%': { transform: 'translateY(0)' },
            '100%': { transform: 'translateY(-100%)' },
        },
    },
    aspectRatio: {
        card: '1.586/1',
    },
    animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'scroll-overflow': 'scroll-reveal 1ms linear',
        scroll: 'scroll 5s linear infinite',
    },
};

const appFontScale = 0.875;

function fontSize(size: number, lineHeight: number | '1') {
    return [
        `${size * appFontScale}rem`,
        {
            lineHeight:
                lineHeight === '1'
                    ? lineHeight
                    : `${lineHeight * appFontScale}rem`,
        },
    ] satisfies [string, { lineHeight: string }];
}

const appFontSize = {
    xs: fontSize(0.75, 1),
    sm: fontSize(0.875, 1.25),
    base: fontSize(1, 1.5),
    lg: fontSize(1.125, 1.75),
    xl: fontSize(1.25, 1.75),
    '2xl': fontSize(1.5, 2),
    '3xl': fontSize(1.875, 2.25),
    '4xl': fontSize(2.25, 2.5),
    '5xl': fontSize(3, '1'),
    '6xl': fontSize(3.75, '1'),
    '7xl': fontSize(4.5, '1'),
    '8xl': fontSize(6, '1'),
    '9xl': fontSize(8, '1'),
};

export const grediceThemePreset = {
    darkMode: ['class', '[class="dark"]'],
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: themeExtend,
    },
    plugins: [tailwindcssAnimate],
} satisfies Config;

export const grediceAppThemePreset = {
    ...grediceThemePreset,
    theme: {
        ...grediceThemePreset.theme,
        fontSize: appFontSize,
    },
} satisfies Config;
