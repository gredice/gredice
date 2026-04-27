'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import type { HTMLAttributes } from 'react';
import { useEffect, useState } from 'react';

export type PageFilterInputProps = HTMLAttributes<HTMLFormElement> & {
    searchParamName: string;
    fieldName: string;
};

export function PageFilterInput({
    searchParamName,
    fieldName,
    ...rest
}: PageFilterInputProps) {
    const [search, setSearch] = useSearchParam(searchParamName);
    const [localSearch, setLocalSearch] = useState(search ?? '');

    useEffect(() => {
        setLocalSearch(search ?? '');
    }, [search]);

    const updateSearch = (value: string) => {
        setLocalSearch(value);
        setSearch(value);
    };

    const handleSubmit = (formData: FormData) => {
        const nextSearch = formData.get(fieldName);
        if (typeof nextSearch === 'string') {
            setSearch(nextSearch);
        }
    };

    return (
        <form action={handleSubmit} {...rest}>
            <Input
                name={fieldName}
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Pretraži..."
                startDecorator={
                    <IconButton
                        className="hover:bg-neutral-300 ml-1 rounded-full aspect-square"
                        title="Pretraga"
                        type="submit"
                        size="sm"
                        variant="plain"
                    >
                        <Search className="size-5" />
                    </IconButton>
                }
                // Clear search
                endDecorator={
                    <IconButton
                        className={cx(
                            'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                            localSearch ? 'visible' : 'invisible',
                        )}
                        title="Očisti pretragu"
                        type="button"
                        onClick={() => updateSearch('')}
                        size="sm"
                        variant="plain"
                    >
                        <Close className="size-5" />
                    </IconButton>
                }
                className="min-w-60"
                variant="soft"
            />
        </form>
    );
}
