# byrdOS Design System

> **Package:** `packages/ui`  
> **Framework:** Tailwind CSS v4 + shadcn/ui (Radix primitives)  
> **Status:** Seed (expanded iteratively through M5)  
> **Owner:** Frontend agent  
> **Inherits:** ADR-0000 §9 Documentation standards, ADR-0001 styling decision

---

## Design Tokens

### Colors — Semantic scale

Tailwind v4 uses `@theme` blocks. Tokens map to CSS custom properties for light/dark switching via `next-themes`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-background` | `#ffffff` | `#0a0a0a` | Page/app background |
| `--color-surface` | `#f5f5f5` | `#171717` | Card, modal, sidebar |
| `--color-surface-elevated` | `#ffffff` | `#1f1f1f` | Elevated card, popover |
| `--color-foreground` | `#0a0a0a` | `#fafafa` | Primary text |
| `--color-muted` | `#737373` | `#a3a3a3` | Secondary text, captions |
| `--color-border` | `#e5e5e5` | `#262626` | Dividers, input borders |
| `--color-primary` | `#2563eb` | `#3b82f6` | CTAs, links, active states |
| `--color-primary-foreground` | `#ffffff` | `#ffffff` | Text on primary |
| `--color-destructive` | `#dc2626` | `#ef4444` | Errors, delete actions |
| `--color-success` | `#16a34a` | `#22c55e` | Sync complete, positive amounts |
| `--color-warning` | `#ca8a04` | `#eab308` | Re-auth needed, stale data |
| `--color-info` | `#0284c7` | `#38bdf8` | Syncing status |

### Typography

| Token | Value | Usage |
|---|---|---|
| Font family (UI) | `Inter`, system-ui, sans-serif | Body, headings, UI |
| Font family (mono) | `JetBrains Mono`, monospace | Currency amounts, tabular data |
| Scale | `xs`(0.75rem) `sm`(0.875rem) `base`(1rem) `lg`(1.125rem) `xl`(1.25rem) `2xl`(1.5rem) `3xl`(1.875rem) `4xl`(2.25rem) | |
| Line height | `tight`(1.25) headings, `normal`(1.5) body, `relaxed`(1.625) long-form |
| Weight | `normal`(400) body, `medium`(500) emphasis, `semibold`(600) headings |

### Spacing

4px base grid. Tailwind spacing scale (`1` = 4px): `0.5`, `1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`, `20`, `24`.

### Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `0.25rem` (4px) | Inputs, badges, small buttons |
| `--radius-md` | `0.5rem` (8px) | Cards, modals, buttons |
| `--radius-lg` | `0.75rem` (12px) | Large cards, dialogs |
| `--radius-full` | `9999px` | Pills, avatars |

### Shadows

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` |

---

## Component Library (`packages/ui`)

All components built on Radix primitives via shadcn/ui, styled with Tailwind v4 tokens and CVA (class-variance-authority) for variants.

### Primitives (from shadcn/Radix)

| Component | Source | Purpose |
|---|---|---|
| `Button` | Radix Slot + CVA | Primary, secondary, destructive, ghost, outline, link variants |
| `Card` | div | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `Input` | native input | Text, number, password with label and error |
| `Label` | Radix Label | Accessible form labels |
| `Dialog` | Radix Dialog | Modal with overlay, title, description |
| `DropdownMenu` | Radix Dropdown | Overflow menus, user menu |
| `Select` | Radix Select | Dropdown select |
| `Tabs` | Radix Tabs | Tabbed content |
| `Table` | native table | DataTable base |
| `Skeleton` | div + animate-pulse | Loading placeholders |
| `Toast` | Radix Toast + Sonner | Notifications (success, error, info) |
| `Badge` | div | Status pills, counts |
| `Separator` | Radix Separator | Dividers |
| `Tooltip` | Radix Tooltip | Hover info |
| `Sheet` | Radix Sheet | Slide-out panels (mobile nav) |
| `Avatar` | Radix Avatar | User/org avatars with fallback |
| `Toggle` | Radix Toggle | Toggle buttons |
| `Switch` | Radix Switch | Toggle switch |
| `Checkbox` | Radix Checkbox | Checkbox input |

### Domain Components

| Component | Props | Description |
|---|---|---|
| `Money` | `amount: number, currency?: string, sign?: boolean` | Formatted currency display; mono font; red for negative; tabular alignment |
| `AccountBadge` | `account: { type, subtype, mask, name }` | Account type icon + masked number + name |
| `ProviderIcon` | `providerId: ProviderId` | Provider logo (Plaid, MX, etc.) |
| `SyncStatusBar` | `connectionId: string` | Sync progress bar; states: idle, syncing, error, reauth-required |
| `EmptyState` | `icon?, title, description, action?` | Empty state with optional CTA |
| `ErrorBoundary` | `fallback?, onReset?` | Error boundary with retry |
| `DataTable` | TanStack Table wrapper | Sortable, filterable, paginated table; uses CVA for row variants |
| `LinkProviderModal` | `providerId, onSuccess, onError` | Provider connection modal wrapper |

### Variant patterns (CVA)

```ts
// Example: Button variants
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-surface text-foreground border border-border hover:bg-surface/80',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        ghost: 'hover:bg-surface hover:text-foreground',
        outline: 'border border-border bg-transparent hover:bg-surface',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);
```

---

## Layout System

### Dashboard layout (M5)

```
┌──────────────────────────────────────────────┐
│  Top Bar: logo | search | sync-status | user │
├────────┬─────────────────────────────────────┤
│        │                                     │
│  Nav   │         Main Content Area           │
│ (side) │         (grid / table / detail)     │
│        │                                     │
└────────┴─────────────────────────────────────┘
```

| Breakpoint | Nav behavior | Content |
|---|---|---|
| `< md` (768px) | Bottom tab bar | Single column, cards instead of tables |
| `≥ md` | Collapsible left sidebar (240px → 64px) | Grid/multi-column |
| `≥ lg` (1024px) | Persistent sidebar (240px) | Full layout |

### Grid system

- Dashboard main area: CSS Grid, `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with `gap-4`
- Detail pages: single column, max-width `max-w-4xl mx-auto`
- Transaction table: full-width with horizontal scroll on mobile

---

## Accessibility (WCAG AA)

| Concern | Implementation |
|---|---|
| Color contrast | All text/UI ≥ 4.5:1 ratio (validated in CI via axe-core) |
| Focus indicators | `focus-visible:ring-2 ring-primary ring-offset-2` on all interactive elements |
| Keyboard nav | Full keyboard support; Tab, Enter, Escape, Arrow keys in DataTable/Dropdowns |
| Screen readers | `aria-label`, `aria-describedby`, `sr-only` classes; Radix primitives provide base ARIA |
| Reduced motion | `motion-safe:` / `motion-reduce:` variants; animations disabled when `prefers-reduced-motion: reduce` |
| Touch targets | Minimum 44×44px (Tailwind `min-h-[44px] min-w-[44px]`) |
| Form labels | Every input has associated `<Label>`; errors linked via `aria-describedby` |

---

## Motion & Animation

- **Minimal**: Subtle transitions only (`transition-colors duration-200`, `animate-in fade-in`)
- **No auto-play**: No carousels, no animated backgrounds
- **Respects `prefers-reduced-motion`**: All animations wrapped in `motion-safe:` variants
- **Loading**: Skeleton placeholders with `animate-pulse` (not spinners for content areas)
- **Page transitions**: None (SSR-compatible by default)

---

## Responsive Breakpoints

| Prefix | Min width | Target |
|---|---|---|
| _default_ | 0px | Mobile-first base |
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large displays |

---

## Icon System

Use `lucide-react` (tree-shakeable, consistent 24×24 grid). Provider logos are inline SVGs.

| Size | Class | Usage |
|---|---|---|
| `sm` | `size-4` | Inline with text |
| `md` | `size-5` | Buttons, nav items |
| `lg` | `size-6` | Empty states, feature icons |
| `xl` | `size-8` | Provider logos |

---

## State Indicators

| State | Visual treatment |
|---|---|
| **Syncing** | Pulsing blue dot + "Syncing..." text in SyncStatusBar |
| **Synced** | Green check + "Last synced X min ago" |
| **Error** | Red exclamation + error message; retry button |
| **Re-auth required** | Amber warning + "Reconnect needed" button |
| **Loading** | Skeleton or `LoadingSpinner` (for modals/small areas) |
| **Empty** | EmptyState component with icon + description |
| **Offline** | Persistent amber banner at top of viewport |

---

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Initial seed: tokens, components, layout, a11y, motion | Architect (byrdOS) |
