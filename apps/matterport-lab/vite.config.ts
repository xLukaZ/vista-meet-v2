import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@meet-vista/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@meet-vista/matterport-runtime": path.resolve(
        __dirname,
        "../../packages/matterport-runtime/src/index.ts"
      ),
      "@meet-vista/matterport-objects": path.resolve(
        __dirname,
        "../../packages/matterport-objects/src/index.ts"
      ),
      "@meet-vista/presence-core": path.resolve(
        __dirname,
        "../../packages/presence-core/src/index.ts"
      ),
    },
  },
  server: { port: 5174 },
});
