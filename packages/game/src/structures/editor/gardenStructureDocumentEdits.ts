import type {
    GardenStructureCoordinate,
    GardenStructureDocumentV1,
    GardenStructureEdge,
    GardenStructureEdgeKind,
    GardenStructureReferenceValidator,
    GardenStructureRotation,
    GardenStructureSpaceKind,
    GardenStructureValidationIssue,
} from '@gredice/js/gardenStructures';
import {
    createGardenStructureReferenceValidator,
    gardenStructureCellKey,
    gardenStructureEdgeKey,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxIdentifierLength,
    normalizeGardenStructureDocument,
    validateGardenStructureDocument,
} from '@gredice/js/gardenStructures';

export type GardenStructureDocumentEditKit = Readonly<{
    kitKey: string;
    kitVersion: string;
}>;

export type GardenStructureCellSide = 'N' | 'E' | 'S' | 'W';

export type GardenStructureCanonicalEdge = Readonly<{
    from: GardenStructureCoordinate;
    direction: GardenStructureEdge['direction'];
}>;

export type GardenStructureDocumentEditFailureReason =
    | 'cell-not-found'
    | 'id-exhausted'
    | 'invalid-document'
    | 'invalid-result'
    | 'invalid-target'
    | 'item-not-found'
    | 'limit-exceeded'
    | 'no-change'
    | 'overlap'
    | 'unsupported-kit'
    | 'unsupported-reference';

export type GardenStructureDocumentEditFailure = Readonly<{
    reason: GardenStructureDocumentEditFailureReason;
    message: string;
    issues?: readonly GardenStructureValidationIssue[];
}>;

export type GardenStructureDocumentEditValue = Readonly<{
    document: GardenStructureDocumentV1;
    warnings: readonly GardenStructureValidationIssue[];
    itemId?: string;
}>;

export type GardenStructureDocumentEditResult =
    | Readonly<{ ok: true; value: GardenStructureDocumentEditValue }>
    | Readonly<{ ok: false; error: GardenStructureDocumentEditFailure }>;

type GardenStructureDocumentEditFailureResult = Extract<
    GardenStructureDocumentEditResult,
    { ok: false }
>;

type PreparedDocument = Readonly<{
    document: GardenStructureDocumentV1;
    isReferenceAllowed: GardenStructureReferenceValidator;
}>;

type EditInput = Readonly<{
    document: GardenStructureDocumentV1;
    kit: GardenStructureDocumentEditKit;
}>;

function failure(
    reason: GardenStructureDocumentEditFailureReason,
    message: string,
    issues?: readonly GardenStructureValidationIssue[],
): GardenStructureDocumentEditFailureResult {
    return {
        ok: false,
        error: {
            reason,
            message,
            ...(issues ? { issues } : {}),
        },
    };
}

function prepareDocument({
    document,
    kit,
}: EditInput):
    | Readonly<{ ok: true; value: PreparedDocument }>
    | GardenStructureDocumentEditFailureResult {
    const isReferenceAllowed = createGardenStructureReferenceValidator(
        kit.kitKey,
        kit.kitVersion,
    );
    if (!isReferenceAllowed) {
        return failure(
            'unsupported-kit',
            'The selected structure kit version is unavailable.',
        );
    }

    const validation = validateGardenStructureDocument(document, {
        isReferenceAllowed,
    });
    if (!validation.valid) {
        return failure(
            'invalid-document',
            'The source structure document is invalid.',
            validation.issues,
        );
    }

    return {
        ok: true,
        value: { document: validation.document, isReferenceAllowed },
    };
}

function candidateFailureReason(
    issues: readonly GardenStructureValidationIssue[],
): GardenStructureDocumentEditFailureReason {
    if (issues.some((issue) => issue.code === 'invalid-part-reference')) {
        return 'unsupported-reference';
    }
    if (issues.some((issue) => issue.code === 'too-many-items')) {
        return 'limit-exceeded';
    }
    if (
        issues.some(
            (issue) =>
                issue.code === 'duplicate-edge' ||
                issue.code === 'duplicate-floor' ||
                issue.code === 'duplicate-roof-cell' ||
                issue.code === 'overlapping-prop' ||
                issue.code === 'overlapping-roof-region',
        )
    ) {
        return 'overlap';
    }
    return 'invalid-result';
}

function finishDocument(
    document: GardenStructureDocumentV1,
    isReferenceAllowed: GardenStructureReferenceValidator,
    itemId?: string,
): GardenStructureDocumentEditResult {
    const validation = validateGardenStructureDocument(document, {
        isReferenceAllowed,
    });
    if (!validation.valid) {
        return failure(
            candidateFailureReason(validation.issues),
            'The requested edit would create an invalid structure document.',
            validation.issues,
        );
    }

    return {
        ok: true,
        value: {
            document: normalizeGardenStructureDocument(validation.document),
            warnings: validation.warnings,
            ...(itemId ? { itemId } : {}),
        },
    };
}

function isValidCoordinate(coordinate: GardenStructureCoordinate) {
    return (
        Number.isSafeInteger(coordinate.x) &&
        Number.isSafeInteger(coordinate.y) &&
        Math.abs(coordinate.x) <= gardenStructureMaxCoordinateMagnitude &&
        Math.abs(coordinate.y) <= gardenStructureMaxCoordinateMagnitude
    );
}

function validateSelectedCell(
    document: GardenStructureDocumentV1,
    cell: GardenStructureCoordinate,
): GardenStructureDocumentEditFailureResult | null {
    if (!isValidCoordinate(cell)) {
        return failure(
            'invalid-target',
            'The selected cell must use bounded integer coordinates.',
        );
    }

    const key = gardenStructureCellKey(cell);
    if (
        !document.footprint.cells.some(
            (candidate) => gardenStructureCellKey(candidate) === key,
        )
    ) {
        return failure(
            'cell-not-found',
            'The selected cell is outside the structure footprint.',
        );
    }

    return null;
}

function nextUniqueIdentifier(
    prefix: 'edge' | 'prop' | 'roof',
    identifiers: readonly string[],
) {
    const existing = new Set(identifiers);
    for (let suffix = 1; suffix <= existing.size + 1; suffix++) {
        const candidate = `${prefix}-${suffix.toString()}`;
        if (
            candidate.length <= gardenStructureMaxIdentifierLength &&
            !existing.has(candidate)
        ) {
            return candidate;
        }
    }
    return null;
}

function noChange(): GardenStructureDocumentEditFailureResult {
    return failure('no-change', 'The requested edit has no semantic effect.');
}

function itemNotFound(): GardenStructureDocumentEditFailureResult {
    return failure(
        'item-not-found',
        'The selected structure item was not found.',
    );
}

export function getCanonicalGardenStructureEdge(
    cell: GardenStructureCoordinate,
    side: GardenStructureCellSide,
): GardenStructureCanonicalEdge {
    switch (side) {
        case 'N':
            return { from: { ...cell }, direction: 'north' };
        case 'E':
            return { from: { ...cell }, direction: 'east' };
        case 'S':
            return {
                from: { x: cell.x, y: cell.y + 1 },
                direction: 'north',
            };
        case 'W':
            return {
                from: { x: cell.x - 1, y: cell.y },
                direction: 'east',
            };
    }
}

export function setGardenStructureFootprintCellSpaceKind(
    input: EditInput &
        Readonly<{
            cell: GardenStructureCoordinate;
            spaceKind: GardenStructureSpaceKind;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const targetKey = gardenStructureCellKey(input.cell);
    const target = document.footprint.cells.find(
        (cell) => gardenStructureCellKey(cell) === targetKey,
    );
    if (target?.spaceKind === input.spaceKind) {
        return noChange();
    }

    return finishDocument(
        {
            ...document,
            footprint: {
                cells: document.footprint.cells.map((cell) =>
                    gardenStructureCellKey(cell) === targetKey
                        ? { ...cell, spaceKind: input.spaceKind }
                        : cell,
                ),
            },
        },
        isReferenceAllowed,
    );
}

export function setGardenStructureFloorMaterial(
    input: EditInput &
        Readonly<{
            cell: GardenStructureCoordinate;
            materialId: string;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const targetKey = gardenStructureCellKey(input.cell);
    const existing = document.floors.find(
        (floor) => gardenStructureCellKey(floor.cell) === targetKey,
    );
    if (existing?.materialId === input.materialId) {
        return noChange();
    }

    const floor = {
        cell: { x: input.cell.x, y: input.cell.y },
        materialId: input.materialId,
    };
    return finishDocument(
        {
            ...document,
            floors: existing
                ? document.floors.map((candidate) =>
                      gardenStructureCellKey(candidate.cell) === targetKey
                          ? floor
                          : candidate,
                  )
                : [...document.floors, floor],
        },
        isReferenceAllowed,
    );
}

export function removeGardenStructureFloorMaterial(
    input: EditInput & Readonly<{ cell: GardenStructureCoordinate }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const targetKey = gardenStructureCellKey(input.cell);
    if (
        !document.floors.some(
            (floor) => gardenStructureCellKey(floor.cell) === targetKey,
        )
    ) {
        return itemNotFound();
    }

    return finishDocument(
        {
            ...document,
            floors: document.floors.filter(
                (floor) => gardenStructureCellKey(floor.cell) !== targetKey,
            ),
        },
        isReferenceAllowed,
    );
}

export function setGardenStructureEdgePart(
    input: EditInput &
        Readonly<{
            cell: GardenStructureCoordinate;
            side: GardenStructureCellSide;
            kind: GardenStructureEdgeKind;
            partId: string;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const canonical = getCanonicalGardenStructureEdge(input.cell, input.side);
    const targetKey = gardenStructureEdgeKey(canonical);
    const existing = document.edges.find(
        (edge) => gardenStructureEdgeKey(edge) === targetKey,
    );
    if (existing?.kind === input.kind && existing.partId === input.partId) {
        return noChange();
    }

    const edgeId =
        existing?.id ??
        nextUniqueIdentifier(
            'edge',
            document.edges.map((edge) => edge.id),
        );
    if (!edgeId) {
        return failure(
            'id-exhausted',
            'A bounded unique edge identifier could not be allocated.',
        );
    }

    const edge: GardenStructureEdge = {
        id: edgeId,
        from: canonical.from,
        direction: canonical.direction,
        kind: input.kind,
        partId: input.partId,
    };
    return finishDocument(
        {
            ...document,
            edges: existing
                ? document.edges.map((candidate) =>
                      gardenStructureEdgeKey(candidate) === targetKey
                          ? edge
                          : candidate,
                  )
                : [...document.edges, edge],
        },
        isReferenceAllowed,
        edgeId,
    );
}

export function removeGardenStructureEdgePart(
    input: EditInput &
        Readonly<{
            cell: GardenStructureCoordinate;
            side: GardenStructureCellSide;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const targetKey = gardenStructureEdgeKey(
        getCanonicalGardenStructureEdge(input.cell, input.side),
    );
    const existing = document.edges.find(
        (edge) => gardenStructureEdgeKey(edge) === targetKey,
    );
    if (!existing) {
        return itemNotFound();
    }

    return finishDocument(
        {
            ...document,
            edges: document.edges.filter(
                (edge) => gardenStructureEdgeKey(edge) !== targetKey,
            ),
        },
        isReferenceAllowed,
        existing.id,
    );
}

export function setGardenStructureRoofCoverage(
    input: EditInput &
        Readonly<{
            cell: GardenStructureCoordinate;
            styleId: string;
            materialId: string;
            rotation: GardenStructureRotation;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const targetKey = gardenStructureCellKey(input.cell);
    const region = document.roofRegions.find((candidate) =>
        candidate.cells.some(
            (cell) => gardenStructureCellKey(cell) === targetKey,
        ),
    );
    if (
        region?.styleId === input.styleId &&
        region.materialId === input.materialId &&
        region.rotation === input.rotation
    ) {
        return noChange();
    }

    let regionId: string | null | undefined = region?.id;
    let roofRegions = document.roofRegions;
    if (region && region.cells.length === 1) {
        roofRegions = document.roofRegions.map((candidate) =>
            candidate.id === region.id
                ? {
                      ...candidate,
                      styleId: input.styleId,
                      materialId: input.materialId,
                      rotation: input.rotation,
                  }
                : candidate,
        );
    } else {
        regionId = nextUniqueIdentifier(
            'roof',
            document.roofRegions.map((candidate) => candidate.id),
        );
        if (!regionId) {
            return failure(
                'id-exhausted',
                'A bounded unique roof identifier could not be allocated.',
            );
        }

        const remainingRegions = region
            ? document.roofRegions.map((candidate) =>
                  candidate.id === region.id
                      ? {
                            ...candidate,
                            cells: candidate.cells.filter(
                                (cell) =>
                                    gardenStructureCellKey(cell) !== targetKey,
                            ),
                        }
                      : candidate,
              )
            : document.roofRegions;
        roofRegions = [
            ...remainingRegions,
            {
                id: regionId,
                cells: [{ x: input.cell.x, y: input.cell.y }],
                styleId: input.styleId,
                materialId: input.materialId,
                rotation: input.rotation,
            },
        ];
    }

    return finishDocument(
        { ...document, roofRegions },
        isReferenceAllowed,
        regionId,
    );
}

export function removeGardenStructureRoofCoverage(
    input: EditInput & Readonly<{ cell: GardenStructureCoordinate }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const targetKey = gardenStructureCellKey(input.cell);
    const region = document.roofRegions.find((candidate) =>
        candidate.cells.some(
            (cell) => gardenStructureCellKey(cell) === targetKey,
        ),
    );
    if (!region) {
        return itemNotFound();
    }

    const roofRegions =
        region.cells.length === 1
            ? document.roofRegions.filter(
                  (candidate) => candidate.id !== region.id,
              )
            : document.roofRegions.map((candidate) =>
                  candidate.id === region.id
                      ? {
                            ...candidate,
                            cells: candidate.cells.filter(
                                (cell) =>
                                    gardenStructureCellKey(cell) !== targetKey,
                            ),
                        }
                      : candidate,
              );
    return finishDocument(
        { ...document, roofRegions },
        isReferenceAllowed,
        region.id,
    );
}

export function addGardenStructureProp(
    input: EditInput &
        Readonly<{
            cell: GardenStructureCoordinate;
            partId: string;
            rotation: GardenStructureRotation;
            variantId?: string;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const propId = nextUniqueIdentifier(
        'prop',
        document.props.map((prop) => prop.id),
    );
    if (!propId) {
        return failure(
            'id-exhausted',
            'A bounded unique prop identifier could not be allocated.',
        );
    }

    return finishDocument(
        {
            ...document,
            props: [
                ...document.props,
                {
                    id: propId,
                    partId: input.partId,
                    x: input.cell.x,
                    y: input.cell.y,
                    rotation: input.rotation,
                    ...(input.variantId !== undefined
                        ? { variantId: input.variantId }
                        : {}),
                },
            ],
        },
        isReferenceAllowed,
        propId,
    );
}

function findProp(document: GardenStructureDocumentV1, propId: string) {
    return document.props.find((prop) => prop.id === propId);
}

export function moveGardenStructureProp(
    input: EditInput &
        Readonly<{
            propId: string;
            cell: GardenStructureCoordinate;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const prop = findProp(document, input.propId);
    if (!prop) {
        return itemNotFound();
    }
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }
    if (prop.x === input.cell.x && prop.y === input.cell.y) {
        return noChange();
    }

    return finishDocument(
        {
            ...document,
            props: document.props.map((candidate) =>
                candidate.id === prop.id
                    ? { ...candidate, x: input.cell.x, y: input.cell.y }
                    : candidate,
            ),
        },
        isReferenceAllowed,
        prop.id,
    );
}

export function rotateGardenStructureProp(
    input: EditInput &
        Readonly<{
            propId: string;
            rotation: GardenStructureRotation;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const prop = findProp(document, input.propId);
    if (!prop) {
        return itemNotFound();
    }
    if (prop.rotation === input.rotation) {
        return noChange();
    }

    return finishDocument(
        {
            ...document,
            props: document.props.map((candidate) =>
                candidate.id === prop.id
                    ? { ...candidate, rotation: input.rotation }
                    : candidate,
            ),
        },
        isReferenceAllowed,
        prop.id,
    );
}

export function duplicateGardenStructureProp(
    input: EditInput &
        Readonly<{
            propId: string;
            cell: GardenStructureCoordinate;
        }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const prop = findProp(document, input.propId);
    if (!prop) {
        return itemNotFound();
    }
    const targetFailure = validateSelectedCell(document, input.cell);
    if (targetFailure) {
        return targetFailure;
    }

    const duplicateId = nextUniqueIdentifier(
        'prop',
        document.props.map((candidate) => candidate.id),
    );
    if (!duplicateId) {
        return failure(
            'id-exhausted',
            'A bounded unique prop identifier could not be allocated.',
        );
    }

    return finishDocument(
        {
            ...document,
            props: [
                ...document.props,
                {
                    ...prop,
                    id: duplicateId,
                    x: input.cell.x,
                    y: input.cell.y,
                },
            ],
        },
        isReferenceAllowed,
        duplicateId,
    );
}

export function deleteGardenStructureProp(
    input: EditInput & Readonly<{ propId: string }>,
): GardenStructureDocumentEditResult {
    const prepared = prepareDocument(input);
    if (!prepared.ok) {
        return prepared;
    }
    const { document, isReferenceAllowed } = prepared.value;
    const prop = findProp(document, input.propId);
    if (!prop) {
        return itemNotFound();
    }

    return finishDocument(
        {
            ...document,
            props: document.props.filter(
                (candidate) => candidate.id !== prop.id,
            ),
        },
        isReferenceAllowed,
        prop.id,
    );
}
