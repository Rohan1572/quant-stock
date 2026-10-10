import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rawPort = process.env.PORT ?? "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Keep the proxy in step with the API's own PORT; default matches its default.
const apiPort = process.env.API_PORT ?? "5000";

// The server binds 0.0.0.0, so Host validation stays on: `allowedHosts: true`
// would let any site point its DNS here and read the app. Extend as needed.
const allowedHosts = [
  "localhost",
  "127.0.0.1",
  "[::1]",
  ...(process.env.VITE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
];

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
    allowedHosts,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts,
  },
});
