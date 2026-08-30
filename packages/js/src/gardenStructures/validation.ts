import {
    gardenStructureCellKey,
    gardenStructureEdgeKey,
    getGardenStructureAdjacentCells,
    getGardenStructureFootprintBounds,
    getGardenStructurePerimeterEdgeKeys,
    isGardenStructureFootprintConnected,
} from './topology';
import type {
    GardenStructureCoordinate,
    GardenStructureDocumentV1,
    GardenStructureEdge,
    GardenStructureEdgeDirection,
    GardenStructureEdgeKind,
    GardenStructureFloor,
    GardenStructureFootprintCell,
    GardenStructureProp,
    GardenStructureReference,
    GardenStructureRoofRegion,
    GardenStructureRotation,
    GardenStructureSpaceKind,
    GardenStructureValidationIssue,
    GardenStructureValidationIssueCode,
    GardenStructureValidationOptions,
    GardenStructureValidationResult,
} from './types';
import {
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxEdges,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxIdentifierLength,
    gardenStructureMaxPayloadBytes,
    gardenStructureMaxProps,
    gardenStructureMaxRoofRegions,
    gardenStructureMaxSideLength,
    gardenStructureSchemaVersion,
} from './types';

const gardenStructureMaxValidationIssues = 64;
const utf8Encoder = new TextEncoder();

type ValidationContext = {
    issues: GardenStructureValidationIssue[];
    warnings: GardenStructureValidationIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
    value: Record<string, unknown>,
    allowedKeys: readonly string[],
    path: string,
    context: ValidationContext,
) {
    const allowed = new Set(allowedKeys);
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            error(
                context,
                'invalid-field',
                path ? `${path}.${key}` : key,
                'Unknown fields are not supported.',
            );
        }
    }
}

export function getGardenStructurePayloadByteLength(value: unknown) {
    try {
        const serialized = JSON.stringify(value);
        return serialized === undefined
            ? null
            : utf8Encoder.encode(serialized).byteLength;
    } catch {
        return null;
    }
}

function addIssue(
    context: ValidationContext,
    issue: GardenStructureValidationIssue,
) {
    if (issue.severity === 'warning') {
        if (
            context.issues.length + context.warnings.length >=
            gardenStructureMaxValidationIssues
        ) {
            return;
        }
        context.warnings.push(issue);
        return;
    }

    if (context.issues.length >= gardenStructureMaxValidationIssues) {
        return;
    }
    if (
        context.issues.length + context.warnings.length >=
        gardenStructureMaxValidationIssues
    ) {
        context.warnings.pop();
    }
    context.issues.push(issue);
}

function error(
    context: ValidationContext,
    code: GardenStructureValidationIssueCode,
    path: string,
    message: string,
) {
    addIssue(context, { code, path, message, severity: 'error' });
}

function warning(
    context: ValidationContext,
    code: GardenStructureValidationIssueCode,
    path: string,
    message: string,
) {
    addIssue(context, { code, path, message, severity: 'warning' });
}

function readBoundedArray(
    value: unknown,
    path: string,
    maximumLength: number,
    context: ValidationContext,
) {
    if (!Array.isArray(value)) {
        error(context, 'invalid-field', path, 'Expected an array.');
        return [];
    }

    if (value.length > maximumLength) {
        error(
            context,
            'too-many-items',
            path,
            `Expected at most ${maximumLength.toString()} items.`,
        );
    }

    return value.slice(0, maximumLength);
}

function readCoordinate(
    value: unknown,
    path: string,
    context: ValidationContext,
    allowedExtraKeys: readonly string[] = [],
): GardenStructureCoordinate | null {
    if (!isRecord(value)) {
        error(context, 'invalid-coordinate', path, 'Expected a coordinate.');
        return null;
    }
    rejectUnknownKeys(value, ['x', 'y', ...allowedExtraKeys], path, context);

    const { x, y } = value;
    if (
        !Number.isSafeInteger(x) ||
        !Number.isSafeInteger(y) ||
        Math.abs(Number(x)) > gardenStructureMaxCoordinateMagnitude ||
        Math.abs(Number(y)) > gardenStructureMaxCoordinateMagnitude
    ) {
        error(
            context,
            'invalid-coordinate',
            path,
            `Coordinates must be safe integers within +/-${gardenStructureMaxCoordinateMagnitude.toString()}.`,
        );
        return null;
    }

    return { x: Number(x), y: Number(y) };
}

function readIdentifier(
    value: unknown,
    path: string,
    context: ValidationContext,
): string | null {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > gardenStructureMaxIdentifierLength ||
        value.trim() !== value
    ) {
        error(
            context,
            'invalid-identifier',
            path,
            `Expected a non-empty identifier up to ${gardenStructureMaxIdentifierLength.toString()} characters.`,
        );
        return null;
    }

    return value;
}

function readRotation(
    value: unknown,
    path: string,
    context: ValidationContext,
): GardenStructureRotation | null {
    switch (value) {
        case 0:
            return 0;
        case 1:
            return 1;
        case 2:
            return 2;
        case 3:
            return 3;
        default:
            error(
                context,
                'invalid-field',
                path,
                'Expected rotation 0, 1, 2, or 3.',
            );
            return null;
    }
}

function readSpaceKind(
    value: unknown,
    path: string,
    context: ValidationContext,
): GardenStructureSpaceKind | null {
    if (value === 'interior' || value === 'covered-outdoor') {
        return value;
    }

    error(
        context,
        'invalid-field',
        path,
        'Expected interior or covered-outdoor.',
    );
    return null;
}

function readEdgeDirection(
    value: unknown,
    path: string,
    context: ValidationContext,
): GardenStructureEdgeDirection | null {
    if (value === 'north' || value === 'east') {
        return value;
    }

    error(context, 'invalid-field', path, 'Expected north or east.');
    return null;
}

function readEdgeKind(
    value: unknown,
    path: string,
    context: ValidationContext,
): GardenStructureEdgeKind | null {
    if (value === 'wall' || value === 'door' || value === 'window') {
        return value;
    }

    error(context, 'invalid-field', path, 'Expected wall, door, or window.');
    return null;
}

function readFootprintCells(
    footprint: unknown,
    context: ValidationContext,
): GardenStructureFootprintCell[] {
    if (!isRecord(footprint)) {
        error(
            context,
            'invalid-field',
            'footprint',
            'Expected a footprint object.',
        );
        return [];
    }
    rejectUnknownKeys(footprint, ['cells'], 'footprint', context);

    return readBoundedArray(
        footprint.cells,
        'footprint.cells',
        gardenStructureMaxFootprintCells + 1,
        context,
    ).flatMap((value, index) => {
        const path = `footprint.cells[${index.toString()}]`;
        if (!isRecord(value)) {
            error(context, 'invalid-field', path, 'Expected a footprint cell.');
            return [];
        }
        rejectUnknownKeys(value, ['x', 'y', 'spaceKind'], path, context);

        const coordinate = readCoordinate(value, path, context, ['spaceKind']);
        const spaceKind = readSpaceKind(
            value.spaceKind,
            `${path}.spaceKind`,
            context,
        );
        return coordinate && spaceKind ? [{ ...coordinate, spaceKind }] : [];
    });
}

function readFloors(
    value: unknown,
    context: ValidationContext,
): GardenStructureFloor[] {
    return readBoundedArray(
        value,
        'floors',
        gardenStructureMaxFootprintCells,
        context,
    ).flatMap((entry, index) => {
        const path = `floors[${index.toString()}]`;
        if (!isRecord(entry)) {
            error(context, 'invalid-field', path, 'Expected a floor.');
            return [];
        }
        rejectUnknownKeys(entry, ['cell', 'materialId'], path, context);

        const cell = readCoordinate(entry.cell, `${path}.cell`, context);
        const materialId = readIdentifier(
            entry.materialId,
            `${path}.materialId`,
            context,
        );
        return cell && materialId ? [{ cell, materialId }] : [];
    });
}

function readEdges(
    value: unknown,
    context: ValidationContext,
): GardenStructureEdge[] {
    return readBoundedArray(
        value,
        'edges',
        gardenStructureMaxEdges,
        context,
    ).flatMap((entry, index) => {
        const path = `edges[${index.toString()}]`;
        if (!isRecord(entry)) {
            error(context, 'invalid-field', path, 'Expected an edge.');
            return [];
        }
        rejectUnknownKeys(
            entry,
            ['id', 'from', 'direction', 'partId', 'kind'],
            path,
            context,
        );

        const id = readIdentifier(entry.id, `${path}.id`, context);
        const from = readCoordinate(entry.from, `${path}.from`, context);
        const direction = readEdgeDirection(
            entry.direction,
            `${path}.direction`,
            context,
        );
        const partId = readIdentifier(entry.partId, `${path}.partId`, context);
        const kind = readEdgeKind(entry.kind, `${path}.kind`, context);

        return id && from && direction && partId && kind
            ? [{ id, from, direction, partId, kind }]
            : [];
    });
}

function readRoofRegions(
    value: unknown,
    context: ValidationContext,
): GardenStructureRoofRegion[] {
    return readBoundedArray(
        value,
        'roofRegions',
        gardenStructureMaxRoofRegions,
        context,
    ).flatMap((entry, index) => {
        const path = `roofRegions[${index.toString()}]`;
        if (!isRecord(entry)) {
            error(context, 'invalid-field', path, 'Expected a roof region.');
            return [];
        }
        rejectUnknownKeys(
            entry,
            ['id', 'cells', 'styleId', 'materialId', 'rotation'],
            path,
            context,
        );

        const id = readIdentifier(entry.id, `${path}.id`, context);
        const styleId = readIdentifier(
            entry.styleId,
            `${path}.styleId`,
            context,
        );
        const materialId = readIdentifier(
            entry.materialId,
            `${path}.materialId`,
            context,
        );
        const rotation = readRotation(
            entry.rotation,
            `${path}.rotation`,
            context,
        );
        const cells = readBoundedArray(
            entry.cells,
            `${path}.cells`,
            gardenStructureMaxFootprintCells,
            context,
        ).flatMap((cell, cellIndex) => {
            const coordinate = readCoordinate(
                cell,
                `${path}.cells[${cellIndex.toString()}]`,
                context,
            );
            return coordinate ? [coordinate] : [];
        });

        if (cells.length === 0) {
            error(
                context,
                'invalid-field',
                `${path}.cells`,
                'A roof region must contain at least one cell.',
            );
        }

        return id && styleId && materialId && rotation !== null
            ? [{ id, cells, styleId, materialId, rotation }]
            : [];
    });
}

function readProps(
    value: unknown,
    context: ValidationContext,
): GardenStructureProp[] {
    return readBoundedArray(
        value,
        'props',
        gardenStructureMaxProps,
        context,
    ).flatMap((entry, index) => {
        const path = `props[${index.toString()}]`;
        if (!isRecord(entry)) {
            error(context, 'invalid-field', path, 'Expected a prop.');
            return [];
        }
        rejectUnknownKeys(
            entry,
            ['id', 'partId', 'x', 'y', 'rotation', 'variantId'],
            path,
            context,
        );

        const id = readIdentifier(entry.id, `${path}.id`, context);
        const partId = readIdentifier(entry.partId, `${path}.partId`, context);
        const coordinate = readCoordinate(entry, path, context, [
            'id',
            'partId',
            'rotation',
            'variantId',
        ]);
        const rotation = readRotation(
            entry.rotation,
            `${path}.rotation`,
            context,
        );
        const variantId =
            entry.variantId === undefined
                ? undefined
                : readIdentifier(entry.variantId, `${path}.variantId`, context);

        if (!id || !partId || !coordinate || rotation === null) {
            return [];
        }
        if (entry.variantId !== undefined && !variantId) {
            return [];
        }

        return [
            {
                id,
                partId,
                ...coordinate,
                rotation,
                ...(variantId ? { variantId } : {}),
            },
        ];
    });
}

function validateFootprint(
    cells: readonly GardenStructureFootprintCell[],
    context: ValidationContext,
) {
    if (cells.length === 0) {
        error(
            context,
            'empty-footprint',
            'footprint.cells',
            'A structure footprint must contain at least one cell.',
        );
        return;
    }

    if (cells.length > gardenStructureMaxFootprintCells) {
        error(
            context,
            'footprint-cell-limit',
            'footprint.cells',
            `A structure may use at most ${gardenStructureMaxFootprintCells.toString()} cells.`,
        );
    }

    const seen = new Set<string>();
    for (const [index, cell] of cells.entries()) {
        const key = gardenStructureCellKey(cell);
        if (seen.has(key)) {
            error(
                context,
                'duplicate-footprint-cell',
                `footprint.cells[${index.toString()}]`,
                'Footprint cells must be unique.',
            );
        }
        seen.add(key);
    }

    if (
        seen.size === cells.length &&
        !isGardenStructureFootprintConnected(cells)
    ) {
        error(
            context,
            'disconnected-footprint',
            'footprint.cells',
            'Footprint cells must be orthogonally connected.',
        );
    }

    const bounds = getGardenStructureFootprintBounds(cells);
    if (
        bounds &&
        (bounds.width > gardenStructureMaxSideLength ||
            bounds.depth > gardenStructureMaxSideLength)
    ) {
        error(
            context,
            'footprint-side-limit',
            'footprint.cells',
            `Footprint width and depth may not exceed ${gardenStructureMaxSideLength.toString()} cells.`,
        );
    }
}

function validatePartRelationships(
    document: GardenStructureDocumentV1,
    context: ValidationContext,
) {
    const footprint = new Set(
        document.footprint.cells.map(gardenStructureCellKey),
    );
    const floorCells = new Set<string>();
    for (const [index, floor] of document.floors.entries()) {
        const key = gardenStructureCellKey(floor.cell);
        if (!footprint.has(key)) {
            error(
                context,
                'part-outside-footprint',
                `floors[${index.toString()}].cell`,
                'Floor cells must be inside the footprint.',
            );
        }
        if (floorCells.has(key)) {
            error(
                context,
                'duplicate-floor',
                `floors[${index.toString()}].cell`,
                'A footprint cell may have only one floor.',
            );
        }
        floorCells.add(key);
    }

    const edgeIds = new Set<string>();
    const edgeSlots = new Set<string>();
    for (const [index, edge] of document.edges.entries()) {
        if (edgeIds.has(edge.id)) {
            error(
                context,
                'duplicate-part-id',
                `edges[${index.toString()}].id`,
                'Edge IDs must be unique.',
            );
        }
        edgeIds.add(edge.id);

        const slot = gardenStructureEdgeKey(edge);
        if (edgeSlots.has(slot)) {
            error(
                context,
                'duplicate-edge',
                `edges[${index.toString()}]`,
                'Only one part may occupy an edge.',
            );
        }
        edgeSlots.add(slot);

        const adjacent = getGardenStructureAdjacentCells(edge);
        if (
            !adjacent.some((cell) =>
                footprint.has(gardenStructureCellKey(cell)),
            )
        ) {
            error(
                context,
                'part-outside-footprint',
                `edges[${index.toString()}].from`,
                'An edge must border at least one footprint cell.',
            );
        }
    }

    const roofIds = new Set<string>();
    const roofCells = new Set<string>();
    for (const [regionIndex, region] of document.roofRegions.entries()) {
        if (roofIds.has(region.id)) {
            error(
                context,
                'duplicate-part-id',
                `roofRegions[${regionIndex.toString()}].id`,
                'Roof region IDs must be unique.',
            );
        }
        roofIds.add(region.id);

        const regionCells = new Set<string>();
        for (const [cellIndex, cell] of region.cells.entries()) {
            const key = gardenStructureCellKey(cell);
            const path = `roofRegions[${regionIndex.toString()}].cells[${cellIndex.toString()}]`;
            if (!footprint.has(key)) {
                error(
                    context,
                    'part-outside-footprint',
                    path,
                    'Roof cells must be inside the footprint.',
                );
            }
            if (regionCells.has(key)) {
                error(
                    context,
                    'duplicate-roof-cell',
                    path,
                    'Roof cells must be unique within a region.',
                );
            }
            if (roofCells.has(key)) {
                error(
                    context,
                    'overlapping-roof-region',
                    path,
                    'Version 1 roof regions may not overlap.',
                );
            }
            regionCells.add(key);
            roofCells.add(key);
        }
    }

    const propIds = new Set<string>();
    const propCells = new Set<string>();
    for (const [index, prop] of document.props.entries()) {
        const key = gardenStructureCellKey(prop);
        if (propIds.has(prop.id)) {
            error(
                context,
                'duplicate-part-id',
                `props[${index.toString()}].id`,
                'Prop IDs must be unique.',
            );
        }
        propIds.add(prop.id);
        if (!footprint.has(key)) {
            error(
                context,
                'part-outside-footprint',
                `props[${index.toString()}]`,
                'Props must be inside the footprint.',
            );
        }
        if (propCells.has(key)) {
            error(
                context,
                'overlapping-prop',
                `props[${index.toString()}]`,
                'Version 1 solid props may not share a placement cell.',
            );
        }
        propCells.add(key);
    }

    for (const [index, cell] of document.footprint.cells.entries()) {
        const key = gardenStructureCellKey(cell);
        if (cell.spaceKind === 'covered-outdoor') {
            if (!roofCells.has(key)) {
                warning(
                    context,
                    'covered-outdoor-without-roof',
                    `footprint.cells[${index.toString()}]`,
                    'Covered-outdoor space is incomplete until it has a roof.',
                );
            }
            continue;
        }

        if (!floorCells.has(key)) {
            warning(
                context,
                'interior-without-floor',
                `footprint.cells[${index.toString()}]`,
                'Interior space has no applied floor.',
            );
        }

        const perimeterEdges = getGardenStructurePerimeterEdgeKeys(cell);
        const hasOpenBoundary = [
            { x: cell.x, y: cell.y - 1, edge: perimeterEdges.north },
            { x: cell.x + 1, y: cell.y, edge: perimeterEdges.east },
            { x: cell.x, y: cell.y + 1, edge: perimeterEdges.south },
            { x: cell.x - 1, y: cell.y, edge: perimeterEdges.west },
        ].some(
            (neighbor) =>
                !footprint.has(gardenStructureCellKey(neighbor)) &&
                !edgeSlots.has(neighbor.edge),
        );

        if (hasOpenBoundary) {
            warning(
                context,
                'incomplete-interior-shell',
                `footprint.cells[${index.toString()}]`,
                'Interior space has an open exterior boundary.',
            );
        }
    }
}

function validateReference(
    reference: GardenStructureReference,
    context: ValidationContext,
    options: GardenStructureValidationOptions,
) {
    const isReferenceAllowed = options.isReferenceAllowed;
    if (!isReferenceAllowed || isReferenceAllowed(reference)) {
        return;
    }

    error(
        context,
        'invalid-part-reference',
        reference.path,
        `The ${reference.kind} identifier is not available in this kit version.`,
    );
}

function validateReferences(
    document: GardenStructureDocumentV1,
    context: ValidationContext,
    options: GardenStructureValidationOptions,
) {
    for (const [index, floor] of document.floors.entries()) {
        validateReference(
            {
                id: floor.materialId,
                kind: 'floor-material',
                path: `floors[${index.toString()}].materialId`,
            },
            context,
            options,
        );
    }

    for (const [index, edge] of document.edges.entries()) {
        validateReference(
            {
                id: edge.partId,
                kind: 'edge-part',
                edgeKind: edge.kind,
                ownerId: edge.id,
                path: `edges[${index.toString()}].partId`,
            },
            context,
            options,
        );
    }

    for (const [index, region] of document.roofRegions.entries()) {
        const ownerId = region.id;
        validateReference(
            {
                id: region.styleId,
                kind: 'roof-style',
                ownerId,
                path: `roofRegions[${index.toString()}].styleId`,
            },
            context,
            options,
        );
        validateReference(
            {
                id: region.materialId,
                kind: 'roof-material',
                ownerId,
                parentReferenceId: region.styleId,
                path: `roofRegions[${index.toString()}].materialId`,
            },
            context,
            options,
        );
    }

    for (const [index, prop] of document.props.entries()) {
        const ownerId = prop.id;
        validateReference(
            {
                id: prop.partId,
                kind: 'prop-part',
                ownerId,
                path: `props[${index.toString()}].partId`,
            },
            context,
            options,
        );
        if (prop.variantId) {
            validateReference(
                {
                    id: prop.variantId,
                    kind: 'prop-variant',
                    ownerId,
                    parentReferenceId: prop.partId,
                    path: `props[${index.toString()}].variantId`,
                },
                context,
                options,
            );
        }
    }
}

export function decodeGardenStructureDocument(
    value: unknown,
    options: GardenStructureValidationOptions = {},
): GardenStructureValidationResult {
    const context: ValidationContext = { issues: [], warnings: [] };
    const payloadByteLength = getGardenStructurePayloadByteLength(value);
    if (payloadByteLength === null) {
        return {
            valid: false,
            issues: [
                {
                    code: 'invalid-document',
                    severity: 'error',
                    path: '',
                    message: 'Expected a JSON-serializable structure document.',
                },
            ],
        };
    }
    if (payloadByteLength > gardenStructureMaxPayloadBytes) {
        return {
            valid: false,
            issues: [
                {
                    code: 'payload-too-large',
                    severity: 'error',
                    path: '',
                    message: `Structure documents may use at most ${gardenStructureMaxPayloadBytes.toString()} UTF-8 bytes.`,
                },
            ],
        };
    }

    if (!isRecord(value)) {
        return {
            valid: false,
            issues: [
                {
                    code: 'invalid-document',
                    severity: 'error',
                    path: '',
                    message: 'Expected a structure document object.',
                },
            ],
        };
    }
    rejectUnknownKeys(
        value,
        [
            'schemaVersion',
            'footprint',
            'floors',
            'edges',
            'roofRegions',
            'props',
        ],
        '',
        context,
    );

    if (value.schemaVersion !== gardenStructureSchemaVersion) {
        error(
            context,
            'unsupported-schema-version',
            'schemaVersion',
            'Only Garden Structure schema version 1 is supported.',
        );
    }

    const footprintCells = readFootprintCells(value.footprint, context);
    const document: GardenStructureDocumentV1 = {
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells: footprintCells },
        floors: readFloors(value.floors, context),
        edges: readEdges(value.edges, context),
        roofRegions: readRoofRegions(value.roofRegions, context),
        props: readProps(value.props, context),
    };

    validateFootprint(document.footprint.cells, context);
    validatePartRelationships(document, context);
    validateReferences(document, context, options);

    if (context.issues.length > 0) {
        return {
            valid: false,
            issues: [...context.issues, ...context.warnings],
        };
    }

    return { valid: true, document, warnings: context.warnings };
}

export function validateGardenStructureDocument(
    document: GardenStructureDocumentV1,
    options: GardenStructureValidationOptions = {},
) {
    return decodeGardenStructureDocument(document, options);
}
