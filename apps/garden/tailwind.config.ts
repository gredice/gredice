import type { Config } from "tailwindcss";
import { config } from '@signalco/ui-themes-minimal/config';
import tailwindcssTypography from '@tailwindcss/typography';
import tailwindcssAnimate from "tailwindcss-animate";

const tailwindConfig: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    '../../packages/game/src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    "./node_modules/@signalco/auth-client/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@signalco/ui/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@signalco/ui-primitives/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [config],
  plugins: [
    tailwindcssAnimate,
    tailwindcssTypography
  ],
  theme: {
    extend: {
      keyframes: {
        progress: {
          "0%": { transform: "translateX(0) scaleX(0)" },
          "40%": { transform: "translateX(0) scaleX(0.4)" },
          "100%": { transform: "translateX(100%) scaleX(0.5)" },
        },
      },
      animation: {
        progress: "progress 1s infinite linear",
      },
    }
  }
};
export default tailwindConfig;
