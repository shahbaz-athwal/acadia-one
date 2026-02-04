"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useDrawerStack } from "@/hooks/use-drawer-stack";
import {
  type DrawerStackItem,
  getDrawerComponent,
  hasProps,
} from "@/lib/drawer-registry";

function GlobalDrawer() {
  const { stack, pop, clearStack } = useDrawerStack();

  const isOpen = stack.length > 0;
  const currentItem = stack.at(-1);

  // Track the last valid drawer item for exit animations
  const [lastItem, setLastItem] = useState<DrawerStackItem | undefined>(
    currentItem
  );

  useEffect(() => {
    if (currentItem) {
      setLastItem(currentItem);
    }
  }, [currentItem]);

  // Use current item if available, otherwise fall back to last item
  const itemToRender = currentItem || lastItem;
  const canGoBack = stack.length > 1;

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          clearStack();
        }
      }}
      open={isOpen}
    >
      <SheetContent className="w-[520px]" showCloseButton={false} side="right">
        {itemToRender && (
          <>
            {canGoBack && (
              <Button
                className="absolute top-4 left-4 z-10"
                onClick={pop}
                size="icon"
                variant="ghost"
              >
                <ArrowLeft className="size-4" />
                <span className="sr-only">Back</span>
              </Button>
            )}
            {(() => {
              const Component = getDrawerComponent(itemToRender.key);
              const props = hasProps(itemToRender) ? itemToRender.props : {};
              return <Component {...props} />;
            })()}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export { GlobalDrawer };
