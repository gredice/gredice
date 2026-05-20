'use client';

import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent, HTMLAttributes } from 'react';
import { useMemo } from 'react';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';

export type PageFilterInputProps = HTMLAttributes<HTMLFormElement> & {
    searchParamName: string;
    fieldName: string;
    initialValue?: string;
    navigateOnChange?: boolean;
};

export function PageFilterInput({
    searchParamName,
    fieldName,
    initialValue = '',
    navigateOnChange = false,
    onSubmit,
    ...rest
}: PageFilterInputProps) {
    const router = useRouter();
    const pathname = usePathname();
    const currentSearchParams = useSearchParams();

    const [search, setSearch] = useClientSearchParam(
        searchParamName,
        initialValue,
    );

    const nextParams = useMemo(
        () => new URLSearchParams(currentSearchParams.toString()),
        [currentSearchParams],
    );

    const updateSearch = (value: string) => {
        setSearch(value);

        if (!navigateOnChange) {
            return;
        }

        if (value.trim()) {
            nextParams.set(searchParamName, value);
        } else {
            nextParams.delete(searchParamName);
        }

        const nextSearch = nextParams.toString();
        const nextHref = (
            nextSearch ? `${pathname}?${nextSearch}` : pathname
        ) as Route;
        router.replace(nextHref);
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        updateSearch(event.target.value);
    };

    const handleSubmit: NonNullable<PageFilterInputProps['onSubmit']> = (
        event,
    ) => {
        if (navigateOnChange) {
            return;
        }

        event.preventDefault();
        onSubmit?.(event);
    };

    return (
        <form {...rest} onSubmit={handleSubmit}>
            <div className="flex min-w-60 items-center rounded-md border border-muted-foreground/10 bg-primary/10 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <IconButton
                    className="hover:bg-neutral-300 ml-1 rounded-full aspect-square"
                    title="Pretraga"
                    type="button"
                    size="sm"
                    variant="plain"
                >
                    <Search className="size-5" />
                </IconButton>
                <input
                    id={fieldName}
                    name={searchParamName}
                    value={search}
                    onChange={handleChange}
                    placeholder="Pretraži..."
                    aria-label="Pretraga"
                    className="h-10 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground"
                />
                <IconButton
                    className={cx(
                        'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                        search ? 'visible' : 'invisible',
                    )}
                    title="Očisti pretragu"
                    type="button"
                    onClick={() => updateSearch('')}
                    size="sm"
                    variant="plain"
                >
                    <Close className="size-5" />
                </IconButton>
            </div>
        </form>
    );
}
