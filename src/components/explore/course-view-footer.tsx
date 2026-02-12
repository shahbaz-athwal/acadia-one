import { Link, getRouteApi } from "@tanstack/react-router";
import { FrameFooter } from "@/components/ui/frame";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useExploreCourses, PAGE_SIZE } from "@/hooks/use-explore-courses";
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
  const search = routeApi.useSearch();
  const { totalCount } = useExploreCourses();

  const page = search.page;
  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalCount ?? 0);

  const pages = getPageRange(page, totalPages);

  return (
    <FrameFooter className="flex-row items-center justify-between">
      <span className="text-muted-foreground text-sm">
        Showing {start}–{end} of {totalCount ?? 0}
      </span>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                render={
                  <Link
                    to="/explore"
                    search={(prev) => ({
                      ...withSearchDefaults(prev),
                      page: Math.max(1, page - 1),
                    })}
                    disabled={page <= 1}
                  />
                }
              />
            </PaginationItem>

            {pages.map((p, i) => {
              const prev = pages[i - 1];
              const showEllipsis = prev !== undefined && p - prev > 1;

              return (
                <PaginationItem key={p}>
                  {showEllipsis && <PaginationEllipsis />}
                  <PaginationLink
                    isActive={p === page}
                    render={
                      <Link
                        to="/explore"
                        search={(prev) => ({
                          ...withSearchDefaults(prev),
                          page: p,
                        })}
                      />
                    }
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              <PaginationNext
                render={
                  <Link
                    to="/explore"
                    search={(prev) => ({
                      ...withSearchDefaults(prev),
                      page: Math.min(totalPages, page + 1),
                    })}
                    disabled={page >= totalPages}
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
