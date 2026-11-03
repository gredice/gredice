import Link from 'next/link';
import { normalizeNewsFilterValue } from '../lib/newsFilters';

export function NewsCategoryFilter({
    activeCategory,
    categories,
}: {
    activeCategory?: string;
    categories: { name: string; count: number }[];
}) {
    if (categories.length === 0) {
        return null;
    }

    return (
        <nav
            aria-label="Teme bloga"
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"
        >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Iz bloga
            </span>
            <ul className="flex min-w-0 flex-wrap gap-2">
                {categories.map((category) => {
                    const isActive =
                        normalizeNewsFilterValue(category.name) ===
                        normalizeNewsFilterValue(activeCategory);

                    return (
                        <li className="max-w-full" key={category.name}>
                            <Link
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex min-h-11 items-center gap-2 rounded-full border py-2 pl-4 pr-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                    isActive
                                        ? 'border-brand bg-brand text-brand-foreground'
                                        : 'border-brand/20 bg-brand/5 text-foreground hover:border-brand/40 hover:bg-brand/10'
                                }`}
                                href={{
                                    pathname: '/',
                                    query: { category: category.name },
                                }}
                            >
                                <span className="min-w-0 break-words">
                                    {category.name}
                                </span>
                                <span
                                    className={`flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs tabular-nums ${
                                        isActive
                                            ? 'bg-brand-foreground/15'
                                            : 'bg-brand/10'
                                    }`}
                                >
                                    <span className="sr-only">
                                        Broj objava:{' '}
                                    </span>
                                    {category.count}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
