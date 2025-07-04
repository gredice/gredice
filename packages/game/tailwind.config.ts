import type { Config } from "tailwindcss";
import { config } from '@signalco/ui-themes-minimal/config';
import tailwindcssTypography from '@tailwindcss/typography';

const tailwindConfig: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@signalco/ui-primitives/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@signalco/ui/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [config],
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
  },
  plugins: [
    tailwindcssTypography
  ],
};
export default tailwindConfig;
