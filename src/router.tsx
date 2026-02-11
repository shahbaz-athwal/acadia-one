import { createRouter, parseSearchWith } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    parseSearch: parseSearchWith((value) => value),
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

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
