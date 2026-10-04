'use client';

import { SelectItems } from '@gredice/ui/SelectItems';
import { useState } from 'react';

const items = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'done', label: 'Done' },
    { value: 'archived', label: 'Archived' },
    { value: 'cancelled', label: 'Cancelled' },
];

export function DebugSelectItemsClient() {
    const [value, setValue] = useState<string | undefined>(undefined);

    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
            <h1 className="text-xl font-semibold">SelectItems mobile debug</h1>
            <p className="text-sm text-muted-foreground">
                Use this page to manually validate whether SelectItems closes
                immediately on mobile after opening.
            </p>
            <SelectItems
                items={items}
                label="Status"
                onValueChange={setValue}
                placeholder="Select status"
                searchable
                value={value}
            />
            <p className="text-sm" data-testid="selected-value">
                Selected: {value ?? 'none'}
            </p>
        </main>
    );
}
