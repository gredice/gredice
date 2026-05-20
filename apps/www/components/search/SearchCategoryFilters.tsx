'use client';

import { cx } from '@signalco/ui-primitives/cx';
import { type SearchCategoryValue, searchCategories } from './searchCategories';

export function SearchCategoryFilters({
    activeCategory,
    controlsId,
    onSelect,
    className,
    withBorder = true,
}: {
    activeCategory: SearchCategoryValue;
    controlsId?: string;
    onSelect: (category: SearchCategoryValue) => void;
    className?: string;
    withBorder?: boolean;
}) {
    return (
        <fieldset
            className={cx(
                'px-2 py-2',
                withBorder && 'border-b border-border/70',
                className,
            )}
        >
            <legend className="sr-only">Vrsta rezultata</legend>
            <div className="flex gap-1 overflow-x-auto">
                {searchCategories.map((category) => {
                    const isActive = category.value === activeCategory;

                    return (
                        <button
                            key={category.value}
                            type="button"
                            aria-controls={controlsId}
                            aria-pressed={isActive}
                            className={cx(
                                'h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-[background-color,color,box-shadow]',
                                isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onSelect(category.value)}
                        >
                            {category.label}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}
