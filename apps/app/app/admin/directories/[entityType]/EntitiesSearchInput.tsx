'use client';

import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';

export function EntitiesSearchInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Pretraži..."
            startDecorator={<Search className="size-5" />}
            endDecorator={
                <IconButton
                    className={cx(
                        'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                        value ? 'visible' : 'invisible',
                    )}
                    title="Očisti pretragu"
                    onClick={() => onChange('')}
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
