import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const employeesRedirects = {
  name: "yarok-employees-redirects",
  configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
    // Old /ops links and public quote links (/quote/<token>) now live in the employees area
    server.middlewares.use((req, res, next) => {
      const url: string = req.url ?? "";
      const quote = /^\/quote\/([^/?#]+)/.exec(url);
      const ops = /^\/ops(\/.*)?$/.exec(url);
      if (!quote && !ops) return next();
      res.statusCode = 302;
      res.setHeader("Location", quote ? `/employees/quote/${quote[1]}` : `/employees${ops![1] ?? "/"}`);
      res.end();
    });
  },
};

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8090,
    strictPort: true,
    // The backend (npm run dev:api) serves the API, login, storage and realtime under /api
    proxy: {
      "/api": { target: "http://localhost:3001", ws: true },
    },
  },
  plugins: [react(), employeesRedirects],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React copies (fixes "Cannot read properties of null (reading 'useRef')")
    dedupe: ["react", "react-dom"],
  },
  build: {
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'query-vendor': ['@tanstack/react-query'],
          'chart-vendor': ['recharts'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    // Use esbuild for minification (faster, built-in)
    minify: 'esbuild',
  },
}));
