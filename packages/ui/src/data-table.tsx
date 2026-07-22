'use client';

import { useState, isValidElement } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from './lib/utils.js';

import { Skeleton } from './components/skeleton.js';
import { EmptyState } from './empty-state.js';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyState?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
  className?: string;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  onSort?: (key: string, direction: SortDirection) => void;
  rowHref?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyState,
  loading = false,
  loadingRows = 5,
  className,
  defaultSort,
  onSort,
  rowHref,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | undefined>(
    defaultSort,
  );

  function handleSort(column: DataTableColumn<T>) {
    if (!column.sortable) return;

    let next: { key: string; direction: 'asc' | 'desc' } | undefined;
    if (sort?.key === column.key) {
      next = sort.direction === 'asc' ? { key: column.key, direction: 'desc' } : undefined;
    } else {
      next = { key: column.key, direction: 'asc' };
    }
    setSort(next);
    onSort?.(next?.key ?? '', next?.direction ?? null);
  }

  const sortedData = sort
    ? [...data].sort((a, b) => {
        const col = columns.find((c) => c.key === sort.key);
        if (!col) return 0;
        const aCell = col.cell(a);
        const bCell = col.cell(b);
        const aText = extractText(aCell);
        const bText = extractText(bCell);
        if (aText < bText) return sort.direction === 'asc' ? -1 : 1;
        if (aText > bText) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      })
    : data;

  if (!loading && data.length === 0) {
    return (
      <div className={className}>
        {emptyState ?? (
          <EmptyState
            title="No data"
            description="There is nothing to show right now."
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full caption-bottom text-sm">
        <thead className="border-b border-border bg-surface-elevated">
          <tr>
            {columns.map((column) => {
              const isActive = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  className={cn(
                    'h-12 px-4 text-left align-middle font-medium text-muted',
                    column.sortable && 'cursor-pointer hover:text-foreground',
                    column.headerClassName,
                  )}
                  onClick={() => handleSort(column)}
                  aria-sort={
                    isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && (
                      <span className="inline-flex size-4 items-center justify-center">
                        {isActive ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {loading
            ? Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`loading-${i}`}>
                  {columns.map((column, ci) => (
                    <td key={`${column.key}-${ci}`} className={cn('p-4', column.className)}>
                      <Skeleton className="h-5 w-full max-w-[120px]" />
                    </td>
                  ))}
                </tr>
              ))
            : sortedData.map((row) => {
                const href = rowHref?.(row);
                return (
                  <tr
                    key={keyExtractor(row)}
                    onClick={href ? () => (window.location.href = href) : undefined}
                    onKeyDown={
                      href
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              window.location.href = href;
                            }
                          }
                        : undefined
                    }
                    tabIndex={href ? 0 : undefined}
                    role={href ? 'link' : undefined}
                    className={cn(
                      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                      href && 'cursor-pointer hover:bg-surface-elevated',
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn('p-4 align-middle text-foreground', column.className)}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement<{ children?: React.ReactNode }>(node) && node.props.children) {
    return extractText(node.props.children);
  }
  return '';
}
