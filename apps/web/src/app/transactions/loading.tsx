export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
        <div className="mt-2 h-5 w-64 animate-pulse rounded bg-muted/30" />
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-surface" />
        <div className="mt-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
