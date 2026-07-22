import { Skeleton } from '@byrdos/ui';

export default function ConnectLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-56" />
          <Skeleton className="mx-auto h-5 w-72" />
        </div>
        <Skeleton className="mt-8 h-96 rounded-lg" />
        <Skeleton className="mx-auto mt-6 h-4 w-64" />
      </div>
    </div>
  );
}
