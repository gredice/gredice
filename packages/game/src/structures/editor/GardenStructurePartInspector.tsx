'use client';

import {
    type GardenStructureCoordinate,
    type GardenStructureDocumentV1,
    type GardenStructureEdgeKind,
    type GardenStructureKitReferenceDefinition,
    type GardenStructureRotation,
    gardenStructureCellKey,
    gardenStructureEdgeKey,
} from '@gredice/js/gardenStructures';
import { cx } from '@gredice/ui/utils';
import { useId, useState } from 'react';
import {
    type GardenStructureCellSide,
    getCanonicalGardenStructureEdge,
} from './gardenStructureDocumentEdits';

const controlClassName =
    'min-h-11 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

const actionClassName =
    'min-h-11 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

const edgeSides: readonly GardenStructureCellSide[] = ['N', 'E', 'S', 'W'];
const edgeKinds: readonly GardenStructureEdgeKind[] = [
    'wall',
    'door',
    'window',
];

const sideLabels: Readonly<Record<GardenStructureCellSide, string>> = {
    N: 'Sjever',
    E: 'Istok',
    S: 'Jug',
    W: 'Zapad',
};

const edgeKindLabels: Readonly<Record<GardenStructureEdgeKind, string>> = {
    wall: 'Zidovi',
    door: 'Vrata',
    window: 'Prozori',
};

function identifierLabel(identifier: string) {
    const suffix = identifier.split('.').at(-1) ?? identifier;
    const label = suffix.replaceAll('-', ' ');
    return `${label.charAt(0).toLocaleUpperCase('hr-HR')}${label.slice(1)}`;
}

function nextRotation(
    rotation: GardenStructureRotation,
): GardenStructureRotation {
    switch (rotation) {
        case 0:
            return 1;
        case 1:
            return 2;
        case 2:
            return 3;
        case 3:
            return 0;
    }
}

export type GardenStructurePartInspectorEdgeSelection = Readonly<{
    kind: GardenStructureEdgeKind;
    partId: string;
}>;

export type GardenStructurePartInspectorRoofSelection = Readonly<{
    materialId: string;
    rotation: GardenStructureRotation;
    styleId: string;
}>;

export type GardenStructurePartInspectorPropSelection = Readonly<{
    partId: string;
    rotation: GardenStructureRotation;
    variantId?: string;
}>;

export type GardenStructurePartInspectorProps = Readonly<{
    disabled?: boolean;
    document: GardenStructureDocumentV1;
    error?: string | null;
    kit: GardenStructureKitReferenceDefinition;
    loading?: boolean;
    onAddProp: (
        cell: GardenStructureCoordinate,
        selection: GardenStructurePartInspectorPropSelection,
    ) => void;
    onDeleteProp: (propId: string) => void;
    onDuplicateProp: (propId: string) => void;
    onMoveProp: (propId: string) => void;
    onRemoveEdgePart: (
        cell: GardenStructureCoordinate,
        side: GardenStructureCellSide,
    ) => void;
    onRemoveFloorMaterial: (cell: GardenStructureCoordinate) => void;
    onRemoveRoofCoverage: (cell: GardenStructureCoordinate) => void;
    onRotateProp: (propId: string, rotation: GardenStructureRotation) => void;
    onSetEdgePart: (
        cell: GardenStructureCoordinate,
        side: GardenStructureCellSide,
        selection: GardenStructurePartInspectorEdgeSelection,
    ) => void;
    onSetFloorMaterial: (
        cell: GardenStructureCoordinate,
        materialId: string,
    ) => void;
    onSetRoofCoverage: (
        cell: GardenStructureCoordinate,
        selection: GardenStructurePartInspectorRoofSelection,
    ) => void;
    selectedCellKey: string | null;
}>;

export function GardenStructurePartInspector({
    disabled = false,
    document,
    error,
    kit,
    loading = false,
    onAddProp,
    onDeleteProp,
    onDuplicateProp,
    onMoveProp,
    onRemoveEdgePart,
    onRemoveFloorMaterial,
    onRemoveRoofCoverage,
    onRotateProp,
    onSetEdgePart,
    onSetFloorMaterial,
    onSetRoofCoverage,
    selectedCellKey,
}: GardenStructurePartInspectorProps) {
    const baseId = useId();
    const [requestedPropPartId, setRequestedPropPartId] = useState('');
    const [requestedPropVariantId, setRequestedPropVariantId] = useState('');

    const selectedCell = selectedCellKey
        ? document.footprint.cells.find(
              (cell) => gardenStructureCellKey(cell) === selectedCellKey,
          )
        : undefined;
    const selectedCellCoordinate = selectedCell
        ? { x: selectedCell.x, y: selectedCell.y }
        : undefined;
    const floor = selectedCellKey
        ? document.floors.find(
              (candidate) =>
                  gardenStructureCellKey(candidate.cell) === selectedCellKey,
          )
        : undefined;
    const roofRegion = selectedCellKey
        ? document.roofRegions.find((candidate) =>
              candidate.cells.some(
                  (cell) => gardenStructureCellKey(cell) === selectedCellKey,
              ),
          )
        : undefined;
    const props = selectedCell
        ? document.props.filter(
              (prop) => prop.x === selectedCell.x && prop.y === selectedCell.y,
          )
        : [];

    const floorMaterialIds = kit.floorMaterialIds.toSorted();
    const edgePartEntries = Object.entries(kit.edgeParts).toSorted(
        ([left], [right]) => left.localeCompare(right),
    );
    const roofStyleEntries = Object.entries(kit.roofStyles).toSorted(
        ([left], [right]) => left.localeCompare(right),
    );
    const propPartIds = Object.keys(kit.propVariants).toSorted();
    const propPartId = propPartIds.includes(requestedPropPartId)
        ? requestedPropPartId
        : (propPartIds[0] ?? '');
    const propVariantIds = propPartId
        ? (kit.propVariants[propPartId] ?? [])
        : [];
    const propVariantId = propVariantIds.includes(requestedPropVariantId)
        ? requestedPropVariantId
        : '';

    return (
        <section
            aria-busy={loading}
            aria-label="Dijelovi odabranog polja građevine"
            className="space-y-3"
        >
            <div>
                <h3 className="text-sm font-semibold text-foreground">
                    Dijelovi građevine
                </h3>
                <p className="text-xs text-muted-foreground">
                    {selectedCell
                        ? `Polje ${selectedCell.x.toString()}, ${selectedCell.y.toString()}`
                        : 'Odaberite polje tlocrta'}
                </p>
            </div>

            {loading ? (
                <div
                    className="space-y-2 rounded-xl border border-border/60 p-3"
                    role="status"
                >
                    <span className="sr-only">
                        Učitavanje dijelova građevine
                    </span>
                    <div className="h-11 animate-pulse rounded-lg bg-muted" />
                    <div className="h-11 animate-pulse rounded-lg bg-muted" />
                    <div className="h-11 animate-pulse rounded-lg bg-muted" />
                </div>
            ) : selectedCell && selectedCellCoordinate ? (
                <div className="space-y-3">
                    <fieldset
                        className="space-y-2 rounded-xl border border-border/60 p-3"
                        disabled={disabled}
                    >
                        <legend className="px-1 text-xs font-semibold text-muted-foreground">
                            Pod
                        </legend>
                        <label
                            className="block text-xs font-medium text-foreground"
                            htmlFor={`${baseId}-floor`}
                        >
                            Materijal poda
                        </label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <select
                                className={controlClassName}
                                id={`${baseId}-floor`}
                                onChange={(event) => {
                                    const materialId =
                                        event.currentTarget.value;
                                    if (materialId) {
                                        onSetFloorMaterial(
                                            selectedCellCoordinate,
                                            materialId,
                                        );
                                    }
                                }}
                                value={floor?.materialId ?? ''}
                            >
                                <option disabled value="">
                                    Odaberite materijal
                                </option>
                                {floorMaterialIds.map((materialId) => (
                                    <option key={materialId} value={materialId}>
                                        {identifierLabel(materialId)}
                                    </option>
                                ))}
                            </select>
                            <button
                                className={cx(
                                    actionClassName,
                                    'border-destructive/60 text-destructive',
                                )}
                                disabled={!floor}
                                onClick={() =>
                                    onRemoveFloorMaterial(
                                        selectedCellCoordinate,
                                    )
                                }
                                type="button"
                            >
                                Ukloni pod
                            </button>
                        </div>
                    </fieldset>

                    <fieldset
                        className="space-y-2 rounded-xl border border-border/60 p-3"
                        disabled={disabled}
                    >
                        <legend className="px-1 text-xs font-semibold text-muted-foreground">
                            Rubovi
                        </legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {edgeSides.map((side) => {
                                const edgeKey = gardenStructureEdgeKey(
                                    getCanonicalGardenStructureEdge(
                                        selectedCellCoordinate,
                                        side,
                                    ),
                                );
                                const edge = document.edges.find(
                                    (candidate) =>
                                        gardenStructureEdgeKey(candidate) ===
                                        edgeKey,
                                );
                                return (
                                    <label
                                        className="space-y-1 text-xs font-medium text-foreground"
                                        key={side}
                                        htmlFor={`${baseId}-edge-${side}`}
                                    >
                                        <span>{sideLabels[side]}</span>
                                        <select
                                            aria-label={`${sideLabels[side]} rub polja`}
                                            className={controlClassName}
                                            id={`${baseId}-edge-${side}`}
                                            onChange={(event) => {
                                                const partId =
                                                    event.currentTarget.value;
                                                if (!partId) {
                                                    if (edge) {
                                                        onRemoveEdgePart(
                                                            selectedCellCoordinate,
                                                            side,
                                                        );
                                                    }
                                                    return;
                                                }
                                                const kind =
                                                    kit.edgeParts[partId];
                                                if (kind) {
                                                    onSetEdgePart(
                                                        selectedCellCoordinate,
                                                        side,
                                                        { kind, partId },
                                                    );
                                                }
                                            }}
                                            value={edge?.partId ?? ''}
                                        >
                                            <option value="">Otvoreno</option>
                                            {edgeKinds.map((kind) => {
                                                const choices =
                                                    edgePartEntries.filter(
                                                        ([, candidateKind]) =>
                                                            candidateKind ===
                                                            kind,
                                                    );
                                                return choices.length > 0 ? (
                                                    <optgroup
                                                        key={kind}
                                                        label={
                                                            edgeKindLabels[kind]
                                                        }
                                                    >
                                                        {choices.map(
                                                            ([partId]) => (
                                                                <option
                                                                    key={partId}
                                                                    value={
                                                                        partId
                                                                    }
                                                                >
                                                                    {identifierLabel(
                                                                        partId,
                                                                    )}
                                                                </option>
                                                            ),
                                                        )}
                                                    </optgroup>
                                                ) : null;
                                            })}
                                        </select>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <fieldset
                        className="space-y-2 rounded-xl border border-border/60 p-3"
                        disabled={disabled}
                    >
                        <legend className="px-1 text-xs font-semibold text-muted-foreground">
                            Krov
                        </legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label
                                className="space-y-1 text-xs font-medium text-foreground"
                                htmlFor={`${baseId}-roof-style`}
                            >
                                <span>Stil krova</span>
                                <select
                                    className={controlClassName}
                                    id={`${baseId}-roof-style`}
                                    onChange={(event) => {
                                        const styleId =
                                            event.currentTarget.value;
                                        const materialIds =
                                            kit.roofStyles[styleId] ?? [];
                                        const materialId =
                                            roofRegion?.styleId === styleId &&
                                            materialIds.includes(
                                                roofRegion.materialId,
                                            )
                                                ? roofRegion.materialId
                                                : materialIds[0];
                                        if (styleId && materialId) {
                                            onSetRoofCoverage(
                                                selectedCellCoordinate,
                                                {
                                                    styleId,
                                                    materialId,
                                                    rotation:
                                                        roofRegion?.rotation ??
                                                        0,
                                                },
                                            );
                                        }
                                    }}
                                    value={roofRegion?.styleId ?? ''}
                                >
                                    <option disabled value="">
                                        Odaberite stil
                                    </option>
                                    {roofStyleEntries.map(
                                        ([styleId, materialIds]) => (
                                            <option
                                                disabled={
                                                    materialIds.length === 0
                                                }
                                                key={styleId}
                                                value={styleId}
                                            >
                                                {identifierLabel(styleId)}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </label>
                            <label
                                className="space-y-1 text-xs font-medium text-foreground"
                                htmlFor={`${baseId}-roof-material`}
                            >
                                <span>Materijal krova</span>
                                <select
                                    className={controlClassName}
                                    disabled={!roofRegion}
                                    id={`${baseId}-roof-material`}
                                    onChange={(event) => {
                                        const materialId =
                                            event.currentTarget.value;
                                        if (roofRegion && materialId) {
                                            onSetRoofCoverage(
                                                selectedCellCoordinate,
                                                {
                                                    styleId: roofRegion.styleId,
                                                    materialId,
                                                    rotation:
                                                        roofRegion.rotation,
                                                },
                                            );
                                        }
                                    }}
                                    value={roofRegion?.materialId ?? ''}
                                >
                                    <option disabled value="">
                                        Odaberite materijal
                                    </option>
                                    {(roofRegion
                                        ? (kit.roofStyles[roofRegion.styleId] ??
                                          [])
                                        : []
                                    ).map((materialId) => (
                                        <option
                                            key={materialId}
                                            value={materialId}
                                        >
                                            {identifierLabel(materialId)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <button
                            className={cx(
                                actionClassName,
                                'w-full border-destructive/60 text-destructive',
                            )}
                            disabled={!roofRegion}
                            onClick={() =>
                                onRemoveRoofCoverage(selectedCellCoordinate)
                            }
                            type="button"
                        >
                            Ukloni krov s polja
                        </button>
                    </fieldset>

                    <fieldset
                        className="space-y-3 rounded-xl border border-border/60 p-3"
                        disabled={disabled}
                    >
                        <legend className="px-1 text-xs font-semibold text-muted-foreground">
                            Namještaj i predmeti
                        </legend>

                        <div className="space-y-2">
                            <label
                                className="block text-xs font-medium text-foreground"
                                htmlFor={`${baseId}-prop-part`}
                            >
                                Predmet
                            </label>
                            <select
                                className={controlClassName}
                                id={`${baseId}-prop-part`}
                                onChange={(event) => {
                                    setRequestedPropPartId(
                                        event.currentTarget.value,
                                    );
                                    setRequestedPropVariantId('');
                                }}
                                value={propPartId}
                            >
                                {propPartIds.length > 0 ? null : (
                                    <option value="">
                                        Nema dostupnih predmeta
                                    </option>
                                )}
                                {propPartIds.map((partId) => (
                                    <option key={partId} value={partId}>
                                        {identifierLabel(partId)}
                                    </option>
                                ))}
                            </select>
                            {propVariantIds.length > 0 ? (
                                <label
                                    className="block space-y-1 text-xs font-medium text-foreground"
                                    htmlFor={`${baseId}-prop-variant`}
                                >
                                    <span>Varijanta</span>
                                    <select
                                        className={controlClassName}
                                        id={`${baseId}-prop-variant`}
                                        onChange={(event) =>
                                            setRequestedPropVariantId(
                                                event.currentTarget.value,
                                            )
                                        }
                                        value={propVariantId}
                                    >
                                        <option value="">Bez varijante</option>
                                        {propVariantIds.map((variantId) => (
                                            <option
                                                key={variantId}
                                                value={variantId}
                                            >
                                                {identifierLabel(variantId)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                            <button
                                className={cx(actionClassName, 'w-full')}
                                disabled={!propPartId || props.length > 0}
                                onClick={() =>
                                    onAddProp(selectedCellCoordinate, {
                                        partId: propPartId,
                                        rotation: 0,
                                        ...(propVariantId
                                            ? { variantId: propVariantId }
                                            : {}),
                                    })
                                }
                                type="button"
                            >
                                Dodaj predmet
                            </button>
                        </div>

                        {props.length > 0 ? (
                            <ul className="space-y-2">
                                {props.map((prop) => (
                                    <li
                                        className="space-y-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
                                        key={prop.id}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {identifierLabel(prop.partId)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Zakret: {prop.rotation * 90}°
                                                {prop.variantId
                                                    ? ` · ${identifierLabel(prop.variantId)}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                aria-label={`Premjesti ${identifierLabel(prop.partId)}`}
                                                className={actionClassName}
                                                onClick={() =>
                                                    onMoveProp(prop.id)
                                                }
                                                type="button"
                                            >
                                                Premjesti
                                            </button>
                                            <button
                                                aria-label={`Zakreni ${identifierLabel(prop.partId)} za 90 stupnjeva`}
                                                className={actionClassName}
                                                onClick={() =>
                                                    onRotateProp(
                                                        prop.id,
                                                        nextRotation(
                                                            prop.rotation,
                                                        ),
                                                    )
                                                }
                                                type="button"
                                            >
                                                Zakreni
                                            </button>
                                            <button
                                                aria-label={`Dupliciraj ${identifierLabel(prop.partId)}`}
                                                className={actionClassName}
                                                onClick={() =>
                                                    onDuplicateProp(prop.id)
                                                }
                                                type="button"
                                            >
                                                Dupliciraj
                                            </button>
                                            <button
                                                aria-label={`Ukloni ${identifierLabel(prop.partId)}`}
                                                className={cx(
                                                    actionClassName,
                                                    'border-destructive/60 text-destructive',
                                                )}
                                                onClick={() =>
                                                    onDeleteProp(prop.id)
                                                }
                                                type="button"
                                            >
                                                Ukloni
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p
                                className="text-sm text-muted-foreground"
                                role="status"
                            >
                                Na ovom polju nema predmeta.
                            </p>
                        )}
                    </fieldset>
                </div>
            ) : (
                <p
                    className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"
                    role="status"
                >
                    Odaberite polje tlocrta za uređivanje poda, rubova, krova i
                    predmeta.
                </p>
            )}

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
