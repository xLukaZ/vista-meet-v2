import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          300: "#d478dc",
          400: "#c355cb",
          500: "#AD38B5",
          600: "#8f2c96",
          700: "#6e2174",
        },
        vista: {
          bg: "#0a0a0a",
          surface: "#141414",
          raised: "#1e1e1e",
          elevated: "#262626",
          border: "#2a2a2a",
          muted: "#666666",
        },
      },
    },
  },
  plugins: [],
};

export default config;
