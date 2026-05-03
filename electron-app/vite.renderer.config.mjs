import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],

    optimizeDeps: {
        // Let Vite handle tdlib-wasm as-is; pre-bundling breaks its WASM loading
        exclude: ["tdlib-wasm"],
    },

    server: {
        host: "127.0.0.1",
        port: 3000,
    },
});
