import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Im Entwicklungsmodus läuft das Backend separat: `uv run pianoscribe serve --dev` (Port 8765).
const backend = process.env.PIANOSCRIBE_BACKEND ?? "http://127.0.0.1:8765";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, ws: true, changeOrigin: false },
      "/samples": { target: backend },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 9000, // Verovio (WASM) ist ein großes, separat geladenes Modul
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
