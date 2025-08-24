'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import type { HTMLAttributes } from 'react';

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
    const handleSubmit = (data: FormData) => {
        const searchInput = data.get(fieldName);
        if (typeof searchInput === 'string') {
            setSearch(searchInput);
        }
    };

    return (
        <form action={handleSubmit} {...rest}>
            <Input
                name={fieldName}
                defaultValue={search}
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
                            search ? 'visible' : 'invisible',
                        )}
                        title="Očisti pretragu"
                        onClick={() => setSearch('')}
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
