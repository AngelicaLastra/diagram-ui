import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/* Builds one self-contained .html you can double-click, the way
   diagram-studio.html works. Excalidraw code-splits heavily, so everything
   (including its lazy chunks and fonts) gets inlined; expect a big file. */
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  define: { "process.env.IS_PREACT": JSON.stringify("false") },
  build: {
    outDir: "standalone",
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
