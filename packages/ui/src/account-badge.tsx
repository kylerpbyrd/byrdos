import { Landmark, CreditCard, Wallet, TrendingUp, CircleDollarSign } from 'lucide-react';

export interface AccountBadgeProps {
  type: string;
  subtype?: string | null;
  mask?: string | null;
  name: string;
}

const accountIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  depository: Wallet,
  credit: CreditCard,
  loan: CircleDollarSign,
  investment: TrendingUp,
};

export function AccountBadge({ type, subtype, mask, name }: AccountBadgeProps) {
  const Icon = accountIcons[type.toLowerCase()] ?? Landmark;

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/10 text-muted">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted">
          {subtype ? `${subtype} ` : ''}
          {type}
          {mask ? ` •••• ${mask}` : ''}
        </p>
      </div>
    </div>
  );
}
