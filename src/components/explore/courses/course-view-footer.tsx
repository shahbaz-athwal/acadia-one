import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { FrameFooter } from "@/components/ui/frame";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { useExploreCourses } from "@/hooks/use-explore-courses";
import { PAGE_SIZE } from "@/queries/explore";
import { withSearchDefaults } from "@/routes/explore";

const routeApi = getRouteApi("/explore");

function getPageRange(current: number, total: number) {
  // Always show first, last, and up to 2 pages around current
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.add(i);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

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

  const pages = getPageRange(page, totalPages);

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
              <PaginationLink
                aria-label="Go to previous page"
                className="inline-flex size-6 items-center justify-center rounded-md transition-colors hover:text-foreground"
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
              >
                <ChevronLeftIcon className="size-3" />
              </PaginationLink>
            </PaginationItem>

            {pages.map((p, i) => {
              const prev = pages[i - 1];
              const showEllipsis = prev !== undefined && p - prev > 1;

              return (
                <PaginationItem className="flex items-center text-xs" key={p}>
                  {showEllipsis && (
                    <PaginationEllipsis className="min-w-4 items-center [&_svg]:size-3" />
                  )}
                  <PaginationLink
                    className={
                      p === page
                        ? "inline-flex size-6 items-center justify-center rounded-md font-medium text-foreground"
                        : "inline-flex size-6 items-center justify-center rounded-md transition-colors hover:text-foreground"
                    }
                    isActive={p === page}
                    render={
                      <Link
                        preload="intent"
                        search={(prev) => ({
                          ...withSearchDefaults(prev),
                          page: p,
                        })}
                        to="/explore"
                      />
                    }
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              <PaginationLink
                aria-label="Go to next page"
                className="inline-flex size-6 items-center justify-center rounded-md transition-colors hover:text-foreground"
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
              >
                <ChevronRightIcon className="size-3" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </FrameFooter>
  );
}
