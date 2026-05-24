'use client';

import { IconButton } from '../IconButton';
import { MoreHorizontal } from '../icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../Menu';
import type { BreadcrumbItem } from './Breadcrumbs';

type BreadcrumbsCollapsedItemsProps = {
    items: BreadcrumbItem[];
};

function breadcrumbKey(item: BreadcrumbItem, index: number) {
    const href = item.dropdownHref ?? item.href;
    if (href) {
        return `${href}-${index}`;
    }

    const label = item.dropdownLabel ?? item.label;
    if (typeof label === 'string') {
        return `${label}-${index}`;
    }

    return `collapsed-breadcrumb-${index}`;
}

function breadcrumbDropdownLabel(item: BreadcrumbItem) {
    return item.dropdownLabel ?? item.label;
}

function breadcrumbDropdownHref(item: BreadcrumbItem) {
    return item.dropdownHref ?? item.href;
}

export function BreadcrumbsCollapsedItems({
    items,
}: BreadcrumbsCollapsedItemsProps) {
    const visibleItems = items.filter((item) => breadcrumbDropdownLabel(item));

    if (!visibleItems.length) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton
                    aria-label="Prikaži skrivene putanje"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    size="xs"
                    variant="plain"
                >
                    <MoreHorizontal aria-hidden className="size-4" />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-80">
                {visibleItems.map((item, index) => {
                    const href = breadcrumbDropdownHref(item);
                    const label = breadcrumbDropdownLabel(item);

                    return (
                        <DropdownMenuItem
                            className="max-w-72"
                            disabled={!href}
                            href={href}
                            key={breadcrumbKey(item, index)}
                        >
                            <span className="min-w-0 truncate">{label}</span>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
