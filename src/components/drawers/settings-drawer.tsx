"use client";

import { Bell, Moon, Shield, UserCog, X } from "lucide-react";
import posthog from "posthog-js";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useDrawerStack } from "@/hooks/use-drawer-stack";

function SettingsDrawer() {
  const { openDrawer, pop, clearStack } = useDrawerStack();
  const hasTrackedView = useRef(false);

  // Track drawer view once on first render
  if (!hasTrackedView.current) {
    posthog.capture("settings_drawer_viewed");
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
        <SheetTitle>Settings</SheetTitle>
        <SheetDescription>Manage your account preferences</SheetDescription>
      </SheetHeader>

      <Separator />

      <div className="flex-1 space-y-6 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border p-2">
                <Bell className="size-4" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Notifications</Label>
                <p className="text-muted-foreground text-xs">
                  Receive push notifications
                </p>
              </div>
            </div>
            <Switch
              defaultChecked
              id="notifications"
              onCheckedChange={(checked) =>
                posthog.capture("notification_toggled", { enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border p-2">
                <Moon className="size-4" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode">Dark Mode</Label>
                <p className="text-muted-foreground text-xs">
                  Toggle dark theme
                </p>
              </div>
            </div>
            <Switch
              id="dark-mode"
              onCheckedChange={(checked) =>
                posthog.capture("dark_mode_toggled", { enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border p-2">
                <Shield className="size-4" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="2fa">Two-Factor Auth</Label>
                <p className="text-muted-foreground text-xs">
                  Enable 2FA for security
                </p>
              </div>
            </div>
            <Switch
              id="2fa"
              onCheckedChange={(checked) =>
                posthog.capture("two_factor_auth_toggled", { enabled: checked })
              }
            />
          </div>
        </div>

        <Separator />

        <Button
          className="w-full justify-start"
          onClick={() => openDrawer("account")}
          variant="outline"
        >
          <UserCog className="mr-2 size-4" />
          Manage Account
        </Button>
      </div>

      <SheetFooter>
        <Button
          className="w-full"
          onClick={() => posthog.capture("settings_saved")}
        >
          Save Changes
        </Button>
        <Button className="w-full" onClick={pop} variant="outline">
          Back
        </Button>
        <Button className="w-full" onClick={clearStack} variant="ghost">
          Close Drawer
        </Button>
      </SheetFooter>
    </>
  );
}

export default SettingsDrawer;
