import {
    createGardenStructureReferenceValidator,
    decodeGardenStructureDocument,
    type GardenStructureRotation,
    type GardenStructureSpaceKind,
    type GardenStructureTemplateKey,
    gardenStructureCellKey,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxIdentifierLength,
    getGardenStructureFootprintBounds,
    isGardenStructureTemplateAvailable,
    rotateGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { getGardenViewModeHref } from './gardenViewMode';

export type GardenStructureOverview2DCell = Readonly<{
    hasFloor: boolean;
    roofed: boolean;
    spaceKind: GardenStructureSpaceKind;
    worldX: number;
    worldY: number;
    x: number;
    y: number;
}>;

export type GardenStructureOverview2DSummary = Readonly<{
    anchorX: number;
    anchorY: number;
    cells: readonly GardenStructureOverview2DCell[];
    coveredOutdoorCellCount: number;
    depth: number;
    footprintCellCount: number;
    id: string;
    interiorCellCount: number;
    label: string;
    revision: number;
    roofedCellCount: number;
    rotation: GardenStructureRotation;
    templateKey: GardenStructureTemplateKey;
    templateLabel: string;
    width: number;
}>;

const emptyGardenStructureOverview2DSummaries = Object.freeze(
    [],
) satisfies readonly GardenStructureOverview2DSummary[];

const selectedStructureQueryKey = 'gardenStructureId';
const structureReturnViewQueryKey = 'gardenStructureReturnView';

export function getGardenStructureOverview3DHref(
    searchParams: Iterable<[string, string]>,
    structureId?: string,
) {
    const nextSearchParams = new URLSearchParams(Array.from(searchParams));
    nextSearchParams.set(structureReturnViewQueryKey, '2d');
    if (structureId) {
        nextSearchParams.set(selectedStructureQueryKey, structureId);
    }
    return getGardenViewModeHref('2d', nextSearchParams.entries());
}

const gardenStructureTemplateLabels: Readonly<
    Record<GardenStructureTemplateKey, string>
> = Object.freeze({
    barn: 'Staja',
    blank: 'Građevina',
    greenhouse: 'Staklenik',
    house: 'Kuća',
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readIdentifier(value: unknown) {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= gardenStructureMaxIdentifierLength &&
        value.trim() === value
        ? value
        : null;
}

function readPlacementCoordinate(value: unknown) {
    return Number.isSafeInteger(value) &&
        Math.abs(Number(value)) <= gardenStructureMaxCoordinateMagnitude
        ? Number(value)
        : null;
}

function readRotation(value: unknown): GardenStructureRotation | null {
    return value === 0 || value === 1 || value === 2 || value === 3
        ? value
        : null;
}

function readTemplateKey(value: unknown): GardenStructureTemplateKey | null {
    switch (value) {
        case 'barn':
        case 'blank':
        case 'greenhouse':
        case 'house':
            return value;
        default:
            return null;
    }
}

function createSummary(
    record: unknown,
): GardenStructureOverview2DSummary | null {
    if (
        !isRecord(record) ||
        record.isDeleted !== false ||
        (Object.hasOwn(record, 'deleted') && record.deleted !== false)
    ) {
        return null;
    }

    const id = readIdentifier(record.id);
    const kitKey = readIdentifier(record.kitKey);
    const kitVersion = readIdentifier(record.kitVersion);
    const anchorX = readPlacementCoordinate(record.anchorX);
    const anchorY = readPlacementCoordinate(record.anchorY);
    const rotation = readRotation(record.rotation);
    const templateKey = readTemplateKey(record.templateKey);
    const revision = Number.isSafeInteger(record.revision)
        ? Number(record.revision)
        : null;
    if (
        id === null ||
        kitKey === null ||
        kitVersion === null ||
        anchorX === null ||
        anchorY === null ||
        rotation === null ||
        templateKey === null ||
        revision === null ||
        revision < 1 ||
        !isGardenStructureTemplateAvailable(kitKey, kitVersion, templateKey)
    ) {
        return null;
    }

    const isReferenceAllowed = createGardenStructureReferenceValidator(
        kitKey,
        kitVersion,
    );
    if (!isReferenceAllowed) {
        return null;
    }

    const decoded = decodeGardenStructureDocument(record.document, {
        isReferenceAllowed,
    });
    if (!decoded.valid) {
        return null;
    }

    const rotated = rotateGardenStructureDocument(decoded.document, rotation);
    const bounds = getGardenStructureFootprintBounds(rotated.footprint.cells);
    if (!bounds) {
        return null;
    }

    const floorCells = new Set(
        rotated.floors.map((floor) => gardenStructureCellKey(floor.cell)),
    );
    const roofedCells = new Set(
        rotated.roofRegions.flatMap((region) =>
            region.cells.map(gardenStructureCellKey),
        ),
    );
    const cells = rotated.footprint.cells.map((cell) => {
        const key = gardenStructureCellKey(cell);
        return {
            hasFloor: floorCells.has(key),
            roofed: roofedCells.has(key),
            spaceKind: cell.spaceKind,
            worldX: anchorX + cell.x,
            worldY: anchorY + cell.y,
            x: cell.x,
            y: cell.y,
        };
    });
    const coveredOutdoorCellCount = cells.filter(
        (cell) => cell.spaceKind === 'covered-outdoor',
    ).length;

    return Object.freeze({
        anchorX,
        anchorY,
        cells: Object.freeze(cells),
        coveredOutdoorCellCount,
        depth: bounds.depth,
        footprintCellCount: cells.length,
        id,
        interiorCellCount: cells.length - coveredOutdoorCellCount,
        label: 'Građevina',
        revision,
        roofedCellCount: cells.filter((cell) => cell.roofed).length,
        rotation,
        templateKey,
        templateLabel: gardenStructureTemplateLabels[templateKey],
        width: bounds.width,
    });
}

/**
 * Builds a small, renderer-free view model from saved structure documents.
 * Invalid, deleted, unknown-kit, and duplicate records are omitted rather than
 * partially shown as trusted garden geometry.
 */
export function createGardenStructureOverview2DSummaries(
    records: readonly unknown[],
): readonly GardenStructureOverview2DSummary[] {
    if (records.length === 0) {
        return emptyGardenStructureOverview2DSummaries;
    }

    const identifierCounts = new Map<string, number>();
    for (const record of records) {
        const identifier = isRecord(record) ? readIdentifier(record.id) : null;
        if (identifier === null) {
            continue;
        }
        identifierCounts.set(
            identifier,
            (identifierCounts.get(identifier) ?? 0) + 1,
        );
    }
    const candidates = records.flatMap((record) => {
        const summary = createSummary(record);
        return summary ? [summary] : [];
    });

    return Object.freeze(
        candidates
            .filter((candidate) => identifierCounts.get(candidate.id) === 1)
            .sort((left, right) => left.id.localeCompare(right.id)),
    );
}
