import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  /** Optional total row count — when provided, shows "· N items" next to the page label. */
  totalItems?: number;
}

/** Page numbers to render, with "ellipsis" gaps for large ranges (e.g. 1 … 9 10 11 … 20). */
function getPageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
  totalItems,
}: PaginationProps) {
  const items = getPageItems(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-[13px] text-muted-foreground">
        Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}
        {typeof totalItems === "number" && (
          <> · {totalItems} item{totalItems === 1 ? "" : "s"}</>
        )}
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {items.map((it, i) =>
          it === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1 text-sm text-muted-foreground select-none"
              aria-hidden
            >
              …
            </span>
          ) : (
            <Button
              key={it}
              variant={it === currentPage ? "default" : "outline"}
              size="icon"
              className={cn("h-8 w-8 text-[13px] font-medium", it === currentPage && "pointer-events-none")}
              onClick={() => onPageChange(it)}
              disabled={isLoading}
              aria-current={it === currentPage ? "page" : undefined}
              aria-label={`Page ${it}`}
            >
              {it}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
