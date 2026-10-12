import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// The official template minus Tailwind (the app uses ../shared/styles.css verbatim as app/app.css).
export default defineConfig({
  plugins: [reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
