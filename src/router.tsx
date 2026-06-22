import { QueryClient } from "@tanstack/react-query";
import { createRouter, parseSearchWith } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";

export interface RouterContext {
  queryClient: QueryClient;
}

export const getRouter = () => {
  const queryClient = new QueryClient();
  const router = createRouter({
    context: { queryClient },
    parseSearch: parseSearchWith((value) => value),
    routeTree,
    scrollRestoration: true,
    stringifySearch: (search) => {
      const entries = Object.entries(search).filter(
        ([, value]) => value !== undefined
      );
      if (entries.length === 0) {
        return "";
      }
      const query = entries
        .map(([key, value]) => {
          const encodedKey = encodeURIComponent(key);
          if (Array.isArray(value)) {
            const encodedArray = value
              .map((item) => encodeURIComponent(String(item)))
              .join(",");
            return `${encodedKey}=${encodedArray}`;
          }
          return `${encodedKey}=${encodeURIComponent(String(value))}`;
        })
        .join("&");
      return `?${query}`;
    },
  });
  setupRouterSsrQueryIntegration({
    queryClient,
    router,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof getRouter;
  }
}
