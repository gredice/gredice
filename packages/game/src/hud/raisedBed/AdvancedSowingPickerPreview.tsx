'use client';

import {
    ADVANCED_SOWING_BED_COLUMN_COUNT,
    type AdvancedSowingLayoutKey,
} from '@gredice/js/plants';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useId } from 'react';
import {
    type AdvancedSowingPickerPreview as AdvancedSowingPickerPreviewModel,
    getSelectedAdvancedSowingPickerOption,
} from './advancedSowingPicker';

function plantCountLabel(count: number) {
    const modulo100 = count % 100;
    const modulo10 = count % 10;
    const noun =
        modulo100 >= 11 && modulo100 <= 14
            ? 'biljaka'
            : modulo10 === 1
              ? 'biljka'
              : modulo10 >= 2 && modulo10 <= 4
                ? 'biljke'
                : 'biljaka';
    return `${count.toString()} ${noun}`;
}

function footprintLabel(rows: number, columns: number) {
    return rows === 1 && columns === 1
        ? '1 polje'
        : `${rows.toString()} × ${columns.toString()} polja`;
}

export function AdvancedSowingPickerPreview({
    bedFieldCount,
    noticeId,
    onLayoutChange,
    preview,
    selectedLayoutKey,
    unavailableLayoutKeys = new Set(),
}: {
    bedFieldCount: number;
    noticeId: string;
    onLayoutChange: (layoutKey: AdvancedSowingLayoutKey) => void;
    preview: Exclude<
        AdvancedSowingPickerPreviewModel,
        { status: 'unsupported' }
    >;
    selectedLayoutKey: string | null;
    unavailableLayoutKeys?: ReadonlySet<string>;
}) {
    const layoutInputName = useId();

    if (preview.status === 'invalid') {
        return (
            <div
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                data-advanced-sowing-preview
                id={noticeId}
            >
                <Typography level="body2" semiBold>
                    Razmak i gustoća nisu dostupni
                </Typography>
                <Typography level="body3">
                    Podaci o razmaku ove biljke nisu ispravni. Sjetvu nije
                    moguće potvrditi dok se podaci ne isprave.
                </Typography>
            </div>
        );
    }

    const selectedOption = getSelectedAdvancedSowingPickerOption(
        preview,
        selectedLayoutKey,
        unavailableLayoutKeys,
    );
    const selectedMultiFieldOption =
        selectedOption?.plan &&
        (selectedOption.layout.fieldSpanRows > 1 ||
            selectedOption.layout.fieldSpanColumns > 1)
            ? { layout: selectedOption.layout, plan: selectedOption.plan }
            : null;
    const occupiedPositions = new Set(
        selectedOption?.plan?.occupiedPositionIndices ?? [],
    );
    const visualPositionIndices = Array.from(
        { length: bedFieldCount },
        (_, visualIndex) => bedFieldCount - 1 - visualIndex,
    );

    return (
        <div
            className="space-y-3 rounded-lg border border-green-300 bg-green-50/70 p-3 dark:border-green-900 dark:bg-green-950/30"
            data-advanced-sowing-preview
        >
            <div>
                <Typography level="body2" semiBold>
                    Razmak i gustoća
                </Typography>
                <Typography level="body3" secondary>
                    Odaberi razmak i raspored koji želiš koristiti.
                </Typography>
            </div>

            <fieldset className="space-y-2">
                <legend className="sr-only">Odaberi razmak i gustoću</legend>
                {preview.options.map(({ layout, plan }) => {
                    const unavailable = unavailableLayoutKeys.has(
                        layout.layoutKey,
                    );
                    const selected =
                        selectedOption?.layout.layoutKey === layout.layoutKey;
                    const countLabel = plantCountLabel(layout.plantCount);
                    const distanceLabel = `${layout.selectedDistanceCm.toLocaleString('hr-HR')} cm`;
                    const label = `${countLabel} · ${distanceLabel} · ${footprintLabel(layout.fieldSpanRows, layout.fieldSpanColumns)}`;

                    return (
                        <label
                            key={layout.layoutKey}
                            className={cx(
                                'flex cursor-pointer items-center gap-2 rounded-md border bg-card p-2 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                                selected
                                    ? 'border-green-600 text-green-950 dark:border-green-700 dark:text-green-100'
                                    : 'border-input hover:bg-muted',
                                (!plan || unavailable) &&
                                    'cursor-not-allowed opacity-60',
                            )}
                        >
                            <input
                                aria-label={`${label}${layout.isDefault ? ' (preporučeno)' : ''}`}
                                checked={selected}
                                disabled={!plan || unavailable}
                                name={layoutInputName}
                                onChange={() =>
                                    onLayoutChange(layout.layoutKey)
                                }
                                type="radio"
                            />
                            <PlantGridIcon
                                aria-hidden="true"
                                className="size-7 shrink-0"
                                data-advanced-sowing-density-icon
                                data-plant-count={layout.plantCount}
                                totalPlants={layout.plantCount}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">
                                    {countLabel}
                                    {layout.isDefault ? (
                                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                                            (preporučeno)
                                        </span>
                                    ) : null}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {distanceLabel}
                                    {layout.fieldSpanRows > 1 ||
                                    layout.fieldSpanColumns > 1
                                        ? ` · ${footprintLabel(layout.fieldSpanRows, layout.fieldSpanColumns)}`
                                        : null}
                                </span>
                                {!plan ? (
                                    <span className="block text-xs text-amber-800 dark:text-amber-200">
                                        Raspored ne stane od odabranog polja.
                                    </span>
                                ) : unavailable ? (
                                    <span className="block text-xs text-amber-800 dark:text-amber-200">
                                        Ovaj raspored već zauzima biljka s istim
                                        rasporedom ili biljka bez poznatog
                                        rasporeda.
                                    </span>
                                ) : null}
                            </span>
                        </label>
                    );
                })}
            </fieldset>

            {selectedMultiFieldOption ? (
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                    <div
                        aria-label={`Tlocrt zauzima ${footprintLabel(selectedMultiFieldOption.layout.fieldSpanRows, selectedMultiFieldOption.layout.fieldSpanColumns)}`}
                        className="grid w-16 gap-0.5"
                        data-advanced-sowing-footprint
                        role="img"
                        style={{
                            gridTemplateColumns: `repeat(${ADVANCED_SOWING_BED_COLUMN_COUNT.toString()}, minmax(0, 1fr))`,
                        }}
                    >
                        {visualPositionIndices.map((positionIndex) => (
                            <span
                                key={positionIndex}
                                className={cx(
                                    'aspect-square rounded-[2px] border border-green-300 bg-card dark:border-green-900',
                                    occupiedPositions.has(positionIndex) &&
                                        'border-green-700 bg-green-500 dark:border-green-400 dark:bg-green-700',
                                    selectedMultiFieldOption.plan
                                        .anchorPositionIndex ===
                                        positionIndex &&
                                        'ring-1 ring-green-950',
                                )}
                                data-advanced-sowing-footprint-cell={
                                    positionIndex
                                }
                                data-occupied={
                                    occupiedPositions.has(positionIndex)
                                        ? 'true'
                                        : 'false'
                                }
                            />
                        ))}
                    </div>
                    <Typography level="body3">
                        Ovaj raspored zauzima{' '}
                        {footprintLabel(
                            selectedMultiFieldOption.layout.fieldSpanRows,
                            selectedMultiFieldOption.layout.fieldSpanColumns,
                        )}{' '}
                        i sadrži{' '}
                        {plantCountLabel(
                            selectedMultiFieldOption.layout.plantCount,
                        )}
                        .
                    </Typography>
                </div>
            ) : null}

            <div
                className="rounded-md border border-green-300 bg-green-100/70 p-2 text-xs text-green-950 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100"
                id={noticeId}
            >
                Odabrani razmak i raspored spremit će se uz ovu sjetvu.
            </div>
        </div>
    );
}
