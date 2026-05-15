import type { Config } from "tailwindcss";

const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          500: "#4f6ef7",
          600: "#3b55e6",
          700: "#2d43d4",
          900: "#1a2799",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
