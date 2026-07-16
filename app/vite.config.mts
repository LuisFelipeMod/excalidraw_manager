import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, "../external/excalidraw/packages");

// CSP aplicada apenas no build (o dev server do Vite precisa de scripts
// inline para o HMR/react-refresh)
const cspOnBuild = (): PluginOption => ({
  name: "csp-on-build",
  apply: "build",
  transformIndexHtml(html) {
    const csp =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; font-src 'self' data:; " +
      "connect-src 'self' data: blob:; worker-src 'self' blob:";
    return html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    );
  },
});

export default defineConfig({
  // caminhos relativos para funcionar via file:// no Electron empacotado
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // permite servir os fontes do monorepo do Excalidraw (fora do root)
      allow: [path.resolve(__dirname, "..")],
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^@excalidraw\/common$/,
        replacement: path.resolve(packagesDir, "common/src/index.ts"),
      },
      {
        find: /^@excalidraw\/common\/(.*?)/,
        replacement: path.resolve(packagesDir, "common/src/$1"),
      },
      {
        find: /^@excalidraw\/element$/,
        replacement: path.resolve(packagesDir, "element/src/index.ts"),
      },
      {
        find: /^@excalidraw\/element\/(.*?)/,
        replacement: path.resolve(packagesDir, "element/src/$1"),
      },
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: path.resolve(packagesDir, "excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*?)/,
        replacement: path.resolve(packagesDir, "excalidraw/$1"),
      },
      {
        find: /^@excalidraw\/math$/,
        replacement: path.resolve(packagesDir, "math/src/index.ts"),
      },
      {
        find: /^@excalidraw\/math\/(.*?)/,
        replacement: path.resolve(packagesDir, "math/src/$1"),
      },
      {
        find: /^@excalidraw\/utils$/,
        replacement: path.resolve(packagesDir, "utils/src/index.ts"),
      },
      {
        find: /^@excalidraw\/utils\/(.*?)/,
        replacement: path.resolve(packagesDir, "utils/src/$1"),
      },
      {
        find: /^@excalidraw\/fractional-indexing$/,
        replacement: path.resolve(packagesDir, "fractional-indexing/src/index.ts"),
      },
      {
        find: /^@excalidraw\/laser-pointer$/,
        replacement: path.resolve(packagesDir, "laser-pointer/src/index.ts"),
      },
    ],
  },
  define: {
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  plugins: [react(), cspOnBuild()],
});
