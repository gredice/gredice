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
                                        ? 'border-green-800 bg-green-800 text-white dark:border-green-200 dark:bg-green-200 dark:text-green-950'
                                        : 'border-green-800/20 bg-green-50 text-green-900 hover:border-green-800/40 hover:bg-green-100 dark:border-green-200/25 dark:bg-green-200/10 dark:text-green-100 dark:hover:bg-green-200/20'
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
                                            ? 'bg-white/15 dark:bg-green-950/10'
                                            : 'bg-green-800/10 dark:bg-green-200/15'
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
