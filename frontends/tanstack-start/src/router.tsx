import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { NotFound } from "./components/NotFound";
import { routeTree } from "./routeTree.gen";

// Start calls getRouter() once per server request (and once in the browser), so each request gets its own
// QueryClient: nothing is shared or cached across requests.
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // Query's default, explicit: loaders always fetch
        // The route loader is the only thing that fetches. Without these, the browser would refetch every query
        // right after hydration and after each navigation (data is instantly stale with staleTime 0), and on
        // window focus, which the other variants don't do.
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: false, // no hover/intent preloading: links fire no extra requests
    defaultStaleTime: 0, // router default: loaders re-run on every navigation
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });

  // Dehydrates the request's QueryClient into the HTML stream and hydrates it in the browser; also wraps the app
  // in a QueryClientProvider.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
