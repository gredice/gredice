import { ExpandDown } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import Link from 'next/link';
import { normalizeNewsFilterValue } from '../lib/newsFilters';

export function NewsCategoryFilter({
    activeCategory,
    categories,
}: {
    activeCategory?: string;
    categories: string[];
}) {
    if (categories.length === 0) {
        return null;
    }

    const selectedCategory = categories.find(
        (category) =>
            normalizeNewsFilterValue(category) ===
            normalizeNewsFilterValue(activeCategory),
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={`flex min-h-11 max-w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    selectedCategory
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
                <span className="min-w-0 break-words text-left">
                    {selectedCategory
                        ? `Blog: ${selectedCategory}`
                        : 'Teme bloga'}
                </span>
                <ExpandDown aria-hidden className="size-4 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-64 max-w-[calc(100vw-2rem)]"
            >
                <DropdownMenuItem asChild className="min-h-11">
                    <Link href="/">Sve objave</Link>
                </DropdownMenuItem>
                {categories.map((category) => (
                    <DropdownMenuItem
                        asChild
                        className="min-h-11"
                        key={category}
                    >
                        <Link
                            aria-current={
                                selectedCategory === category
                                    ? 'page'
                                    : undefined
                            }
                            className={
                                selectedCategory === category
                                    ? 'bg-accent font-semibold'
                                    : undefined
                            }
                            href={{ pathname: '/', query: { category } }}
                        >
                            {category}
                        </Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
