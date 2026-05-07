import { LogInIcon, LogOutIcon, RefreshCwIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { SignInDialog } from "@/components/explore/filters/sign-in-dialog";
import { ThemeToggle } from "@/components/explore/filters/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { useAuth } from "@/hooks/use-auth";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { getInitials } from "@/lib/utils";
import { SEARCH_DEFAULTS } from "@/routes/explore";

export function FilterPanelFooter() {
  const { filters, setFilters } = useExploreFilters();
  const {
    isAuthenticated,
    isLoggingOut,
    isRefreshingData,
    logout,
    refreshUserData,
    profileFirstName,
    profileLastName,
  } = useAuth();
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const hasFilters =
    filters.termCodes.length > 0 ||
    filters.departmentPrefixes.length > 0 ||
    filters.professorExternalIds.length > 0 ||
    filters.days.length > 0 ||
    filters.academicLevels.length > 0 ||
    filters.rsgKeys.length > 0 ||
    filters.timeStart !== SEARCH_DEFAULTS.ts ||
    filters.timeEnd !== SEARCH_DEFAULTS.te;

  const profileName = [profileFirstName, profileLastName]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const avatarFallbackLabel =
    isAuthenticated && profileName.length > 0 ? getInitials(profileName) : null;

  async function handleRefreshData() {
    await refreshUserData();
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {hasFilters && (
          <Button
            className="w-[90%] self-center"
            onClick={() =>
              setFilters({
                termCodes: [],
                departmentPrefixes: [],
                professorExternalIds: [],
                days: [],
                academicLevels: [],
                rsgKeys: [],
                timeStart: SEARCH_DEFAULTS.ts,
                timeEnd: SEARCH_DEFAULTS.te,
              })
            }
            size="sm"
            variant="secondary"
          >
            Clear filters
          </Button>
        )}

        <div className="flex items-center justify-between p-2">
          <Menu>
            <MenuTrigger
              render={
                <Button
                  aria-label="Open account menu"
                  className="rounded-full p-0"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <Avatar>
                <AvatarFallback>
                  {avatarFallbackLabel ? avatarFallbackLabel : <UserIcon className="size-4" />}
                </AvatarFallback>
              </Avatar>
            </MenuTrigger>
            <MenuPopup align="start">
              {isAuthenticated ? (
                <>
                  <MenuItem disabled={isRefreshingData || isLoggingOut} onClick={handleRefreshData}>
                    <RefreshCwIcon
                      className={isRefreshingData ? "size-4 animate-spin" : "size-4"}
                    />
                    {isRefreshingData ? "Refreshing..." : "Refresh data"}
                  </MenuItem>
                  <MenuItem disabled={isLoggingOut || isRefreshingData} onClick={handleLogout}>
                    <LogOutIcon className="size-4" />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </MenuItem>
                </>
              ) : (
                <MenuItem onClick={() => setIsSignInOpen(true)}>
                  <LogInIcon className="size-4" />
                  Sign in
                </MenuItem>
              )}
            </MenuPopup>
          </Menu>
          <ThemeToggle />
        </div>
      </div>
      <SignInDialog onOpenChange={setIsSignInOpen} open={isSignInOpen} />
    </>
  );
}
