import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

// I colori dell'app vengono dalle variabili CSS in globals.css
const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', hover: 'var(--surface-hover)' },
        line: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        fg: { DEFAULT: 'var(--text)', strong: 'var(--text-strong)', muted: 'var(--text-muted)', faint: 'var(--text-faint)' },
        accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)', soft: 'var(--accent-soft)', text: 'var(--accent-text)' },
        danger: 'var(--danger)',
        // Landing e import usano "violet": lo allineiamo all'accento indaco
        violet: colors.indigo,
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
