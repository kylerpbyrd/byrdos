import { Skeleton } from '@byrdos/ui';

export default function DashboardLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-2 h-12 w-64 md:h-14 md:w-80" />
          <Skeleton className="mt-4 h-5 w-48" />
        </div>

        <div>
          <Skeleton className="mb-3 h-7 w-24" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="mb-3 h-7 w-36" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
