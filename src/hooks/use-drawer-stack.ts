"use client";

import { createParser, useQueryState } from "nuqs";

import {
  DRAWER_KEYS,
  type DrawerKey,
  type DrawerKeyWithoutProps,
  type DrawerKeyWithProps,
  type DrawerPropsMap,
  type DrawerStackItem,
  RATING_TYPES,
} from "@/lib/drawer-registry";

type OpenDrawer = {
  <K extends DrawerKeyWithoutProps>(key: K): void;
  <K extends DrawerKeyWithProps>(key: K, props: DrawerPropsMap[K]): void;
};

/**
 * Custom parser for drawer stack that encodes the full stack in a single URL param.
 *
 * Format: `profile,settings,rating:course:abc123,rating:prof:xyz789`
 * - Simple drawers: just the key
 * - Drawers with props: `key:prop1:prop2`
 */
const parseAsDrawerStack = createParser<DrawerStackItem[]>({
  parse(queryValue) {
    if (!queryValue) {
      return null;
    }

    const items: DrawerStackItem[] = [];

    for (const segment of queryValue.split(",")) {
      const parts = segment.split(":");
      const key = parts[0];

      // Validate key
      if (!DRAWER_KEYS.includes(key as DrawerKey)) {
        continue;
      }

      if (key === "rating") {
        const type = parts[1];
        const id = parts[2];
        const isValidType = RATING_TYPES.includes(type as "course" | "prof");
        const hasRequiredProps = isValidType && id;

        // Validate rating props
        if (!hasRequiredProps) {
          continue;
        }

        items.push({
          key: "rating",
          props: { type: type as "course" | "prof", id },
        });
      } else {
        items.push({ key: key as Exclude<DrawerKey, "rating"> });
      }
    }

    return items.length > 0 ? items : null;
  },

  serialize(stack) {
    return stack
      .map((item) => {
        if (item.key === "rating" && "props" in item) {
          return `rating:${item.props.type}:${item.props.id}`;
        }
        return item.key;
      })
      .join(",");
  },

  eq(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, i) => {
      const other = b[i];
      if (item.key !== other.key) {
        return false;
      }
      if (item.key === "rating" && other.key === "rating") {
        return (
          "props" in item &&
          "props" in other &&
          item.props.type === other.props.type &&
          item.props.id === other.props.id
        );
      }
      return true;
    });
  },
});

function useDrawerStack() {
  const [stack, setStack] = useQueryState(
    "d",
    parseAsDrawerStack.withDefault([]).withOptions({ history: "replace" })
  );

  const openDrawer = (<K extends DrawerKey>(
    key: K,
    props?: K extends DrawerKeyWithProps ? DrawerPropsMap[K] : never
  ) => {
    if (key === "rating" && props) {
      setStack([
        ...stack,
        { key: "rating", props: props as DrawerPropsMap["rating"] },
      ]);
    } else {
      setStack([...stack, { key: key as Exclude<DrawerKey, "rating"> }]);
    }
  }) as OpenDrawer;

  function pop() {
    if (stack.length === 0) {
      return;
    }
    setStack(stack.slice(0, -1));
  }

  function clearStack() {
    setStack([]);
  }

  return {
    stack,
    openDrawer,
    pop,
    clearStack,
  };
}

export { useDrawerStack };
