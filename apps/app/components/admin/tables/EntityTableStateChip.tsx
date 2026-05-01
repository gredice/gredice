'use client';

import type { SelectEntity } from '@gredice/storage';
import { Megaphone } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { useState } from 'react';

export function EntityTableStateChip({
    initialState,
    onPublish,
}: {
    initialState: SelectEntity['state'];
    onPublish: () => Promise<void>;
}) {
    const [state, setState] = useState(initialState);
    const [loading, setLoading] = useState(false);

    const handlePublish = async () => {
        setLoading(true);
        setState('published');

        try {
            await onPublish();
        } catch (error) {
            setState('draft');
            setLoading(false);
            throw error;
        }
    };

    if (state !== 'draft') {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex appearance-none rounded-2xl border-0 bg-transparent p-0"
                    aria-label="Promijeni status zapisa"
                    disabled={loading}
                >
                    <Chip
                        color="neutral"
                        className="w-fit"
                        title="Promijeni status zapisa"
                    >
                        Draft
                    </Chip>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem
                    onClick={handlePublish}
                    disabled={loading}
                    startDecorator={<Megaphone className="size-5 shrink-0" />}
                >
                    Objavi
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
