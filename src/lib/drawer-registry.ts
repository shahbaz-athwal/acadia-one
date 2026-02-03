"use client";

import type { ComponentType } from "react";
import AccountDrawer from "@/components/drawers/account-drawer";
import ProfileDrawer from "@/components/drawers/profile-drawer";
import RatingDrawer from "@/components/drawers/rating-drawer";
import SettingsDrawer from "@/components/drawers/settings-drawer";

const DRAWER_KEYS = ["profile", "settings", "account", "rating"] as const;
const RATING_TYPES = ["course", "prof"] as const;

type DrawerKey = (typeof DRAWER_KEYS)[number];

type DrawerKeyWithProps = "rating";

type DrawerKeyWithoutProps = Exclude<DrawerKey, DrawerKeyWithProps>;

type DrawerPropsMap = {
  rating: {
    type: (typeof RATING_TYPES)[number];
    id: string;
  };
};

type DrawerStackItemWithoutProps = {
  [K in DrawerKeyWithoutProps]: { key: K };
}[DrawerKeyWithoutProps];

type DrawerStackItemWithProps = {
  [K in DrawerKeyWithProps]: { key: K; props: DrawerPropsMap[K] };
}[DrawerKeyWithProps];

type DrawerStackItem = DrawerStackItemWithoutProps | DrawerStackItemWithProps;

const DRAWER_REGISTRY = {
  profile: ProfileDrawer,
  settings: SettingsDrawer,
  account: AccountDrawer,
  rating: RatingDrawer,
};

function getDrawerComponent<K extends DrawerKey>(
  key: K
): ComponentType<K extends DrawerKeyWithProps ? DrawerPropsMap[K] : object> {
  return DRAWER_REGISTRY[key] as ComponentType<
    K extends DrawerKeyWithProps ? DrawerPropsMap[K] : object
  >;
}

function hasProps(item: DrawerStackItem): item is DrawerStackItemWithProps {
  return "props" in item;
}

export {
  DRAWER_KEYS,
  DRAWER_REGISTRY,
  RATING_TYPES,
  getDrawerComponent,
  hasProps,
};
export type {
  DrawerKey,
  DrawerKeyWithoutProps,
  DrawerKeyWithProps,
  DrawerPropsMap,
  DrawerStackItem,
};
