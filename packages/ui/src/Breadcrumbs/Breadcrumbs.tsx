import type { ReactNode } from 'react';
import { Link } from '../Link';
import { Typography } from '../Typography';
import { cx } from '../utils';
import { BreadcrumbsCollapsedItems } from './BreadcrumbsCollapsedItems';

export type BreadcrumbItem = {
    dropdownHref?: string;
    dropdownLabel?: ReactNode | string | undefined;
    href?: string;
    label: ReactNode | string | undefined;
};

export type BreadcrumbsProps = {
    items?: BreadcrumbItem[];
    endSeparator?: boolean;
    className?: string;
};

export function BreadcrumbsSeparator() {
    return (
        <Typography
            aria-hidden
            className="text-muted-foreground/50"
            component="span"
        >
            /
        </Typography>
    );
}

export function BreadcrumbsItem({ href, label }: BreadcrumbItem) {
    if (!label) {
        return null;
    }

    if (href) {
        return (
            <Link
                className="min-w-0 truncate text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                href={href}
            >
                {label}
            </Link>
        );
    }

    if (typeof label === 'string') {
        return (
            <Typography component="span" level="body2" noWrap>
                {label}
            </Typography>
        );
    }

    return label;
}

export function Breadcrumbs({
    className,
    endSeparator,
    items,
}: BreadcrumbsProps) {
    if (!items?.length) {
        return null;
    }

    return (
        <nav aria-label="Breadcrumb" className={cx('max-w-full', className)}>
            <ol className="flex min-w-0 flex-wrap items-center gap-1">
                {items.length > 3 ? (
                    <>
                        <li className="flex min-w-0 items-center gap-1">
                            <BreadcrumbsItem {...items[0]} />
                            <BreadcrumbsSeparator />
                        </li>
                        <li className="flex min-w-0 items-center gap-1">
                            <BreadcrumbsCollapsedItems
                                items={items.slice(1, -1)}
                            />
                            <BreadcrumbsSeparator />
                        </li>
                        <li className="flex min-w-0 items-center gap-1">
                            <BreadcrumbsItem {...items[items.length - 1]} />
                        </li>
                    </>
                ) : (
                    items.map((item, index) => {
                        const key =
                            item.href ??
                            (typeof item.label === 'string'
                                ? item.label
                                : `breadcrumb-${index}`);

                        return (
                            <li
                                className="flex min-w-0 items-center gap-1"
                                key={key}
                            >
                                <BreadcrumbsItem {...item} />
                                {index < items.length - 1 ? (
                                    <BreadcrumbsSeparator />
                                ) : null}
                            </li>
                        );
                    })
                )}
                {endSeparator ? (
                    <li>
                        <BreadcrumbsSeparator />
                    </li>
                ) : null}
            </ol>
        </nav>
    );
}
