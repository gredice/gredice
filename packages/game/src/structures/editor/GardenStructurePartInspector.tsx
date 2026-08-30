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
import { GardenStructureCatalogPicker } from '../catalog/GardenStructureCatalogPicker';
import {
    gardenStructureKitV1Catalog,
    getGardenStructureKitV1MaterialCatalogEntry,
    getGardenStructureKitV1PartCatalogEntry,
} from '../catalog/gardenStructureKitV1Catalog';
import {
    type GardenStructureCellSide,
    getCanonicalGardenStructureEdge,
} from './gardenStructureDocumentEdits';

const controlClassName =
    'min-h-11 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

const actionClassName =
    'min-h-11 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50';

const edgeSides: readonly GardenStructureCellSide[] = ['N', 'E', 'S', 'W'];
const sideLabels: Readonly<Record<GardenStructureCellSide, string>> = {
    N: 'Sjever',
    E: 'Istok',
    S: 'Jug',
    W: 'Zapad',
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

export type GardenStructurePartInspectorSection =
    | 'all'
    | 'interior'
    | 'roof'
    | 'structure';

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
    onReplaceProp: (
        propId: string,
        selection: GardenStructurePartInspectorPropSelection,
    ) => void;
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
    section?: GardenStructurePartInspectorSection;
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
    onReplaceProp,
    onRotateProp,
    onSetEdgePart,
    onSetFloorMaterial,
    onSetRoofCoverage,
    section = 'all',
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

    const usesVersionOneCatalog =
        kit.kitKey === gardenStructureKitV1Catalog.kitKey &&
        kit.kitVersion === gardenStructureKitV1Catalog.kitVersion;
    const floorMaterialIds = usesVersionOneCatalog
        ? kit.floorMaterialIds.toSorted()
        : [];
    const floorMaterialCatalogEntries = floorMaterialIds
        .map(getGardenStructureKitV1MaterialCatalogEntry)
        .filter((entry) => entry !== undefined);
    const edgePartEntries = usesVersionOneCatalog
        ? Object.entries(kit.edgeParts).toSorted(([left], [right]) =>
              left.localeCompare(right),
          )
        : [];
    const edgePartCatalogEntries = edgePartEntries
        .map(([partId]) => getGardenStructureKitV1PartCatalogEntry(partId))
        .filter((entry) => entry !== undefined);
    const roofStyleEntries = usesVersionOneCatalog
        ? Object.entries(kit.roofStyles).toSorted(([left], [right]) =>
              left.localeCompare(right),
          )
        : [];
    const roofStyleCatalogEntries = roofStyleEntries
        .filter(([, materialIds]) => materialIds.length > 0)
        .map(([styleId]) => getGardenStructureKitV1PartCatalogEntry(styleId))
        .filter((entry) => entry !== undefined);
    const roofMaterialCatalogEntries = (
        usesVersionOneCatalog && roofRegion
            ? (kit.roofStyles[roofRegion.styleId] ?? [])
            : []
    )
        .map(getGardenStructureKitV1MaterialCatalogEntry)
        .filter((entry) => entry !== undefined);
    const propPartIds = usesVersionOneCatalog
        ? Object.keys(kit.propVariants).toSorted()
        : [];
    const propPartCatalogEntries = propPartIds
        .map(getGardenStructureKitV1PartCatalogEntry)
        .filter((entry) => entry !== undefined);
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
                    {section === 'all' || section === 'structure' ? (
                        <>
                            <fieldset
                                className="space-y-2 rounded-xl border border-border/60 p-3"
                                disabled={disabled}
                            >
                                <legend className="px-1 text-xs font-semibold text-muted-foreground">
                                    Pod
                                </legend>
                                <p className="text-xs font-medium text-foreground">
                                    Materijal poda
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                    <GardenStructureCatalogPicker
                                        ariaLabel="Materijal poda"
                                        entries={floorMaterialCatalogEntries}
                                        onSelectionChange={(materialId) => {
                                            if (materialId) {
                                                onSetFloorMaterial(
                                                    selectedCellCoordinate,
                                                    materialId,
                                                );
                                            }
                                        }}
                                        selectedId={floor?.materialId ?? null}
                                    />
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
                                                gardenStructureEdgeKey(
                                                    candidate,
                                                ) === edgeKey,
                                        );
                                        return (
                                            <div
                                                className="min-w-0 space-y-1 text-xs font-medium text-foreground"
                                                key={side}
                                            >
                                                <span>{sideLabels[side]}</span>
                                                <GardenStructureCatalogPicker
                                                    ariaLabel={`${sideLabels[side]} rub polja`}
                                                    emptyLabel="Otvoreno"
                                                    entries={
                                                        edgePartCatalogEntries
                                                    }
                                                    onSelectionChange={(
                                                        partId,
                                                    ) => {
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
                                                            kit.edgeParts[
                                                                partId
                                                            ];
                                                        if (kind) {
                                                            onSetEdgePart(
                                                                selectedCellCoordinate,
                                                                side,
                                                                {
                                                                    kind,
                                                                    partId,
                                                                },
                                                            );
                                                        }
                                                    }}
                                                    selectedId={
                                                        edge?.partId ?? null
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        </>
                    ) : null}

                    {section === 'all' || section === 'roof' ? (
                        <fieldset
                            className="space-y-2 rounded-xl border border-border/60 p-3"
                            disabled={disabled}
                        >
                            <legend className="px-1 text-xs font-semibold text-muted-foreground">
                                Krov
                            </legend>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="min-w-0 space-y-1 text-xs font-medium text-foreground">
                                    <span>Stil krova</span>
                                    <GardenStructureCatalogPicker
                                        ariaLabel="Stil krova"
                                        entries={roofStyleCatalogEntries}
                                        onSelectionChange={(styleId) => {
                                            if (!styleId) {
                                                return;
                                            }
                                            const materialIds =
                                                kit.roofStyles[styleId] ?? [];
                                            const materialId =
                                                roofRegion?.styleId ===
                                                    styleId &&
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
                                        selectedId={roofRegion?.styleId ?? null}
                                    />
                                </div>
                                <div className="min-w-0 space-y-1 text-xs font-medium text-foreground">
                                    <span>Materijal krova</span>
                                    <GardenStructureCatalogPicker
                                        ariaLabel="Materijal krova"
                                        disabled={!roofRegion}
                                        entries={roofMaterialCatalogEntries}
                                        onSelectionChange={(materialId) => {
                                            if (roofRegion && materialId) {
                                                onSetRoofCoverage(
                                                    selectedCellCoordinate,
                                                    {
                                                        styleId:
                                                            roofRegion.styleId,
                                                        materialId,
                                                        rotation:
                                                            roofRegion.rotation,
                                                    },
                                                );
                                            }
                                        }}
                                        selectedId={
                                            roofRegion?.materialId ?? null
                                        }
                                    />
                                </div>
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
                    ) : null}

                    {section === 'all' || section === 'interior' ? (
                        <fieldset
                            className="space-y-3 rounded-xl border border-border/60 p-3"
                            disabled={disabled}
                        >
                            <legend className="px-1 text-xs font-semibold text-muted-foreground">
                                Namještaj i predmeti
                            </legend>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-foreground">
                                    Predmet
                                </p>
                                <GardenStructureCatalogPicker
                                    ariaLabel="Predmet"
                                    entries={propPartCatalogEntries}
                                    onSelectionChange={(partId) => {
                                        setRequestedPropPartId(partId ?? '');
                                        setRequestedPropVariantId('');
                                    }}
                                    selectedId={propPartId || null}
                                />
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
                                            <option value="">
                                                Bez varijante
                                            </option>
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
                                                    {identifierLabel(
                                                        prop.partId,
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Zakret: {prop.rotation * 90}
                                                    °
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
                                                    aria-label={`Zamijeni ${identifierLabel(prop.partId)} odabranim predmetom`}
                                                    className={actionClassName}
                                                    disabled={
                                                        !propPartId ||
                                                        (prop.partId ===
                                                            propPartId &&
                                                            prop.variantId ===
                                                                (propVariantId ||
                                                                    undefined))
                                                    }
                                                    onClick={() =>
                                                        onReplaceProp(prop.id, {
                                                            partId: propPartId,
                                                            rotation:
                                                                prop.rotation,
                                                            ...(propVariantId
                                                                ? {
                                                                      variantId:
                                                                          propVariantId,
                                                                  }
                                                                : {}),
                                                        })
                                                    }
                                                    type="button"
                                                >
                                                    Zamijeni
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
                    ) : null}
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
