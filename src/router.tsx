import type { QueryClient } from "@tanstack/react-query";
import { createRouter, parseSearchWith } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export interface RouterContext {
  queryClient: QueryClient;
}

export const getRouter = (queryClient: QueryClient) => {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    parseSearch: parseSearchWith((value) => value),
    stringifySearch: (search) => {
      const entries = Object.entries(search).filter(([, value]) => value !== undefined);
      if (entries.length === 0) {
        return "";
      }
      const query = entries
        .map(([key, value]) => {
          const encodedKey = encodeURIComponent(key);
          if (Array.isArray(value)) {
            const encodedArray = value.map((item) => encodeURIComponent(String(item))).join(",");
            return `${encodedKey}=${encodedArray}`;
          }
          return `${encodedKey}=${encodeURIComponent(String(value))}`;
        })
        .join("&");
      return `?${query}`;
    },
    scrollRestoration: true,
  });

  return router;
};
