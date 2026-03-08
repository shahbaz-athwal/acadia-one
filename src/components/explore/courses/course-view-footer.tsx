import { getRouteApi, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { FrameFooter } from "@/components/ui/frame";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useExploreCourses } from "@/hooks/use-explore-courses";
import { PAGE_SIZE } from "@/queries/explore";
import { withSearchDefaults } from "@/routes/explore";

const routeApi = getRouteApi("/explore");

export function CourseViewFooter() {
  const { page } = routeApi.useSearch({
    select: (state) => ({
      page: state.page,
    }),
  });
  const { totalCount } = useExploreCourses();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalCount);

  if (totalCount <= 1) {
    return null;
  }

  return (
    <FrameFooter className="flex-row items-center justify-between py-2">
      <span className="text-muted-foreground text-xs">
        Showing {start}–{end} of {totalCount}
      </span>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent className="gap-0.5 text-muted-foreground text-sm">
            <PaginationItem>
              <PaginationPrevious
                className={buttonVariants({
                  className: "h-7 rounded-md px-2 text-xs sm:h-6 sm:px-2",
                  size: "xs",
                  variant: "ghost",
                })}
                render={
                  <Link
                    disabled={page <= 1}
                    preload="intent"
                    search={(prev) => ({
                      ...withSearchDefaults(prev),
                      page: Math.max(1, page - 1),
                    })}
                    to="/explore"
                  />
                }
              />
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                className={buttonVariants({
                  className: "h-7 rounded-md px-2 text-xs sm:h-6 sm:px-2",
                  size: "xs",
                  variant: "ghost",
                })}
                render={
                  <Link
                    disabled={page >= totalPages}
                    preload="intent"
                    search={(prev) => ({
                      ...withSearchDefaults(prev),
                      page: Math.min(totalPages, page + 1),
                    })}
                    to="/explore"
                  />
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </FrameFooter>
  );
}
