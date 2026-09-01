'use client';

import {
    type GardenStructureCoordinate,
    type GardenStructureDocumentV1,
    type GardenStructureFootprintCell,
    type GardenStructureSpaceKind,
    gardenStructureCellKey,
    getGardenStructureFootprintBounds,
} from '@gredice/js/gardenStructures';
import { cx } from '@gredice/ui/utils';
import { useMemo } from 'react';

const cellSizeClassName =
    'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

const segmentClassName =
    'min-h-11 rounded-lg border border-border/70 px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

function spaceKindLabel(spaceKind: GardenStructureSpaceKind) {
    return spaceKind === 'interior' ? 'unutarnje' : 'natkriveno vanjsko';
}

function adjacentCellKeys(cell: GardenStructureCoordinate) {
    return [
        { x: cell.x - 1, y: cell.y },
        { x: cell.x + 1, y: cell.y },
        { x: cell.x, y: cell.y - 1 },
        { x: cell.x, y: cell.y + 1 },
    ].map(gardenStructureCellKey);
}

export type GardenStructureFootprintInspectorProps = Readonly<{
    addSpaceKind: GardenStructureSpaceKind;
    disabled?: boolean;
    document: GardenStructureDocumentV1;
    error?: string | null;
    onAddCell: (cell: GardenStructureFootprintCell) => void;
    onAddSpaceKindChange: (spaceKind: GardenStructureSpaceKind) => void;
    onRemoveCell: (cell: GardenStructureCoordinate) => void;
    onSelectedCellKeyChange: (cellKey: string) => void;
    onSetSpaceKind: (
        cell: GardenStructureCoordinate,
        spaceKind: GardenStructureSpaceKind,
    ) => void;
    selectedCellKey: string | null;
}>;

export function GardenStructureFootprintInspector({
    addSpaceKind,
    disabled = false,
    document,
    error,
    onAddCell,
    onAddSpaceKindChange,
    onRemoveCell,
    onSelectedCellKeyChange,
    onSetSpaceKind,
    selectedCellKey,
}: GardenStructureFootprintInspectorProps) {
    const model = useMemo(() => {
        const cellsByKey = new Map(
            document.footprint.cells.map((cell) => [
                gardenStructureCellKey(cell),
                cell,
            ]),
        );
        const bounds = getGardenStructureFootprintBounds(
            document.footprint.cells,
        );
        if (!bounds) {
            return null;
        }

        const addableKeys = new Set(
            document.footprint.cells.flatMap(adjacentCellKeys),
        );
        for (const key of cellsByKey.keys()) {
            addableKeys.delete(key);
        }

        const minX = bounds.minX - 1;
        const minY = bounds.minY - 1;
        const maxX = bounds.maxX + 1;
        const maxY = bounds.maxY + 1;
        const grid: Array<Readonly<{ x: number; y: number }>> = [];
        for (let y = minY; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                grid.push({ x, y });
            }
        }

        return {
            addableKeys,
            cellsByKey,
            columns: maxX - minX + 1,
            grid,
        };
    }, [document.footprint.cells]);

    const selectedCell = selectedCellKey
        ? model?.cellsByKey.get(selectedCellKey)
        : undefined;

    return (
        <section aria-label="Uređivanje tlocrta" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">
                        Tlocrt
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {document.footprint.cells.length.toLocaleString(
                            'hr-HR',
                        )}{' '}
                        {document.footprint.cells.length === 1
                            ? 'polje'
                            : 'polja'}
                    </p>
                </div>
                <fieldset disabled={disabled}>
                    <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                        Namjena novog polja
                    </legend>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                        {(
                            [
                                ['interior', 'Unutarnje'],
                                ['covered-outdoor', 'Natkriveno'],
                            ] as const
                        ).map(([spaceKind, label]) => (
                            <button
                                type="button"
                                aria-pressed={addSpaceKind === spaceKind}
                                className={cx(
                                    segmentClassName,
                                    addSpaceKind === spaceKind &&
                                        'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50',
                                )}
                                key={spaceKind}
                                onClick={() => onAddSpaceKindChange(spaceKind)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </fieldset>
            </div>

            {model ? (
                <fieldset className="max-h-56 overflow-auto overscroll-contain rounded-xl border border-border/60 bg-muted/30 p-2">
                    <legend className="sr-only">Polja tlocrta</legend>
                    <div
                        className="grid w-max gap-1"
                        style={{
                            gridTemplateColumns: `repeat(${model.columns.toString()}, minmax(2.75rem, 2.75rem))`,
                        }}
                    >
                        {model.grid.map((coordinate) => {
                            const key = gardenStructureCellKey(coordinate);
                            const cell = model.cellsByKey.get(key);
                            if (cell) {
                                const selected = selectedCellKey === key;
                                return (
                                    <button
                                        type="button"
                                        aria-label={`${spaceKindLabel(cell.spaceKind)} polje ${cell.x.toString()}, ${cell.y.toString()}`}
                                        aria-pressed={selected}
                                        className={cx(
                                            cellSizeClassName,
                                            cell.spaceKind === 'interior'
                                                ? 'border-amber-500/70 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50'
                                                : 'border-emerald-500/70 bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
                                            selected &&
                                                'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                                        )}
                                        disabled={disabled}
                                        key={key}
                                        onClick={() =>
                                            onSelectedCellKeyChange(key)
                                        }
                                    >
                                        <span aria-hidden="true">
                                            {cell.spaceKind === 'interior'
                                                ? 'U'
                                                : 'N'}
                                        </span>
                                        <span className="font-normal text-[10px] opacity-75">
                                            {cell.x},{cell.y}
                                        </span>
                                    </button>
                                );
                            }

                            if (model.addableKeys.has(key)) {
                                return (
                                    <button
                                        type="button"
                                        aria-label={`Dodaj ${spaceKindLabel(addSpaceKind)} polje ${coordinate.x.toString()}, ${coordinate.y.toString()}`}
                                        className={cx(
                                            cellSizeClassName,
                                            'border-dashed border-border/80 bg-background/70 text-muted-foreground hover:border-amber-500 hover:text-foreground',
                                        )}
                                        disabled={disabled}
                                        key={key}
                                        onClick={() =>
                                            onAddCell({
                                                ...coordinate,
                                                spaceKind: addSpaceKind,
                                            })
                                        }
                                    >
                                        <span aria-hidden="true">+</span>
                                        <span className="font-normal text-[10px] opacity-75">
                                            {coordinate.x},{coordinate.y}
                                        </span>
                                    </button>
                                );
                            }

                            return (
                                <span
                                    aria-hidden="true"
                                    className="min-h-11 min-w-11"
                                    key={key}
                                />
                            );
                        })}
                    </div>
                </fieldset>
            ) : (
                <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Tlocrt nema polja.
                </p>
            )}

            {selectedCell ? (
                <fieldset
                    className="rounded-xl border border-border/60 p-2"
                    disabled={disabled}
                >
                    <legend className="px-1 text-xs font-semibold text-muted-foreground">
                        Polje {selectedCell.x}, {selectedCell.y}
                    </legend>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        <button
                            type="button"
                            aria-pressed={selectedCell.spaceKind === 'interior'}
                            className={cx(
                                segmentClassName,
                                selectedCell.spaceKind === 'interior' &&
                                    'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50',
                            )}
                            onClick={() =>
                                onSetSpaceKind(selectedCell, 'interior')
                            }
                        >
                            Unutarnje
                        </button>
                        <button
                            type="button"
                            aria-pressed={
                                selectedCell.spaceKind === 'covered-outdoor'
                            }
                            className={cx(
                                segmentClassName,
                                selectedCell.spaceKind === 'covered-outdoor' &&
                                    'border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
                            )}
                            onClick={() =>
                                onSetSpaceKind(selectedCell, 'covered-outdoor')
                            }
                        >
                            Natkriveno
                        </button>
                        <button
                            type="button"
                            className={cx(
                                segmentClassName,
                                'col-span-2 border-destructive/60 text-destructive sm:col-span-1',
                            )}
                            onClick={() => onRemoveCell(selectedCell)}
                        >
                            Ukloni polje
                        </button>
                    </div>
                </fieldset>
            ) : null}

            {error ? (
                <p
                    className="rounded-xl border border-destructive/60 bg-destructive/10 p-2 text-sm text-foreground"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
        </section>
    );
}
