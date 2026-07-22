import { Skeleton } from '@byrdos/ui';

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-40" />
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
        <Skeleton className="h-24 rounded-md" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
