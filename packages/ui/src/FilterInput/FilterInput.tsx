'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import type { HTMLAttributes } from 'react';

export type FilterInputProps = Omit<
    HTMLAttributes<HTMLFormElement>,
    'onChange'
> & {
    searchParamName: string;
    fieldName: string;
    /**
     * If true, search updates immediately on input change.
     * If false (default), search updates on form submit.
     */
    instant?: boolean;
};

export function FilterInput({
    searchParamName,
    fieldName,
    instant = false,
    ...rest
}: FilterInputProps) {
    const [search, setSearch] = useSearchParam(searchParamName);
    const handleSubmit = (data: FormData) => {
        const searchInput = data.get(fieldName);
        if (typeof searchInput === 'string') {
            setSearch(searchInput);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (instant) {
            setSearch(e.target.value);
        }
    };

    return (
        <form action={handleSubmit} {...rest}>
            <Input
                name={fieldName}
                value={instant ? search : undefined}
                defaultValue={instant ? undefined : search}
                onChange={handleChange}
                placeholder="Pretraži..."
                startDecorator={
                    instant ? (
                        <Search className="size-5 shrink-0 ml-3" />
                    ) : (
                        <IconButton
                            className="hover:bg-neutral-300 ml-1 rounded-full aspect-square"
                            title="Pretraga"
                            type="submit"
                            size="sm"
                            variant="plain"
                        >
                            <Search className="size-5" />
                        </IconButton>
                    )
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
