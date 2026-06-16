import type { Route } from 'next';
import Link from 'next/link';

type FilterParam = 'category' | 'tag' | 'type';

type FilterOption = {
    label: string;
    value: string;
};

type CurrentFilters = Partial<Record<FilterParam, string | undefined>>;

function filterOption(value: string | FilterOption): FilterOption {
    return typeof value === 'string' ? { label: value, value } : value;
}

function filterHref({
    currentFilters,
    param,
    value,
}: {
    currentFilters?: CurrentFilters;
    param: FilterParam;
    value?: string;
}): Route {
    const params = new URLSearchParams();

    for (const [key, filterValue] of Object.entries(currentFilters ?? {})) {
        if (key !== param && filterValue) {
            params.set(key, filterValue);
        }
    }

    if (value) {
        params.set(param, value);
    }

    const query = params.toString();
    return (query ? `/?${query}` : '/') as Route;
}

export function FilterPills({
    active,
    currentFilters,
    label,
    param,
    values,
}: {
    active?: string;
    currentFilters?: CurrentFilters;
    label: string;
    param: FilterParam;
    values: (string | FilterOption)[];
}) {
    if (values.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
                {label}
            </p>
            <div className="flex flex-wrap gap-2">
                <Link
                    className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                        active
                            ? 'bg-background text-muted-foreground'
                            : 'bg-primary text-primary-foreground'
                    }`}
                    href={filterHref({ currentFilters, param })}
                >
                    Sve
                </Link>
                {values.map((rawValue) => {
                    const option = filterOption(rawValue);

                    return (
                        <Link
                            key={option.value}
                            className={`rounded-sm border px-3 py-1.5 text-sm font-medium ${
                                active === option.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-muted-foreground hover:text-foreground'
                            }`}
                            href={filterHref({
                                currentFilters,
                                param,
                                value: option.value,
                            })}
                        >
                            {option.label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
