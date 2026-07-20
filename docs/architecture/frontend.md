# Frontend Architecture

The byrdOS frontend is a Next.js App Router application that consumes the API and provides a fast, responsive experience across desktop and mobile. This document describes the route structure, layout, shared components, state management, data fetching, loading and error states, mobile responsiveness, and design system tokens.

This document inherits ADR-0000 §1 (AI-first development), §4 (modular architecture), §7 (interface-first design), and §10 (token optimization). The stack is decided in ADR-0001.

## Route structure

```
apps/web/app/
├─ (marketing)/
│  ├─ page.tsx              # Landing page
│  └─ layout.tsx
├─ (dashboard)/
│  ├─ layout.tsx            # Auth-required shell
│  ├─ dashboard/
│  │  └─ page.tsx           # Overview
│  ├─ accounts/
│  │  └─ page.tsx
│  ├─ accounts/[accountId]/
│  │  └─ page.tsx
│  ├─ transactions/
│  │  └─ page.tsx
│  ├─ budgets/
│  │  └─ page.tsx
│  ├─ transfers/
│  │  └─ page.tsx
│  ├─ insights/
│  │  └─ page.tsx
│  ├─ settings/
│  │  ├─ profile/
│  │  ├─ connections/
│  │  └─ notifications/
│  └─ loading.tsx
│  └─ error.tsx
├─ api/
│  ├─ auth/[...nextauth]/route.ts
│  └─ jwks/route.ts
├─ login/
│  └─ page.tsx
├─ layout.tsx
└─ globals.css
```

## Dashboard layout

The dashboard shell includes:

- Top navigation bar with user menu and notifications.
- Sidebar with navigation links (responsive: collapses to bottom nav on mobile).
- Main content area.
- Toast/notification area.

```tsx
// apps/web/app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

## Shared components

Shared UI components live in `packages/ui` and are based on shadcn/ui primitives.

```
packages/ui/src/components/
├─ button.tsx
├─ card.tsx
├─ input.tsx
├─ select.tsx
├─ dialog.tsx
├─ table.tsx
├─ tabs.tsx
├─ toast.tsx
├─ skeleton.tsx
├─ badge.tsx
└─ chart.tsx
```

Page-specific components live in `apps/web/components/` or co-located in route folders.

## State management

### Server state

TanStack Query (React Query) manages server state:

- Caching
- Background refetching
- Optimistic updates
- Mutation handling

```tsx
const { data: accounts, isLoading } = useQuery({
  queryKey: ['accounts'],
  queryFn: fetchAccounts,
});
```

### URL state

`nuqs` manages URL query state for filters, pagination, and modals.

```tsx
const [filter, setFilter] = useQueryState('filter');
```

### Local UI state

React `useState` and context are used for local UI state such as modal open/close, form draft, and sidebar collapse.

### Global client state

Zustand or Jotai may be introduced later for cross-cutting client state if context becomes unwieldy.

## Data fetching

### React Server Components (RSC)

Dashboard overview and initial page loads use RSC to prefetch data on the server.

```tsx
// apps/web/app/(dashboard)/dashboard/page.tsx
export default async function DashboardPage() {
  const accounts = await api.accounts.list();
  return <Dashboard accounts={accounts} />;
}
```

### Client mutations

Mutations use TanStack Query and call the API from client components.

```tsx
const mutation = useMutation({
  mutationFn: syncAccount,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
});
```

### Streaming

Long-running operations (like initial sync) stream progress via Server-Sent Events or WebSockets, or poll a status endpoint.

## Loading and error states

- `loading.tsx` files provide route-level loading UI.
- `error.tsx` files provide route-level error boundaries.
- Components use `Skeleton` from `packages/ui` for loading placeholders.
- Errors are surfaced via toast notifications and fallback UI.

```tsx
// apps/web/app/(dashboard)/accounts/loading.tsx
export default function Loading() {
  return <AccountsSkeleton />;
}
```

## Mobile responsiveness

- Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) adapt layouts.
- Sidebar collapses to a bottom navigation bar on small screens.
- Tables convert to cards on mobile.
- Touch targets are at least 44x44px.

## Design system tokens

Design tokens are defined in `packages/ui/src/tokens/`.

```css
:root {
  --radius: 0.625rem;
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 0 0% 98%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
}
```

Tailwind v4 reads these tokens via CSS custom properties. shadcn/ui components consume them consistently.

## Plaid Link integration

The bank connection flow uses the Plaid Link SDK:

1. RSC or API route calls `POST /links/initiate`.
2. Client receives `link_token` and opens Plaid Link.
3. On success, client calls `POST /links/exchange` with `public_token`.
4. Client subscribes to sync progress.

## Accessibility

- shadcn/ui primitives are accessible by default.
- All interactive elements have focus states.
- Color contrast meets WCAG 2.1 AA.
- Reduced motion respected via `prefers-reduced-motion`.

## Consequences

- **Positive**: App Router + RSC reduce client JavaScript for initial loads.
- **Positive**: TanStack Query simplifies server state synchronization.
- **Negative**: Mixing RSC and client components requires careful boundaries.
- **Negative**: shadcn/ui components must be kept up to date.
