import { UserIcon } from "lucide-react";
import { ThemeToggle } from "@/components/explore/filters/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function FilterPanelFooter() {
  return (
    <div className="mt-2 flex items-center justify-between border-t px-1 pt-3">
      <Avatar>
        <AvatarFallback>
          <UserIcon className="size-4" />
        </AvatarFallback>
      </Avatar>
      <ThemeToggle />
    </div>
  );
}
