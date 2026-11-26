import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The server serves the dashboard under /app.
export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss()],
  // The server's content security policy blocks inline fonts, so fonts stay separate files at any size.
  build: { assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf|eot)$/.test(file) ? false : undefined) },
});
