import { Skeleton } from '@byrdos/ui';

export default function SettingsLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-2xl space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="mx-auto mt-6 max-w-2xl space-y-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}
