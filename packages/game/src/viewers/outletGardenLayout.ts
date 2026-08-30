import type {
    PublicGardenDetail,
    PublicGardenStack,
} from './PublicGardenViewer';

export type OutletGardenLayoutOffer = {
    id: number;
    plantId: number | null;
    plantSortId: number;
    remainingQuantity: number;
};

export type OutletGardenSlotAssignment = {
    offerId: number;
    plantKey: string;
    plantSortId: number;
    slotIndex: number;
    unitIndex: number;
};

export type OutletGardenSlotAssignments = ReadonlyMap<
    string,
    OutletGardenSlotAssignment
>;

export type OutletGardenDisplayUnit = OutletGardenLayoutOffer & {
    blockId: string;
    unitIndex: number;
};

export type OutletGardenOfferPlacement = {
    aisleRow: number;
    plantBay: number;
    surface: 'floor' | 'table';
    x: number;
    y: number;
};

export type OutletGardenProductSignPlacement = {
    anchorBlockId: string;
    anchorSlotIndex: number;
    id: string;
    plantSortId: number;
    rotation: number;
    surface: OutletGardenOfferPlacement['surface'];
    x: number;
    y: number;
};

const outletOfferBlockIdPrefix = 'outlet-offer:';
const outletGardenOffersPerPlantBay = 4;
const outletGardenPlantBaysPerAisleRow = 2;
const outletGardenAisleRowsPerPathSegment = 2;
const outletGardenAisleRowSpacing = 3;
const outletGardenFirstAisleRowOffset = 1;
const outletGardenPathSegmentLength = 10;
const outletGardenTableDistance = 2;
const outletGardenFloorDistance = 1;
const outletGardenProductSignOffset = 0.28;
const outletGardenDecorationDistance = 5;
const outletGardenLightNormalDistance = 2;
const outletGardenLightTangentDistance = 3;
const outletGardenBenchDistance = 1;
const outletGardenMapMargin = 2;
const outletGardenEntranceY =
    -outletGardenDecorationDistance - outletGardenMapMargin;
const outletGardenVirtualId = -1;
const outletGardenUpdatedAt = '1970-01-01T00:00:00.000Z';

export const outletGardenVisitorSpawnPoint = {
    x: 0,
    z: outletGardenEntranceY + 1,
} as const;

/**
 * Outlet tables and pots are individual scene objects. Keep the beta viewer
 * bounded when an admin enters a bulk quantity or an accidental large value;
 * the offer browser still shows the complete server-reported stock.
 */
export const outletGardenMaxDisplayedUnitsPerOffer = 100;
export const outletGardenMaxDisplayedUnitsTotal = 500;
export const outletGardenMaxProductSigns = 64;
export const outletGardenMaxDoubleLightPoleCount = 4;
export const outletGardenMaxTrackedTombstones = 500;

const outletGardenPotNames = [
    'PotLowBowl',
    'PotRoundedBowl',
    'PotBulbousNeck',
    'PotTallTapered',
    'PotHourglass',
    'PotStraightShortTub',
    'PotNarrowFootBowl',
    'PotSquatRidged',
    'PotTallSlenderCone',
    'PotWideLippedCup',
] as const;

type OutletGardenPotName = (typeof outletGardenPotNames)[number];

export const outletGardenRegisteredBlockNames = [
    'Block_Grass',
    'Bush',
    'DoubleGardenLightPole',
    'Fence',
    'MulchWood',
    'OutletDisplayTable',
    'StoneSmall',
    'Tree',
    'WoodenBench',
    ...outletGardenPotNames,
] as const;

type OutletGardenPoint = {
    x: number;
    y: number;
};

type OutletGardenPathSegment = {
    direction: OutletGardenPoint;
    index: number;
    origin: OutletGardenPoint;
};

type OutletGardenDecorationName =
    | 'Bush'
    | 'DoubleGardenLightPole'
    | 'StoneSmall'
    | 'Tree'
    | 'WoodenBench';

export function outletOfferBlockId(offerId: number, unitIndex = 0) {
    const suffix = unitIndex === 0 ? '' : `:${unitIndex.toString()}`;
    return `${outletOfferBlockIdPrefix}${offerId.toString()}${suffix}`;
}

export function outletOfferDisplayFromBlockId(blockId: string) {
    if (!blockId.startsWith(outletOfferBlockIdPrefix)) {
        return null;
    }

    const encodedDisplay = blockId.slice(outletOfferBlockIdPrefix.length);
    const match = /^([1-9]\d*)(?::([1-9]\d*))?$/u.exec(encodedDisplay);
    if (!match) {
        return null;
    }

    const offerId = Number(match[1]);
    const unitIndex = match[2] ? Number(match[2]) : 0;
    if (
        !Number.isSafeInteger(offerId) ||
        !Number.isSafeInteger(unitIndex) ||
        unitIndex < 0
    ) {
        return null;
    }

    return { offerId, unitIndex };
}

export function outletOfferIdFromBlockId(blockId: string) {
    return outletOfferDisplayFromBlockId(blockId)?.offerId ?? null;
}

function compareOutletGardenOffers(
    left: OutletGardenLayoutOffer,
    right: OutletGardenLayoutOffer,
) {
    const leftPlantId = left.plantId ?? Number.MAX_SAFE_INTEGER;
    const rightPlantId = right.plantId ?? Number.MAX_SAFE_INTEGER;

    return (
        leftPlantId - rightPlantId ||
        left.plantSortId - right.plantSortId ||
        left.id - right.id
    );
}

function outletGardenPlantKey(offer: OutletGardenLayoutOffer) {
    return offer.plantId === null
        ? 'plant:unknown'
        : `plant:${offer.plantId.toString()}`;
}

export function getOutletGardenDisplayUnits(
    offers: readonly OutletGardenLayoutOffer[],
) {
    const offersById = new Map<number, OutletGardenLayoutOffer>();
    for (const offer of offers) {
        if (!offersById.has(offer.id)) {
            offersById.set(offer.id, offer);
        }
    }

    const sortedOffers = Array.from(offersById.values())
        .sort(compareOutletGardenOffers)
        .map((offer) => ({
            offer,
            visualQuantity: Number.isSafeInteger(offer.remainingQuantity)
                ? Math.min(
                      outletGardenMaxDisplayedUnitsPerOffer,
                      Math.max(0, offer.remainingQuantity),
                  )
                : 0,
        }));
    const displayedQuantityByOffer = new Map<number, number>();
    let remainingDisplayBudget = outletGardenMaxDisplayedUnitsTotal;

    while (remainingDisplayBudget > 0) {
        let allocatedInRound = false;
        for (const { offer, visualQuantity } of sortedOffers) {
            const displayedQuantity =
                displayedQuantityByOffer.get(offer.id) ?? 0;
            if (displayedQuantity >= visualQuantity) {
                continue;
            }

            displayedQuantityByOffer.set(offer.id, displayedQuantity + 1);
            remainingDisplayBudget -= 1;
            allocatedInRound = true;
            if (remainingDisplayBudget === 0) {
                break;
            }
        }

        if (!allocatedInRound) {
            break;
        }
    }

    return sortedOffers.flatMap(({ offer }) =>
        Array.from(
            { length: displayedQuantityByOffer.get(offer.id) ?? 0 },
            (_, unitIndex) => ({
                ...offer,
                blockId: outletOfferBlockId(offer.id, unitIndex),
                unitIndex,
            }),
        ),
    );
}

function getOutletGardenSlotUnits(offers: readonly OutletGardenLayoutOffer[]) {
    const displayUnits = getOutletGardenDisplayUnits(offers);
    const displayedOfferIds = new Set(
        displayUnits.map((display) => display.id),
    );
    const soldOutSlotBudget = Math.max(
        0,
        outletGardenMaxDisplayedUnitsTotal - displayUnits.length,
    );
    const unavailableUnits = Array.from(
        new Map(offers.map((offer) => [offer.id, offer])).values(),
    )
        .filter((offer) => !displayedOfferIds.has(offer.id))
        .filter(
            (offer) =>
                !Number.isSafeInteger(offer.remainingQuantity) ||
                offer.remainingQuantity <= 0,
        )
        .sort(compareOutletGardenOffers)
        .slice(0, soldOutSlotBudget)
        .map((offer) => ({
            ...offer,
            blockId: outletOfferBlockId(offer.id),
            unitIndex: 0,
        }));

    return [...displayUnits, ...unavailableUnits].sort(
        (left, right) =>
            compareOutletGardenOffers(left, right) ||
            left.unitIndex - right.unitIndex,
    );
}

export function isOutletGardenDisplayLimited(
    offers: readonly OutletGardenLayoutOffer[],
) {
    const offersById = new Map<number, OutletGardenLayoutOffer>();
    for (const offer of offers) {
        if (!offersById.has(offer.id)) {
            offersById.set(offer.id, offer);
        }
    }

    let requestedDisplayCount = 0;

    for (const offer of offersById.values()) {
        const remainingQuantity = Number.isSafeInteger(offer.remainingQuantity)
            ? Math.max(0, offer.remainingQuantity)
            : 0;
        if (remainingQuantity > outletGardenMaxDisplayedUnitsPerOffer) {
            return true;
        }

        requestedDisplayCount += remainingQuantity;
        if (requestedDisplayCount > outletGardenMaxDisplayedUnitsTotal) {
            return true;
        }
    }

    return false;
}

function outletGardenPlantBay(slotIndex: number) {
    return Math.floor(slotIndex / outletGardenOffersPerPlantBay);
}

/**
 * Initial units receive plant-grouped bays with all tabletops filled before
 * floor positions. Recent stock tombstones retain their slots up to a bounded
 * history budget; fully released, pruned bays can then be reused. Existing
 * visible displays never move during the mounted session.
 */
export function reconcileOutletGardenSlots(
    previousAssignments: OutletGardenSlotAssignments,
    offers: readonly OutletGardenLayoutOffer[],
) {
    const displays = getOutletGardenSlotUnits(offers);
    const sceneBlockIds = new Set(displays.map((display) => display.blockId));
    const previousTombstoneIds = Array.from(previousAssignments.keys()).filter(
        (blockId) => !sceneBlockIds.has(blockId),
    );
    const excessTombstoneCount = Math.max(
        0,
        previousTombstoneIds.length - outletGardenMaxTrackedTombstones,
    );
    const retainedAssignments =
        excessTombstoneCount === 0
            ? previousAssignments
            : (() => {
                  const prunedAssignments = new Map(previousAssignments);
                  for (const blockId of previousTombstoneIds.slice(
                      0,
                      excessTombstoneCount,
                  )) {
                      prunedAssignments.delete(blockId);
                  }
                  return prunedAssignments;
              })();
    let updatedAssignments: Map<string, OutletGardenSlotAssignment> | null =
        null;
    for (const display of displays) {
        const assignment = (updatedAssignments ?? retainedAssignments).get(
            display.blockId,
        );
        if (!assignment) {
            continue;
        }

        const plantKey = outletGardenPlantKey(display);
        if (
            assignment.offerId === display.id &&
            assignment.plantKey === plantKey &&
            assignment.plantSortId === display.plantSortId &&
            assignment.unitIndex === display.unitIndex
        ) {
            continue;
        }

        updatedAssignments ??= new Map(retainedAssignments);
        updatedAssignments.set(display.blockId, {
            ...assignment,
            offerId: display.id,
            plantKey,
            plantSortId: display.plantSortId,
            unitIndex: display.unitIndex,
        });
    }
    const currentAssignments = updatedAssignments ?? retainedAssignments;

    const unseenDisplays = displays.filter(
        (display) => !currentAssignments.has(display.blockId),
    );
    if (unseenDisplays.length === 0) {
        return currentAssignments;
    }

    const assignments = new Map(currentAssignments);
    const usedSlots = new Set(
        Array.from(assignments.values(), (assignment) => assignment.slotIndex),
    );
    const existingPlantBays = new Map<string, Set<number>>();

    for (const assignment of assignments.values()) {
        const { plantKey, slotIndex } = assignment;
        const plantBays = existingPlantBays.get(plantKey) ?? new Set<number>();
        plantBays.add(outletGardenPlantBay(slotIndex));
        existingPlantBays.set(plantKey, plantBays);
    }

    const reservedPlantBays = new Set(
        Array.from(assignments.values(), (assignment) =>
            outletGardenPlantBay(assignment.slotIndex),
        ),
    );
    let nextPlantBay = 0;
    const reserveNextPlantBay = () => {
        while (reservedPlantBays.has(nextPlantBay)) {
            nextPlantBay += 1;
        }

        const reservedPlantBay = nextPlantBay;
        reservedPlantBays.add(reservedPlantBay);
        nextPlantBay += 1;
        return reservedPlantBay;
    };
    const unseenDisplaysByPlant = new Map<string, OutletGardenDisplayUnit[]>();
    for (const display of unseenDisplays) {
        const plantKey = outletGardenPlantKey(display);
        const plantDisplays = unseenDisplaysByPlant.get(plantKey) ?? [];
        plantDisplays.push(display);
        unseenDisplaysByPlant.set(plantKey, plantDisplays);
    }

    for (const [plantKey, plantDisplays] of unseenDisplaysByPlant) {
        const plantBays = Array.from(
            existingPlantBays.get(plantKey) ?? [],
        ).sort((left, right) => left - right);
        const availableExistingSlotCount = plantBays
            .flatMap((plantBay) =>
                Array.from(
                    { length: outletGardenOffersPerPlantBay },
                    (_, offset) =>
                        plantBay * outletGardenOffersPerPlantBay + offset,
                ),
            )
            .filter((slotIndex) => !usedSlots.has(slotIndex)).length;
        const newPlantBayCount = Math.ceil(
            Math.max(0, plantDisplays.length - availableExistingSlotCount) /
                outletGardenOffersPerPlantBay,
        );
        for (let index = 0; index < newPlantBayCount; index += 1) {
            plantBays.push(reserveNextPlantBay());
        }

        const availableSlots = plantBays
            .flatMap((plantBay) =>
                Array.from(
                    { length: outletGardenOffersPerPlantBay },
                    (_, offset) =>
                        plantBay * outletGardenOffersPerPlantBay + offset,
                ),
            )
            .filter((slotIndex) => !usedSlots.has(slotIndex))
            .sort((left, right) => {
                const leftOffset = left % outletGardenOffersPerPlantBay;
                const rightOffset = right % outletGardenOffersPerPlantBay;
                const leftSurface = leftOffset < 2 ? 0 : 1;
                const rightSurface = rightOffset < 2 ? 0 : 1;
                return (
                    leftSurface - rightSurface ||
                    outletGardenPlantBay(left) - outletGardenPlantBay(right) ||
                    leftOffset - rightOffset
                );
            });

        for (const display of plantDisplays) {
            const slotIndex = availableSlots.shift();
            if (slotIndex === undefined) {
                continue;
            }

            assignments.set(display.blockId, {
                offerId: display.id,
                plantKey,
                plantSortId: display.plantSortId,
                slotIndex,
                unitIndex: display.unitIndex,
            });
            usedSlots.add(slotIndex);
        }
    }

    const currentTombstoneIds = Array.from(assignments.keys()).filter(
        (blockId) => !sceneBlockIds.has(blockId),
    );
    const tombstonesToPrune = Math.max(
        0,
        currentTombstoneIds.length - outletGardenMaxTrackedTombstones,
    );
    for (const blockId of currentTombstoneIds.slice(0, tombstonesToPrune)) {
        assignments.delete(blockId);
    }

    return assignments;
}

function outletGardenPotName(plantSortId: number): OutletGardenPotName {
    const potIndex = Math.abs(plantSortId) % outletGardenPotNames.length;
    return outletGardenPotNames[potIndex] ?? outletGardenPotNames[0];
}

/**
 * The route is a compact eastward serpentine. Each segment has exactly two
 * display rows: two tables on each side per row, or eight table positions
 * before the next 90-degree turn. The ten-tile segment leaves a small planted
 * pause between the last table and the corner instead of crowding the turn.
 */
function outletGardenPathSegment(
    segmentIndex: number,
): OutletGardenPathSegment {
    const cycle = Math.floor(segmentIndex / 4);
    const segmentInCycle = segmentIndex % 4;
    const cycleStartX = cycle * outletGardenPathSegmentLength * 2;

    if (segmentInCycle === 0) {
        return {
            direction: { x: 0, y: 1 },
            index: segmentIndex,
            origin: { x: cycleStartX, y: 0 },
        };
    }
    if (segmentInCycle === 1) {
        return {
            direction: { x: 1, y: 0 },
            index: segmentIndex,
            origin: { x: cycleStartX, y: outletGardenPathSegmentLength },
        };
    }
    if (segmentInCycle === 2) {
        return {
            direction: { x: 0, y: -1 },
            index: segmentIndex,
            origin: {
                x: cycleStartX + outletGardenPathSegmentLength,
                y: outletGardenPathSegmentLength,
            },
        };
    }

    return {
        direction: { x: 1, y: 0 },
        index: segmentIndex,
        origin: {
            x: cycleStartX + outletGardenPathSegmentLength,
            y: 0,
        },
    };
}

function outletGardenPointAlongSegment(
    segment: OutletGardenPathSegment,
    distance: number,
) {
    return {
        x: segment.origin.x + segment.direction.x * distance,
        y: segment.origin.y + segment.direction.y * distance,
    };
}

function outletGardenAisleRowGeometry(aisleRow: number) {
    const segmentIndex = Math.floor(
        aisleRow / outletGardenAisleRowsPerPathSegment,
    );
    const aisleRowInSegment = aisleRow % outletGardenAisleRowsPerPathSegment;
    const segment = outletGardenPathSegment(segmentIndex);
    const distance =
        outletGardenFirstAisleRowOffset +
        aisleRowInSegment * outletGardenAisleRowSpacing;

    return {
        anchor: outletGardenPointAlongSegment(segment, distance),
        segment,
    };
}

function outletGardenSideNormal(
    plantBay: number,
    direction: OutletGardenPoint,
) {
    const isLeftSide = plantBay % outletGardenPlantBaysPerAisleRow === 0;
    return isLeftSide
        ? { x: -direction.y, y: direction.x }
        : { x: direction.y, y: -direction.x };
}

function outletGardenRotationFacingPath(normal: OutletGardenPoint) {
    const facing = { x: -normal.x, y: -normal.y };
    if (facing.x === 1) {
        return 1;
    }
    if (facing.y === -1) {
        return 2;
    }
    if (facing.x === -1) {
        return 3;
    }
    return 0;
}

function outletGardenRotationAlongPath(direction: OutletGardenPoint) {
    if (direction.x === 1) {
        return 0;
    }
    if (direction.y === -1) {
        return 1;
    }
    if (direction.x === -1) {
        return 2;
    }
    return 3;
}

function outletGardenFacingRotation(slotIndex: number) {
    const plantBay = outletGardenPlantBay(slotIndex);
    const aisleRow = Math.floor(plantBay / outletGardenPlantBaysPerAisleRow);
    const { segment } = outletGardenAisleRowGeometry(aisleRow);
    const normal = outletGardenSideNormal(plantBay, segment.direction);
    return outletGardenRotationFacingPath(normal);
}

export function getOutletGardenOfferPlacement(
    slotIndex: number,
): OutletGardenOfferPlacement {
    const plantBay = outletGardenPlantBay(slotIndex);
    const aisleRow = Math.floor(plantBay / outletGardenPlantBaysPerAisleRow);
    const slotInPlantBay = slotIndex % outletGardenOffersPerPlantBay;
    const { anchor, segment } = outletGardenAisleRowGeometry(aisleRow);
    const normal = outletGardenSideNormal(plantBay, segment.direction);
    const surface = slotInPlantBay < 2 ? 'table' : 'floor';
    const distance =
        surface === 'table'
            ? outletGardenTableDistance
            : outletGardenFloorDistance;
    const tangentOffset = slotInPlantBay % 2;

    return {
        aisleRow,
        plantBay,
        surface,
        x: anchor.x + normal.x * distance + segment.direction.x * tangentOffset,
        y: anchor.y + normal.y * distance + segment.direction.y * tangentOffset,
    };
}

/**
 * Places one compact product sign per visible plant sort beside the earliest
 * slot that sort has owned. Retained assignments intentionally remain eligible
 * anchors so stock churn does not make a sign jump between tables. The
 * deterministic cap protects the WebGL scene from mounting hundreds of Drei
 * Html portals for pathological catalogs; the semantic offer browser remains
 * complete.
 */
export function getOutletGardenProductSignPlacements(
    offers: readonly OutletGardenLayoutOffer[],
    assignments: OutletGardenSlotAssignments,
) {
    const scenePlantSortIds = new Set(offers.map((offer) => offer.plantSortId));
    const anchorByPlantSortId = new Map<
        number,
        { assignment: OutletGardenSlotAssignment; blockId: string }
    >();
    const productSignCoordinate = (value: number) =>
        Math.round(value * 100) / 100;

    for (const [blockId, assignment] of assignments) {
        if (!scenePlantSortIds.has(assignment.plantSortId)) {
            continue;
        }

        const currentAnchor = anchorByPlantSortId.get(assignment.plantSortId);
        if (
            !currentAnchor ||
            assignment.slotIndex < currentAnchor.assignment.slotIndex ||
            (assignment.slotIndex === currentAnchor.assignment.slotIndex &&
                blockId.localeCompare(currentAnchor.blockId) < 0)
        ) {
            anchorByPlantSortId.set(assignment.plantSortId, {
                assignment,
                blockId,
            });
        }
    }

    return Array.from(anchorByPlantSortId, ([plantSortId, anchor]) => {
        const { slotIndex } = anchor.assignment;
        const placement = getOutletGardenOfferPlacement(slotIndex);
        const plantBay = outletGardenPlantBay(slotIndex);
        const slotInPlantBay = slotIndex % outletGardenOffersPerPlantBay;
        const { segment } = outletGardenAisleRowGeometry(placement.aisleRow);
        const normal = outletGardenSideNormal(plantBay, segment.direction);
        const tangentOffset =
            slotInPlantBay % 2 === 0
                ? -outletGardenProductSignOffset
                : outletGardenProductSignOffset;

        return {
            anchorBlockId: anchor.blockId,
            anchorSlotIndex: slotIndex,
            id: `outlet-sort-sign:${plantSortId.toString()}`,
            plantSortId,
            rotation: outletGardenRotationFacingPath(normal),
            surface: placement.surface,
            x: productSignCoordinate(
                placement.x +
                    normal.x * outletGardenProductSignOffset +
                    segment.direction.x * tangentOffset,
            ),
            y: productSignCoordinate(
                placement.y +
                    normal.y * outletGardenProductSignOffset +
                    segment.direction.y * tangentOffset,
            ),
        } satisfies OutletGardenProductSignPlacement;
    })
        .sort(
            (left, right) =>
                left.anchorSlotIndex - right.anchorSlotIndex ||
                left.plantSortId - right.plantSortId,
        )
        .slice(0, outletGardenMaxProductSigns);
}

function stackKey(x: number, y: number) {
    return `${x.toString()}|${y.toString()}`;
}

function addBlock(
    stacksByPosition: Map<string, PublicGardenStack>,
    x: number,
    y: number,
    block: PublicGardenStack['blocks'][number],
) {
    const key = stackKey(x, y);
    const stack = stacksByPosition.get(key);
    if (stack) {
        stack.blocks.push(block);
        return;
    }

    stacksByPosition.set(key, { x, y, blocks: [block] });
}

function compareStacks(left: PublicGardenStack, right: PublicGardenStack) {
    return left.y - right.y || left.x - right.x;
}

function outletGardenPathSegmentCount(
    assignments: OutletGardenSlotAssignments,
) {
    const highestPlantBay = Math.max(
        -1,
        ...Array.from(assignments.values(), (assignment) =>
            outletGardenPlantBay(assignment.slotIndex),
        ),
    );
    const aisleRowCount = Math.max(
        1,
        Math.ceil((highestPlantBay + 1) / outletGardenPlantBaysPerAisleRow),
    );
    // Even a small outlet should visibly read as a winding garden, not the old
    // straight aisle, so always include the first corner and second segment.
    return Math.max(
        2,
        Math.ceil(aisleRowCount / outletGardenAisleRowsPerPathSegment),
    );
}

function outletGardenPathPoints(segmentCount: number) {
    const pathPoints = new Map<string, OutletGardenPoint>();

    for (let y = outletGardenEntranceY; y <= 0; y += 1) {
        pathPoints.set(stackKey(0, y), { x: 0, y });
    }

    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
        const segment = outletGardenPathSegment(segmentIndex);
        for (
            let distance = 0;
            distance <= outletGardenPathSegmentLength;
            distance += 1
        ) {
            const point = outletGardenPointAlongSegment(segment, distance);
            pathPoints.set(stackKey(point.x, point.y), point);
        }
    }

    return Array.from(pathPoints.values());
}

function outletGardenBounds(segmentCount: number) {
    const pathPoints = outletGardenPathPoints(segmentCount);
    const maxPathX = Math.max(...pathPoints.map((point) => point.x));

    return {
        maxX: maxPathX + outletGardenDecorationDistance + outletGardenMapMargin,
        maxY:
            outletGardenPathSegmentLength +
            outletGardenDecorationDistance +
            outletGardenMapMargin,
        minX: -outletGardenDecorationDistance - outletGardenMapMargin,
        minY: outletGardenEntranceY,
    };
}

function outletGardenReservedDisplayPoints(segmentCount: number) {
    const points: OutletGardenPoint[] = [];
    const aisleRowCount = segmentCount * outletGardenAisleRowsPerPathSegment;

    for (let aisleRow = 0; aisleRow < aisleRowCount; aisleRow += 1) {
        for (let side = 0; side < outletGardenPlantBaysPerAisleRow; side += 1) {
            const plantBay = aisleRow * outletGardenPlantBaysPerAisleRow + side;
            for (let offset = 0; offset < 2; offset += 1) {
                for (const surfaceOffset of [0, 2]) {
                    const placement = getOutletGardenOfferPlacement(
                        plantBay * outletGardenOffersPerPlantBay +
                            surfaceOffset +
                            offset,
                    );
                    points.push({ x: placement.x, y: placement.y });
                }
            }
        }
    }

    return points;
}

function outletGardenDecorationCandidates(
    segment: OutletGardenPathSegment,
    ordinal: number,
    normalDistance: number,
    preferredDistances: readonly number[],
) {
    const leftNormal = {
        x: -segment.direction.y,
        y: segment.direction.x,
    };
    const rightNormal = { x: -leftNormal.x, y: -leftNormal.y };
    const preferredNormal =
        (segment.index + ordinal) % 2 === 0 ? leftNormal : rightNormal;
    const otherNormal = {
        x: -preferredNormal.x,
        y: -preferredNormal.y,
    };
    const distances = Array.from(
        new Set([...preferredDistances, 8, 6, 9, 7, 3, 1, 4, 5, 2]),
    );

    return [preferredNormal, otherNormal].flatMap((normal) =>
        distances.map((distance) => {
            const pathPoint = outletGardenPointAlongSegment(segment, distance);
            return {
                normal,
                point: {
                    x: pathPoint.x + normal.x * normalDistance,
                    y: pathPoint.y + normal.y * normalDistance,
                },
            };
        }),
    );
}

function outletGardenPointIsClear(
    point: OutletGardenPoint,
    blockedPoints: readonly OutletGardenPoint[],
) {
    return blockedPoints.every(
        (blockedPoint) =>
            Math.max(
                Math.abs(point.x - blockedPoint.x),
                Math.abs(point.y - blockedPoint.y),
            ) > 1,
    );
}

function outletGardenDecorations(
    segmentCount: number,
    assignments: OutletGardenSlotAssignments,
) {
    const futureSafeSegmentCount = segmentCount + 1;
    const pathPoints = outletGardenPathPoints(futureSafeSegmentCount);
    const pathPositionKeys = new Set(
        pathPoints.map((point) => stackKey(point.x, point.y)),
    );
    const reservedDisplayPoints = outletGardenReservedDisplayPoints(
        futureSafeSegmentCount,
    );
    const decorations: Array<{
        idSuffix: string;
        name: OutletGardenDecorationName;
        point: OutletGardenPoint;
        rotation: number;
        segmentIndex: number;
    }> = [];
    const illuminatedSegmentIndices = Array.from(
        new Set(
            Array.from(assignments.values(), (assignment) => {
                const plantBay = outletGardenPlantBay(assignment.slotIndex);
                const aisleRow = Math.floor(
                    plantBay / outletGardenPlantBaysPerAisleRow,
                );
                return Math.floor(
                    aisleRow / outletGardenAisleRowsPerPathSegment,
                );
            }),
        ),
    )
        .sort((left, right) => left - right)
        .slice(0, outletGardenMaxDoubleLightPoleCount);
    const illuminatedSegmentIndexSet = new Set(illuminatedSegmentIndices);

    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
        const segment = outletGardenPathSegment(segmentIndex);
        const existingDecorationPoints = () =>
            decorations.map((decoration) => decoration.point);
        const addDecoration = (
            name: OutletGardenDecorationName,
            ordinal: number,
            normalDistance: number,
            preferredDistances: readonly number[],
            allowNextToPath: boolean,
        ) => {
            const candidate = outletGardenDecorationCandidates(
                segment,
                ordinal,
                normalDistance,
                preferredDistances,
            ).find(({ point }) => {
                const isOffPath = !pathPositionKeys.has(
                    stackKey(point.x, point.y),
                );
                const isClearOfPath =
                    allowNextToPath ||
                    outletGardenPointIsClear(point, pathPoints);

                return (
                    isOffPath &&
                    isClearOfPath &&
                    outletGardenPointIsClear(point, reservedDisplayPoints) &&
                    outletGardenPointIsClear(point, existingDecorationPoints())
                );
            });
            if (!candidate) {
                return;
            }

            decorations.push({
                idSuffix: segmentIndex.toString(),
                name,
                point: candidate.point,
                rotation: outletGardenRotationFacingPath(candidate.normal),
                segmentIndex,
            });
        };

        // One pole sits in the free tile between a side's two table rows. The
        // side alternates per segment, halving the light count while keeping
        // both sides of the winding walkway evenly covered. Retained assignment
        // tombstones keep the earliest four occupied segments illuminated
        // without letting the light registry grow with stock.
        if (illuminatedSegmentIndexSet.has(segmentIndex)) {
            const pathPoint = outletGardenPointAlongSegment(
                segment,
                outletGardenLightTangentDistance,
            );
            const leftNormal = {
                x: -segment.direction.y,
                y: segment.direction.x,
            };
            const side = segmentIndex % 2 === 0 ? 'left' : 'right';
            const normal =
                side === 'left'
                    ? leftNormal
                    : { x: -leftNormal.x, y: -leftNormal.y };

            decorations.push({
                idSuffix: `${segmentIndex.toString()}:${side}`,
                name: 'DoubleGardenLightPole',
                point: {
                    x: pathPoint.x + normal.x * outletGardenLightNormalDistance,
                    y: pathPoint.y + normal.y * outletGardenLightNormalDistance,
                },
                rotation: outletGardenRotationAlongPath(segment.direction),
                segmentIndex,
            });
        }

        // Seating belongs beside the aisle, while trees, bushes, and stones
        // fill the outer verge without competing with seedlings for clicks.
        addDecoration(
            'WoodenBench',
            1,
            outletGardenBenchDistance,
            [7, 8, 6, 9],
            true,
        );
        addDecoration('Tree', 2, outletGardenDecorationDistance, [8, 6], false);
        addDecoration('Bush', 3, outletGardenDecorationDistance, [6, 9], false);
        addDecoration(
            'StoneSmall',
            4,
            outletGardenDecorationDistance,
            [9, 6, 3],
            false,
        );
    }

    return decorations;
}

export function buildOutletGardenStacks(
    offers: readonly OutletGardenLayoutOffer[],
    assignments: OutletGardenSlotAssignments,
) {
    const segmentCount = outletGardenPathSegmentCount(assignments);
    const { maxX, maxY, minX, minY } = outletGardenBounds(segmentCount);
    const pathPositionKeys = new Set(
        outletGardenPathPoints(segmentCount).map((point) =>
            stackKey(point.x, point.y),
        ),
    );
    const stacksByPosition = new Map<string, PublicGardenStack>();

    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            addBlock(stacksByPosition, x, y, {
                id: `outlet-ground:${x.toString()}:${y.toString()}`,
                name: 'Block_Grass',
                rotation: 0,
            });

            if (pathPositionKeys.has(stackKey(x, y))) {
                addBlock(stacksByPosition, x, y, {
                    id: `outlet-path:${x.toString()}:${y.toString()}`,
                    name: 'MulchWood',
                    rotation: 0,
                });
            }

            const atBoundary =
                x === minX || x === maxX || y === minY || y === maxY;
            const atFrontOpening = y === minY && x === 0;
            if (atBoundary && !atFrontOpening) {
                addBlock(stacksByPosition, x, y, {
                    id: `outlet-fence:${x.toString()}:${y.toString()}`,
                    name: 'Fence',
                    rotation: 0,
                });
            }
        }
    }

    const assignedPlantBays = Array.from(
        new Set(
            Array.from(assignments.values(), (assignment) =>
                outletGardenPlantBay(assignment.slotIndex),
            ),
        ),
    ).sort((left, right) => left - right);
    for (const plantBay of assignedPlantBays) {
        for (let offset = 0; offset < 2; offset += 1) {
            const slotIndex = plantBay * outletGardenOffersPerPlantBay + offset;
            const placement = getOutletGardenOfferPlacement(slotIndex);
            addBlock(stacksByPosition, placement.x, placement.y, {
                id: `outlet-table:${plantBay.toString()}:${offset.toString()}`,
                name: 'OutletDisplayTable',
                rotation: outletGardenFacingRotation(slotIndex),
            });
        }
    }

    const placedDisplays = getOutletGardenDisplayUnits(offers)
        .map((display) => ({
            assignment: assignments.get(display.blockId),
            display,
        }))
        .filter(
            (
                entry,
            ): entry is {
                assignment: OutletGardenSlotAssignment;
                display: OutletGardenDisplayUnit;
            } => entry.assignment !== undefined,
        )
        .sort(
            (left, right) =>
                left.assignment.slotIndex - right.assignment.slotIndex ||
                left.display.id - right.display.id ||
                left.display.unitIndex - right.display.unitIndex,
        );

    for (const { assignment, display } of placedDisplays) {
        const position = getOutletGardenOfferPlacement(assignment.slotIndex);
        addBlock(stacksByPosition, position.x, position.y, {
            id: display.blockId,
            name: outletGardenPotName(display.plantSortId),
            rotation: outletGardenFacingRotation(assignment.slotIndex),
        });
    }

    for (const decoration of outletGardenDecorations(
        segmentCount,
        assignments,
    )) {
        addBlock(stacksByPosition, decoration.point.x, decoration.point.y, {
            id: `outlet-decor:${decoration.name}:${decoration.idSuffix}`,
            name: decoration.name,
            rotation: decoration.rotation,
        });
    }

    return Array.from(stacksByPosition.values()).sort(compareStacks);
}

function outletGardenResponseStacks(stacks: readonly PublicGardenStack[]) {
    const responseStacks: PublicGardenDetail['stacks'] = {};

    for (const stack of stacks) {
        const x = stack.x.toString();
        const y = stack.y.toString();
        const row = responseStacks[x] ?? {};
        row[y] = stack.blocks;
        responseStacks[x] = row;
    }

    return responseStacks;
}

export function buildOutletGardenDetail(
    offers: readonly OutletGardenLayoutOffer[],
    assignments: OutletGardenSlotAssignments,
) {
    return {
        backgroundPalette: 'default',
        farmId: outletGardenVirtualId,
        homeCamera: null,
        id: outletGardenVirtualId,
        isPublic: true,
        isSandbox: false,
        latitude: 45.815,
        longitude: 15.982,
        name: 'Vrt dostupnih sadnica',
        raisedBeds: [],
        stacks: outletGardenResponseStacks(
            buildOutletGardenStacks(offers, assignments),
        ),
        structures: [],
        updatedAt: outletGardenUpdatedAt,
    } satisfies PublicGardenDetail;
}
