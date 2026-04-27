// vite.renderer.config.mjs
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    // Только здесь используем react плагин
    plugins: [react()],

    build: {
        rollupOptions: {
            input: {
                index: "./src/renderer/index.html",
            },
        },
    },

    server: {
        host: "127.0.0.1",
        port: 3000,
    },
});
