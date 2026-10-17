import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // server-only throws outside a React Server Component; tests run plain Node.
      "server-only": fileURLToPath(new URL("./lib/__tests__/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    // .env.local gives the live tests their Appwrite key; without it they are skipped.
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 60_000,
  },
});
