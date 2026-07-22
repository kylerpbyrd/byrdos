import { Skeleton } from '@byrdos/ui';

export default function AccountDetailLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="mt-4 h-80 rounded-lg" />
      </div>
    </div>
  );
}
