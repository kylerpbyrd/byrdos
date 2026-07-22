import { Skeleton } from '@byrdos/ui';

export default function AccountsLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-5 w-56" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
