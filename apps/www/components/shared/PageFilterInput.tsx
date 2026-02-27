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
    const updateSearch = (value: string) => setSearch(value);

    return (
        <form onSubmit={(event) => event.preventDefault()} {...rest}>
            <Input
                name={fieldName}
                value={search ?? ''}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Pretraži..."
                startDecorator={<Search className="size-5 shrink-0 ml-3" />}
                // Clear search
                endDecorator={
                    <IconButton
                        className={cx(
                            'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                            search ? 'visible' : 'invisible',
                        )}
                        title="Očisti pretragu"
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
