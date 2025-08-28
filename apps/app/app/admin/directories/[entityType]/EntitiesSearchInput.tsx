'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';

export function EntitiesSearchInput() {
    const [search, setSearch] = useSearchParam('search');

    return (
        <Input
            value={search || ''}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži..."
            startDecorator={<Search className="size-5" />}
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
    );
}
