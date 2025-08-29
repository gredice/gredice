'use client';

import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { useFilter } from './providers';

export function SearchInput() {
    const { filter, setFilter } = useFilter();

    return (
        <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Pretraži..."
            startDecorator={<Search className="size-5" />}
            endDecorator={
                <IconButton
                    className={cx(
                        'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                        filter ? 'visible' : 'invisible',
                    )}
                    title="Očisti pretragu"
                    onClick={() => setFilter('')}
                    size="sm"
                    variant="plain"
                >
                    <Close className="size-5" />
                </IconButton>
            }
            className="min-w-60"
            variant="soft"
        />
    );
}
