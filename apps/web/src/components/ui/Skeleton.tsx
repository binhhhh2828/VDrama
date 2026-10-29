import { cn } from "@/lib/cn";

/** Khối giữ chỗ khi chờ dữ liệu. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("animate-pulse rounded-card bg-surface-2", className)} />
  );
}

/** Giữ chỗ cho một hàng poster (lưới giống PosterGrid). */
export function PosterGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <Skeleton className="aspect-[2/3]" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/2 rounded-md" />
        </div>
      ))}
    </div>
  );
}
