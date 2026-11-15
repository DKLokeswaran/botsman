import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The server serves the dashboard under /app.
export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss()],
});
