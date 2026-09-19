import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: [
        "mailed-auckland-genius-roland.trycloudflare.com",
        "much-plane-williams-paris.trycloudflare.com",
        "breathing-laundry-facts-copyrighted.trycloudflare.com",
        "nucleus-onshore-ivory.ngrok-free.dev"
      ],
      proxy: {
        "/api": {
          target: "http://localhost:8080", // Docker expõe o backend aqui
          changeOrigin: true,
        },
      },
    },
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
