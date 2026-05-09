'use client';

import { RaisedBedLabel } from '@gredice/ui/raisedBeds';

export type TargetsSelectionListProps = {
    name?: string;
    className?: string;
    gardens: Array<{
        id: number;
        name?: string | null;
        accountId?: string | null;
    }>;
    raisedBeds: Array<{
        id: number;
        name?: string | null;
        physicalId?: string | null;
        accountId?: string | null;
        gardenId?: number | null;
        fields: Array<{ id: number; positionIndex: number }>;
    }>;
    /**
     * Controls which targets are visible and which are selectable based on the selected operation.
     * - 'garden': show only gardens (selectable), hide raised beds and fields
     * - 'raisedBed': show gardens and raised beds (selectable), hide fields
     * - 'plant': show full hierarchy, but only fields are selectable
     * - undefined: default behavior (all levels visible and selectable)
     */
    mode?: 'garden' | 'raisedBed' | 'plant';
};

export function TargetsSelectionList({
    name = 'targets',
    className,
    gardens,
    raisedBeds,
    mode,
}: TargetsSelectionListProps) {
    // Only show gardens that have raised beds with physicalId
    const visibleGardens = gardens.filter((garden) =>
        raisedBeds.some((rb) => rb.gardenId === garden.id && rb.physicalId),
    );

    // Visibility and selectability derived from mode
    const showRaisedBeds = mode !== 'garden';
    const showFields = mode === undefined || mode === 'plant';
    const selectableGarden = mode === undefined || mode === 'garden';
    const selectableRaisedBed = mode === undefined || mode === 'raisedBed';
    const selectableField = mode === undefined || mode === 'plant';

    const baseClass = 'max-h-64 overflow-y-auto border rounded p-2 space-y-2';
    return (
        <div className={className ? `${baseClass} ${className}` : baseClass}>
            {visibleGardens.map((garden) => {
                const gardenRaisedBeds = raisedBeds.filter(
                    (rb) => rb.gardenId === garden.id && rb.physicalId,
                );
                return (
                    <div key={garden.id} className="space-y-1">
                        {/* Garden row */}
                        {selectableGarden ? (
                            <label className="font-semibold flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name={name}
                                    value={`${garden.accountId}|${garden.id}`}
                                />
                                {garden.name || `Vrt ${garden.id}`}
                            </label>
                        ) : (
                            // Non-selectable garden label for context
                            <div className="font-semibold opacity-75">
                                {garden.name || `Vrt ${garden.id}`}
                            </div>
                        )}

                        {/* Raised beds section (hidden for garden-only mode) */}
                        {showRaisedBeds && (
                            <div className="ml-4 space-y-1">
                                {gardenRaisedBeds.map((rb) => (
                                    <div key={rb.id} className="space-y-1">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                name={name}
                                                disabled={!selectableRaisedBed}
                                                value={`${rb.accountId}|${rb.gardenId ?? ''}|${rb.id}`}
                                            />
                                            {rb.physicalId ? (
                                                <RaisedBedLabel
                                                    physicalId={rb.physicalId}
                                                />
                                            ) : (
                                                rb.name
                                            )}
                                        </label>
                                        {/* Fields (only visible for plant mode or default) */}
                                        {showFields && (
                                            <div className="ml-4 space-y-1">
                                                {rb.fields.map((field) => (
                                                    <label
                                                        key={field.id}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            name={name}
                                                            disabled={
                                                                !selectableField
                                                            }
                                                            value={`${rb.accountId}|${rb.gardenId ?? ''}|${rb.id}|${field.id}`}
                                                        />
                                                        {`Polje ${
                                                            field.positionIndex +
                                                            1
                                                        }`}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
