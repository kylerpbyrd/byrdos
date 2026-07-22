export interface MoneyProps {
  cents: number;
  currency?: string;
  className?: string;
  sign?: boolean;
}

export function Money({ cents, currency = 'USD', className, sign = false }: MoneyProps) {
  const amount = cents / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    signDisplay: sign ? 'auto' : 'never',
  }).format(amount);

  const isNegative = amount < 0;

  return (
    <span
      className={`font-mono tabular-nums tracking-tight ${isNegative ? 'text-destructive' : 'text-foreground'} ${className ?? ''}`}
    >
      {formatted}
    </span>
  );
}
