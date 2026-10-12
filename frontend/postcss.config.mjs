// Necessario perché Next.js elabori Tailwind (@tailwind, @layer, classi di utilità)
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
