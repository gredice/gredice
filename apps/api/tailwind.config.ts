import type { Config } from "tailwindcss";
import { config } from '@signalco/ui-themes-minimal-app/config';

const tailwindConfig: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@signalco/auth-server/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@signalco/ui/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@signalco/ui-primitives/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [config]
};
export default tailwindConfig;
