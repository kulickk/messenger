// vite.preload.config.mjs
import { defineConfig } from "vite";
import { builtinModules } from "module";

export default defineConfig({
    plugins: [],

    build: {
        rollupOptions: {
            external: [
                "electron",
                ...builtinModules.flatMap((p) => [p, `node:${p}`]),
            ],

            output: {
                format: "cjs",
                entryFileNames: "[name].js",
            },
        },

        minify: false,
    },

    resolve: {
        conditions: ["node"],
    },
});
