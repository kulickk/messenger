// vite.main.config.mjs
import { defineConfig } from "vite";
import { builtinModules } from "module";

export default defineConfig({
    // Не используем react плагин для main процесса
    plugins: [],

    build: {
        rollupOptions: {
            // Внешние модули, которые не нужно бандлить
            external: [
                "electron",
                ...builtinModules.flatMap((p) => [p, `node:${p}`]),
            ],

            output: {
                format: "cjs",
                entryFileNames: "[name].js",
            },
        },

        // Отключаем минификацию для удобства отладки
        minify: false,
    },

    resolve: {
        // Поддержка Node.js модулей
        conditions: ["node"],
    },
});
