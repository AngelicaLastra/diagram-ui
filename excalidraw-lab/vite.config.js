import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Excalidraw checks this at runtime; Vite has no process global.
    "process.env.IS_PREACT": JSON.stringify("false")
  },
  server: { port: 5199, strictPort: true }
});
