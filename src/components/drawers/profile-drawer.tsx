"use client";

import { Settings, User, X } from "lucide-react";
import posthog from "posthog-js";
import { useRef } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDrawerStack } from "@/hooks/use-drawer-stack";

function ProfileDrawer() {
  const { openDrawer, clearStack } = useDrawerStack();
  const hasTrackedView = useRef(false);

  // Track drawer view once on first render
  if (!hasTrackedView.current) {
    posthog.capture("profile_drawer_viewed");
    hasTrackedView.current = true;
  }

  return (
    <>
      <SheetHeader className="relative">
        <SheetClose
          aria-label="Close"
          className="absolute top-2 right-2"
          render={<Button size="icon" variant="ghost" />}
        >
          <X className="size-4" />
        </SheetClose>
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage alt="User" src="https://github.com/shadcn.png" />
            <AvatarFallback>
              <User className="size-8" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <SheetTitle className="text-xl">John Doe</SheetTitle>
            <SheetDescription>john.doe@example.com</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <Separator />

      <div className="flex-1 space-y-4 p-4">
        <div className="space-y-2">
          <h3 className="font-medium text-muted-foreground text-sm">
            Account Details
          </h3>
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Username</span>
              <span className="font-medium text-sm">@johndoe</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                Member since
              </span>
              <span className="font-medium text-sm">Jan 2024</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Plan</span>
              <span className="font-medium text-sm">Pro</span>
            </div>
          </div>
        </div>
      </div>

      <SheetFooter>
        <Button
          className="w-full"
          onClick={() => openDrawer("settings")}
          variant="outline"
        >
          <Settings className="mr-2 size-4" />
          Open Settings
        </Button>
        <Button className="w-full" onClick={clearStack} variant="ghost">
          Close Profile
        </Button>
      </SheetFooter>
    </>
  );
}

export default ProfileDrawer;
