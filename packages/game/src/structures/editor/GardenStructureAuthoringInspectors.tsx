'use client';

import {
    type GardenStructureCoordinate,
    type GardenStructureDocumentV1,
    type GardenStructureFootprintCell,
    type GardenStructureKitReferenceDefinition,
    type GardenStructureSpaceKind,
    gardenStructureCellKey,
} from '@gredice/js/gardenStructures';
import type { GardenStructureBuildCategory } from '../../useGameState';
import { GardenStructureFootprintInspector } from './GardenStructureFootprintInspector';
import {
    GardenStructurePartInspector,
    type GardenStructurePartInspectorProps,
} from './GardenStructurePartInspector';
import type { GardenStructurePropTargetAction } from './gardenStructureAuthoring';

const selectClassName =
    'min-h-11 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

type PartCallbacks = Pick<
    GardenStructurePartInspectorProps,
    | 'onAddProp'
    | 'onDeleteProp'
    | 'onDuplicateProp'
    | 'onMoveProp'
    | 'onRemoveEdgePart'
    | 'onRemoveFloorMaterial'
    | 'onRemoveRoofCoverage'
    | 'onReplaceProp'
    | 'onRotateProp'
    | 'onSetEdgePart'
    | 'onSetFloorMaterial'
    | 'onSetRoofCoverage'
>;

export type GardenStructureAuthoringInspectorsProps = Readonly<{
    addSpaceKind: GardenStructureSpaceKind;
    category: GardenStructureBuildCategory;
    disabled?: boolean;
    document: GardenStructureDocumentV1;
    error?: string | null;
    kit: GardenStructureKitReferenceDefinition | undefined;
    onAddCell: (cell: GardenStructureFootprintCell) => void;
    onAddSpaceKindChange: (spaceKind: GardenStructureSpaceKind) => void;
    onCancelPropTarget: () => void;
    onRemoveCell: (cell: GardenStructureCoordinate) => void;
    onSelectedCellKeyChange: (cellKey: string) => void;
    onSetSpaceKind: (
        cell: GardenStructureCoordinate,
        spaceKind: GardenStructureSpaceKind,
    ) => void;
    propTargetAction: GardenStructurePropTargetAction | null;
    selectedCellKey: string | null;
}> &
    PartCallbacks;

export function GardenStructureAuthoringInspectors({
    addSpaceKind,
    category,
    disabled = false,
    document,
    error,
    kit,
    onAddCell,
    onAddProp,
    onAddSpaceKindChange,
    onCancelPropTarget,
    onDeleteProp,
    onDuplicateProp,
    onMoveProp,
    onRemoveCell,
    onRemoveEdgePart,
    onRemoveFloorMaterial,
    onRemoveRoofCoverage,
    onReplaceProp,
    onRotateProp,
    onSelectedCellKeyChange,
    onSetEdgePart,
    onSetFloorMaterial,
    onSetRoofCoverage,
    onSetSpaceKind,
    propTargetAction,
    selectedCellKey,
}: GardenStructureAuthoringInspectorsProps) {
    if (category === 'footprint') {
        return (
            <GardenStructureFootprintInspector
                addSpaceKind={addSpaceKind}
                disabled={disabled}
                document={document}
                error={error}
                onAddCell={onAddCell}
                onAddSpaceKindChange={onAddSpaceKindChange}
                onRemoveCell={onRemoveCell}
                onSelectedCellKeyChange={onSelectedCellKeyChange}
                onSetSpaceKind={onSetSpaceKind}
                selectedCellKey={selectedCellKey}
            />
        );
    }

    const sortedCells = document.footprint.cells.toSorted(
        (left, right) => left.y - right.y || left.x - right.x,
    );

    return (
        <div
            className="space-y-3"
            data-testid="garden-structure-authoring-inspectors"
        >
            {propTargetAction ? (
                <div
                    className="rounded-xl border border-amber-600/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50"
                    role="status"
                >
                    <p>
                        {propTargetAction.kind === 'move'
                            ? 'Odaberite drugo ciljno polje za premještanje predmeta.'
                            : 'Odaberite prazno ciljno polje za kopiju predmeta.'}
                    </p>
                    <button
                        className="mt-2 min-h-11 rounded-lg border border-current px-3 py-2 text-xs font-semibold"
                        onClick={onCancelPropTarget}
                        type="button"
                    >
                        Odustani od odabira cilja
                    </button>
                </div>
            ) : null}

            <label className="block text-xs font-semibold text-muted-foreground">
                Odabrano polje
                <select
                    className={`${selectClassName} mt-1`}
                    disabled={disabled}
                    onChange={(event) =>
                        onSelectedCellKeyChange(event.currentTarget.value)
                    }
                    value={selectedCellKey ?? ''}
                >
                    <option value="">Odaberite polje</option>
                    {sortedCells.map((cell) => {
                        const key = gardenStructureCellKey(cell);
                        return (
                            <option key={key} value={key}>
                                Polje {cell.x}, {cell.y}
                            </option>
                        );
                    })}
                </select>
            </label>

            {kit ? (
                <GardenStructurePartInspector
                    disabled={disabled}
                    document={document}
                    error={error}
                    kit={kit}
                    onAddProp={onAddProp}
                    onDeleteProp={onDeleteProp}
                    onDuplicateProp={onDuplicateProp}
                    onMoveProp={onMoveProp}
                    onRemoveEdgePart={onRemoveEdgePart}
                    onRemoveFloorMaterial={onRemoveFloorMaterial}
                    onRemoveRoofCoverage={onRemoveRoofCoverage}
                    onReplaceProp={onReplaceProp}
                    onRotateProp={onRotateProp}
                    onSetEdgePart={onSetEdgePart}
                    onSetFloorMaterial={onSetFloorMaterial}
                    onSetRoofCoverage={onSetRoofCoverage}
                    section={category}
                    selectedCellKey={selectedCellKey}
                />
            ) : (
                <p
                    className="rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground"
                    role="alert"
                >
                    Ova verzija građevinskog kompleta nije dostupna.
                </p>
            )}
        </div>
    );
}
