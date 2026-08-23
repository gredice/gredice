'use client';

import { ADVANCED_SOWING_PLANT_OPERATION_TARGET_MESSAGE } from './operationScope';
import {
    type OperationTargetRaisedBed,
    RaisedBedTargetGroup,
} from './RaisedBedTargetGroup';

export type TargetSelectionMode = 'farm' | 'garden' | 'raisedBed' | 'plant';

export type TargetsSelectionListProps = {
    name?: string;
    className?: string;
    farms: Array<{
        id: number;
        name: string;
    }>;
    gardens: Array<{
        id: number;
        name?: string | null;
        accountId?: string | null;
    }>;
    raisedBeds: OperationTargetRaisedBed[];
    /**
     * Controls which targets are visible and which are selectable based on the selected operation.
     * - 'farm': show only farms (selectable), hide gardens, raised beds and fields
     * - 'garden': show only gardens (selectable), hide raised beds and fields
     * - 'raisedBed': show gardens and raised beds (selectable), hide fields
     * - 'plant': show full hierarchy, but only fields are selectable
     * - undefined: default behavior (all levels visible and selectable)
     */
    mode?: TargetSelectionMode;
    selectionType?: 'multiple' | 'single';
    selectedValue?: string | null;
    onSelectedValueChange?: (value: string | null) => void;
};

export function TargetsSelectionList({
    name = 'targets',
    className,
    farms,
    gardens,
    raisedBeds,
    mode,
    selectionType = 'multiple',
    selectedValue,
    onSelectedValueChange,
}: TargetsSelectionListProps) {
    // Only show gardens that have raised beds with physicalId
    const visibleGardens = gardens.filter((garden) =>
        raisedBeds.some((rb) => rb.gardenId === garden.id && rb.physicalId),
    );

    // Visibility and selectability derived from mode
    const showFarms = mode === undefined || mode === 'farm';
    const showGardens = mode !== 'farm';
    const showRaisedBeds = mode !== 'farm' && mode !== 'garden';
    const selectableFarm = mode === undefined || mode === 'farm';
    const selectableGarden = mode === undefined || mode === 'garden';

    const baseClass = 'max-h-64 overflow-y-auto border rounded p-2 space-y-2';
    const inputType = selectionType === 'single' ? 'radio' : 'checkbox';
    return (
        <div className="space-y-2">
            {mode === 'plant' &&
            raisedBeds.some((raisedBed) =>
                raisedBed.fields.some(
                    (field) => field.hasActiveSelectedPlanting,
                ),
            ) ? (
                <p className="text-sm text-muted-foreground">
                    {ADVANCED_SOWING_PLANT_OPERATION_TARGET_MESSAGE}
                </p>
            ) : null}
            <div
                className={className ? `${baseClass} ${className}` : baseClass}
            >
                {showFarms &&
                    farms.map((farm) => (
                        <label
                            key={farm.id}
                            className="font-semibold flex items-center gap-2"
                        >
                            <input
                                type={inputType}
                                name={name}
                                disabled={!selectableFarm}
                                value={`farm|${farm.id}`}
                                checked={
                                    selectionType === 'single'
                                        ? selectedValue === `farm|${farm.id}`
                                        : undefined
                                }
                                onChange={(event) => {
                                    if (selectionType === 'single') {
                                        onSelectedValueChange?.(
                                            event.target.checked
                                                ? event.target.value
                                                : null,
                                        );
                                    }
                                }}
                            />
                            {farm.name || `Farma ${farm.id}`}
                        </label>
                    ))}
                {showGardens &&
                    visibleGardens.map((garden) => {
                        const gardenRaisedBeds = raisedBeds.filter(
                            (rb) => rb.gardenId === garden.id && rb.physicalId,
                        );
                        return (
                            <div key={garden.id} className="space-y-1">
                                {/* Garden row */}
                                {selectableGarden ? (
                                    <label className="font-semibold flex items-center gap-2">
                                        <input
                                            type={inputType}
                                            name={name}
                                            value={`${garden.accountId}|${garden.id}`}
                                            checked={
                                                selectionType === 'single'
                                                    ? selectedValue ===
                                                      `${garden.accountId}|${garden.id}`
                                                    : undefined
                                            }
                                            onChange={(event) => {
                                                if (
                                                    selectionType === 'single'
                                                ) {
                                                    onSelectedValueChange?.(
                                                        event.target.checked
                                                            ? event.target.value
                                                            : null,
                                                    );
                                                }
                                            }}
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
                                        {gardenRaisedBeds.map((raisedBed) => (
                                            <RaisedBedTargetGroup
                                                key={`${mode ?? 'all'}-${raisedBed.id}`}
                                                name={name}
                                                raisedBed={raisedBed}
                                                mode={mode}
                                                selectionType={selectionType}
                                                selectedValue={selectedValue}
                                                onSelectedValueChange={
                                                    onSelectedValueChange
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}
