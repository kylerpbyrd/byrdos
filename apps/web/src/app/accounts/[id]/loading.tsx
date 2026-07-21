export default function AccountDetailLoading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="h-5 w-32 animate-pulse rounded bg-muted/30" />
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    </div>
  );
}
