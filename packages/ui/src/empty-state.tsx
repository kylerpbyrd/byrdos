import { Button } from './components/button.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick?: () => void; href?: string };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-12 text-center">
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/10 text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {action &&
        (action.onClick ? (
          <Button onClick={action.onClick} className="mt-6">
            {action.label}
          </Button>
        ) : action.href ? (
          <Button asChild className="mt-6">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : null)}
    </div>
  );
}
