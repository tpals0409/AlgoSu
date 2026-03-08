import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', 'html[class~="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;
