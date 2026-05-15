import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@meet-vista/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@meet-vista/meeting-core": path.resolve(
        __dirname,
        "../../packages/meeting-core/src/index.ts"
      ),
      "@meet-vista/presence-core": path.resolve(
        __dirname,
        "../../packages/presence-core/src/index.ts"
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
