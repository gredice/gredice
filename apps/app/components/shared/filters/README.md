# TableFilter Component

A reusable Notion-style filter component for tables that works with URL search parameters.

## Features

- 🎯 **Notion-style UI** - Clean dropdown interface with nested options
- 🔄 **URL-based** - Filters persist in URL, allowing bookmarking and sharing
- ⚡ **Extensible** - Easy to add new filter types
- 🎨 **Active filter chips** - Visual indicators of applied filters
- 🧹 **Clear all** - One-click filter reset

## Basic Usage

```tsx
import { TableFilter, FilterOption } from '../shared/filters';

// Define your filter options
const filters: FilterOption[] = [
    {
        key: 'status',
        label: 'Status',
        icon: <Status className="size-4" />,
        options: [
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
        ],
    },
];

function MyPage() {
    return <TableFilter filters={filters} />;
}
```

## Predefined Filters

### Time Filter

Use the predefined `TIME_FILTER_OPTIONS` for common time-based filtering:

```tsx
import { TableFilter, TIME_FILTER_OPTIONS } from '../shared/filters';

const filters = [TIME_FILTER_OPTIONS]; // "from" parameter
```

Available time options:

- Today
- Yesterday  
- Last 7 days
- Last 30 days
- Last 90 days
- This month
- Last month
- This year
- Last year

### Converting Time Filters

Use `getDateFromTimeFilter()` to convert filter values to Date objects:

```tsx
import { getDateFromTimeFilter } from '../lib/utils/timeFilters';
// or
import { getDateFromTimeFilter } from '../shared/filters';

// In your server component
export default async function MyPage({ searchParams }) {
    const fromFilter = searchParams.from;
    const fromDate = getDateFromTimeFilter(fromFilter);
    
    // Pass to your data fetching function
    const data = await getData({ from: fromDate });
}
```

## Server Components with Search Params

For server components that need to respond to filter changes:

```tsx
// page.tsx (Server Component)
export default async function MyPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const status = typeof params.status === 'string' ? params.status : '';
    
    return (
        <div>
            <MyFilters /> {/* Client component with TableFilter */}
            <MyTable status={status} /> {/* Server component */}
        </div>
    );
}

// MyFilters.tsx (Client Component)
'use client';
export function MyFilters() {
    return <TableFilter filters={myFilters} />;
}
```

## Custom Filter Types

Create custom filter configurations:

```tsx
const PRIORITY_FILTER: FilterOption = {
    key: 'priority',
    label: 'Priority',
    icon: <Flag className="size-4" />,
    options: [
        { value: '', label: 'All priorities' },
        { value: 'high', label: 'High', icon: <FlagRed className="size-4" /> },
        { value: 'medium', label: 'Medium', icon: <FlagYellow className="size-4" /> },
        { value: 'low', label: 'Low', icon: <FlagGreen className="size-4" /> },
    ],
};
```

## Multiple Filters

Combine multiple filter types:

```tsx
const filters = [
    TIME_FILTER_OPTIONS,
    STATUS_FILTER,
    PRIORITY_FILTER,
];

<TableFilter filters={filters} />
```

## Styling

The component uses Tailwind classes and can be customized:

```tsx
<TableFilter 
    filters={filters} 
    className="my-4 border-b pb-4" 
/>
```

## Examples

### Operations Table (Current Implementation)

```tsx
// page.tsx
export default async function OperationsPage({ searchParams }) {
    const params = await searchParams;
    const fromDate = getDateFromTimeFilter(params.from);
    
    return (
        <div>
            <OperationsFilters />
            <OperationsTable fromDate={fromDate} />
        </div>
    );
}

// OperationsFilters.tsx
'use client';
export function OperationsFilters() {
    return <TableFilter filters={[TIME_FILTER_OPTIONS]} />;
}
```

### Users Table with Multiple Filters

```tsx
const USER_FILTERS: FilterOption[] = [
    {
        key: 'role',
        label: 'Role',
        options: [
            { value: '', label: 'All roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'user', label: 'User' },
        ],
    },
    {
        key: 'status',
        label: 'Status', 
        options: [
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
        ],
    },
];

export function UsersFilters() {
    return <TableFilter filters={USER_FILTERS} />;
}
```

## API Reference

### TableFilter Props

| Prop | Type | Description |
|------|------|-------------|
| `filters` | `FilterOption[]` | Array of filter configurations |
| `onFiltersChange?` | `(filters: Record<string, string>) => void` | Callback when filters change |
| `className?` | `string` | Additional CSS classes |

### FilterOption Interface

```tsx
interface FilterOption {
    key: string;                    // URL parameter name
    label: string;                  // Display label
    icon?: React.ReactNode;         // Optional icon
    options: Array<{
        value: string;              // Filter value
        label: string;              // Display label
        icon?: React.ReactNode;     // Optional icon
    }>;
}
```

### Helper Functions

- `getDateFromTimeFilter(value: string): Date | undefined` - Convert time filter to Date
- `TIME_FILTER_OPTIONS: FilterOption` - Predefined time filter configuration