import type { Config } from "tailwindcss";
import { config } from '@signalco/ui-themes-minimal/config';

const tailwindConfig: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [config],
};
export default tailwindConfig;
