'use client';

import { cx } from '@gredice/ui/utils';
import { useId } from 'react';
import { GardenStructureCatalogThumbnail } from './GardenStructureCatalogThumbnail';
import type { GardenStructureCatalogEntry } from './gardenStructureKitV1Catalog';

export type GardenStructureCatalogPickerProps = Readonly<{
    ariaLabel: string;
    className?: string;
    disabled?: boolean;
    emptyLabel?: string;
    entries: readonly GardenStructureCatalogEntry[];
    onSelectionChange: (id: string | null) => void;
    selectedId: string | null;
    testId?: string;
}>;

/**
 * Static-image palette with native radio semantics. Radios retain Tab and
 * arrow-key behavior while every label remains a 44px-or-larger touch target.
 */
export function GardenStructureCatalogPicker({
    ariaLabel,
    className,
    disabled = false,
    emptyLabel,
    entries,
    onSelectionChange,
    selectedId,
    testId,
}: GardenStructureCatalogPickerProps) {
    const name = useId();

    return (
        <fieldset
            className={cx('min-w-0', className)}
            data-testid={testId}
            disabled={disabled}
        >
            <legend className="sr-only">{ariaLabel}</legend>
            <div className="grid auto-cols-[5.75rem] grid-flow-col gap-2 overflow-x-auto overscroll-x-contain pb-1">
                {emptyLabel ? (
                    <label className="min-w-0 cursor-pointer">
                        <input
                            checked={selectedId === null}
                            className="peer sr-only"
                            name={name}
                            onChange={() => onSelectionChange(null)}
                            type="radio"
                            value=""
                        />
                        <span className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-border/70 bg-background p-2 text-center text-[0.6875rem] font-medium leading-tight text-foreground transition-colors peer-checked:border-amber-600 peer-checked:bg-amber-100 peer-checked:text-amber-950 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:peer-checked:bg-amber-950 dark:peer-checked:text-amber-50">
                            <span
                                aria-hidden="true"
                                className="grid size-10 place-items-center rounded-md border border-dashed border-border text-base text-muted-foreground"
                            >
                                ×
                            </span>
                            <span className="line-clamp-2">{emptyLabel}</span>
                        </span>
                    </label>
                ) : null}
                {entries.map((entry) => (
                    <label className="min-w-0 cursor-pointer" key={entry.key}>
                        <input
                            checked={selectedId === entry.id}
                            className="peer sr-only"
                            name={name}
                            onChange={() => onSelectionChange(entry.id)}
                            type="radio"
                            value={entry.id}
                        />
                        <span className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-border/70 bg-background p-2 text-center text-[0.6875rem] font-medium leading-tight text-foreground transition-colors peer-checked:border-amber-600 peer-checked:bg-amber-100 peer-checked:text-amber-950 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:peer-checked:bg-amber-950 dark:peer-checked:text-amber-50">
                            <GardenStructureCatalogThumbnail
                                alt=""
                                className={cx(
                                    'object-contain',
                                    entry.kind === 'material'
                                        ? 'size-10 rounded-md'
                                        : 'h-12 w-full',
                                )}
                                entry={entry}
                            />
                            <span className="line-clamp-2">{entry.label}</span>
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
