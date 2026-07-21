export interface MoneyProps {
  cents: number;
  currency?: string;
  className?: string;
}

export function Money({ cents, currency = 'USD', className }: MoneyProps) {
  const amount = cents / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);

  return <span className={className}>{formatted}</span>;
}
