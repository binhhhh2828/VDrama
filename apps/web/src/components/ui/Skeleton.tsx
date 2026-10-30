import { cn } from "@/lib/cn";

/** Khối giữ chỗ khi chờ dữ liệu. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("animate-pulse rounded-card bg-surface-2", className)} />
  );
}

/** Giữ chỗ cho lưới poster (3 cột 3:4 như PosterGrid). */
export function PosterGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-x-5 sm:gap-y-6">
      {Array.from({ length: count }, (_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  );
}

/** Giữ chỗ cho hàng poster cuộn ngang (cùng cỡ thẻ với PosterRow). */
export function PosterRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="-mx-4 flex gap-2.5 overflow-hidden px-[22px] sm:mx-0 sm:px-0">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-[calc((100vw-76px)/3)] shrink-0 sm:w-[170px] md:w-[190px]">
          <PosterSkeleton />
        </div>
      ))}
    </div>
  );
}

function PosterSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[3/4]" />
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-1/2 rounded-md" />
    </div>
  );
}
