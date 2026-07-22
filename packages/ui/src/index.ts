export { QueryProvider, type QueryProviderProps } from './query-provider.js';
export { Money, type MoneyProps } from './money.js';
export { SyncStatusBar, type SyncStatusBarProps, type SyncStatus } from './sync-status.js';

// shadcn primitives
export { Button, buttonVariants, type ButtonProps } from './components/button.js';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/card.js';
export { Badge, badgeVariants, type BadgeProps } from './components/badge.js';
export { Skeleton } from './components/skeleton.js';
export { Input } from './components/input.js';
export { Separator } from './components/separator.js';
export { Label } from './components/label.js';

// domain components
export { EmptyState, type EmptyStateProps } from './empty-state.js';
export { ErrorBoundary, type ErrorBoundaryProps } from './error-boundary.js';
export { AccountBadge, type AccountBadgeProps } from './account-badge.js';
export { ProviderIcon, type ProviderIconProps, type ProviderIconId } from './provider-icon.js';
export {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type SortDirection,
} from './data-table.js';

export { cn } from './lib/utils.js';
