export type LegacyRaisedBedRecord = {
    blockId: string;
    gardenId: number;
    orientation: 'horizontal' | 'vertical';
    raisedBedId: number;
    status: string;
};

export type LegacyRaisedBedPlacement = {
    blockId: string;
    gardenId: number;
    index: number;
    referenced: boolean;
    rotation: number;
    x: number;
    y: number;
};

export type RaisedBedSingleBlockMigrationPlan = {
    anchor: { x: number; y: number };
    canonicalBlockId: string;
    gardenId: number;
    legacyBlockId: string | null;
    orientation: 'horizontal' | 'vertical';
    raisedBedId: number;
    rotation: 0 | 1;
    sourceRaisedBedId: number | null;
    stackIndex: number;
};

export type RaisedBedSingleBlockMigrationUnsafe = {
    blockId: string;
    gardenId: number;
    raisedBedId: number | null;
    reason: string;
};

function isAdjacent(
    left: LegacyRaisedBedPlacement,
    right: LegacyRaisedBedPlacement,
) {
    return (
        left.index === right.index &&
        ((left.x === right.x && Math.abs(left.y - right.y) === 1) ||
            (left.y === right.y && Math.abs(left.x - right.x) === 1))
    );
}

export function planRaisedBedSingleBlockMigration({
    nativeFootprint,
    placements,
    raisedBeds,
}: {
    nativeFootprint: boolean;
    placements: LegacyRaisedBedPlacement[];
    raisedBeds: LegacyRaisedBedRecord[];
}) {
    const alreadySingle: number[] = [];
    const plans: RaisedBedSingleBlockMigrationPlan[] = [];
    const unplaced: number[] = [];
    const unsafe: RaisedBedSingleBlockMigrationUnsafe[] = [];
    const processedRaisedBedIds = new Set<number>();
    const raisedBedByBlockId = new Map(
        raisedBeds.map((raisedBed) => [raisedBed.blockId, raisedBed]),
    );
    const referencedAdjacency = new Map<number, Set<number>>();
    for (let leftIndex = 0; leftIndex < placements.length; leftIndex++) {
        const leftPlacement = placements[leftIndex];
        const leftRaisedBed = leftPlacement
            ? raisedBedByBlockId.get(leftPlacement.blockId)
            : undefined;
        if (!leftPlacement || !leftRaisedBed) {
            continue;
        }
        for (
            let rightIndex = leftIndex + 1;
            rightIndex < placements.length;
            rightIndex++
        ) {
            const rightPlacement = placements[rightIndex];
            const rightRaisedBed = rightPlacement
                ? raisedBedByBlockId.get(rightPlacement.blockId)
                : undefined;
            if (
                !rightPlacement ||
                !rightRaisedBed ||
                leftPlacement.gardenId !== rightPlacement.gardenId ||
                !isAdjacent(leftPlacement, rightPlacement)
            ) {
                continue;
            }

            const leftNeighbors =
                referencedAdjacency.get(leftRaisedBed.raisedBedId) ??
                new Set<number>();
            leftNeighbors.add(rightRaisedBed.raisedBedId);
            referencedAdjacency.set(leftRaisedBed.raisedBedId, leftNeighbors);
            const rightNeighbors =
                referencedAdjacency.get(rightRaisedBed.raisedBedId) ??
                new Set<number>();
            rightNeighbors.add(leftRaisedBed.raisedBedId);
            referencedAdjacency.set(rightRaisedBed.raisedBedId, rightNeighbors);
        }
    }

    for (const raisedBed of raisedBeds) {
        if (processedRaisedBedIds.has(raisedBed.raisedBedId)) {
            continue;
        }
        processedRaisedBedIds.add(raisedBed.raisedBedId);

        const canonicalPlacement = placements.find(
            (placement) =>
                placement.gardenId === raisedBed.gardenId &&
                placement.blockId === raisedBed.blockId,
        );
        if (!canonicalPlacement) {
            unplaced.push(raisedBed.raisedBedId);
            continue;
        }

        if (nativeFootprint) {
            alreadySingle.push(raisedBed.raisedBedId);
            continue;
        }

        const referencedComponent = new Set<number>();
        const queue = [raisedBed.raisedBedId];
        while (queue.length > 0) {
            const raisedBedId = queue.pop();
            if (
                raisedBedId === undefined ||
                referencedComponent.has(raisedBedId)
            ) {
                continue;
            }
            referencedComponent.add(raisedBedId);
            for (const neighborId of referencedAdjacency.get(raisedBedId) ??
                []) {
                queue.push(neighborId);
            }
        }
        if (referencedComponent.size > 2) {
            for (const raisedBedId of referencedComponent) {
                processedRaisedBedIds.add(raisedBedId);
            }
            unsafe.push({
                blockId: raisedBed.blockId,
                gardenId: raisedBed.gardenId,
                raisedBedId: raisedBed.raisedBedId,
                reason: `referenced raised-bed component has ${referencedComponent.size.toString()} records`,
            });
            continue;
        }

        const adjacentPlacements = placements.filter(
            (placement) =>
                placement.gardenId === raisedBed.gardenId &&
                placement.blockId !== raisedBed.blockId &&
                isAdjacent(canonicalPlacement, placement),
        );
        const orphanCandidates = adjacentPlacements.filter(
            (placement) => !raisedBedByBlockId.has(placement.blockId),
        );
        const referencedCandidates = adjacentPlacements.flatMap((placement) => {
            const candidate = raisedBedByBlockId.get(placement.blockId);
            return candidate ? [{ placement, raisedBed: candidate }] : [];
        });

        if (
            orphanCandidates.length + referencedCandidates.length > 1 ||
            (orphanCandidates.length === 1 && referencedCandidates.length === 1)
        ) {
            unsafe.push({
                blockId: raisedBed.blockId,
                gardenId: raisedBed.gardenId,
                raisedBedId: raisedBed.raisedBedId,
                reason: `expected at most one adjacent legacy half, found ${(orphanCandidates.length + referencedCandidates.length).toString()}`,
            });
            continue;
        }

        const referencedCandidate = referencedCandidates[0];
        if (referencedCandidate) {
            processedRaisedBedIds.add(
                referencedCandidate.raisedBed.raisedBedId,
            );
            if (
                raisedBed.status !== 'new' ||
                referencedCandidate.raisedBed.status !== 'new'
            ) {
                unsafe.push({
                    blockId: raisedBed.blockId,
                    gardenId: raisedBed.gardenId,
                    raisedBedId: raisedBed.raisedBedId,
                    reason: 'referenced legacy halves can only be merged while both raised beds are new',
                });
                continue;
            }

            const target =
                raisedBed.blockId.localeCompare(
                    referencedCandidate.raisedBed.blockId,
                ) <= 0
                    ? { raisedBed, placement: canonicalPlacement }
                    : referencedCandidate;
            const source =
                target.raisedBed.raisedBedId === raisedBed.raisedBedId
                    ? referencedCandidate
                    : { raisedBed, placement: canonicalPlacement };
            const horizontal = target.placement.x === source.placement.x;
            plans.push({
                anchor: horizontal
                    ? {
                          x: target.placement.x,
                          y: Math.min(target.placement.y, source.placement.y),
                      }
                    : {
                          x: Math.min(target.placement.x, source.placement.x),
                          y: target.placement.y,
                      },
                canonicalBlockId: target.raisedBed.blockId,
                gardenId: target.raisedBed.gardenId,
                legacyBlockId: source.raisedBed.blockId,
                orientation: horizontal ? 'horizontal' : 'vertical',
                raisedBedId: target.raisedBed.raisedBedId,
                rotation: horizontal ? 0 : 1,
                sourceRaisedBedId: source.raisedBed.raisedBedId,
                stackIndex: target.placement.index,
            });
            continue;
        }

        const legacyPlacement = orphanCandidates[0];
        if (!legacyPlacement) {
            plans.push({
                anchor: { x: canonicalPlacement.x, y: canonicalPlacement.y },
                canonicalBlockId: raisedBed.blockId,
                gardenId: raisedBed.gardenId,
                legacyBlockId: null,
                orientation: raisedBed.orientation,
                raisedBedId: raisedBed.raisedBedId,
                rotation: raisedBed.orientation === 'horizontal' ? 0 : 1,
                sourceRaisedBedId: null,
                stackIndex: canonicalPlacement.index,
            });
            continue;
        }

        const horizontal = canonicalPlacement.x === legacyPlacement.x;
        plans.push({
            anchor: horizontal
                ? {
                      x: canonicalPlacement.x,
                      y: Math.min(canonicalPlacement.y, legacyPlacement.y),
                  }
                : {
                      x: Math.min(canonicalPlacement.x, legacyPlacement.x),
                      y: canonicalPlacement.y,
                  },
            canonicalBlockId: raisedBed.blockId,
            gardenId: raisedBed.gardenId,
            legacyBlockId: legacyPlacement.blockId,
            orientation: horizontal ? 'horizontal' : 'vertical',
            raisedBedId: raisedBed.raisedBedId,
            rotation: horizontal ? 0 : 1,
            sourceRaisedBedId: null,
            stackIndex: canonicalPlacement.index,
        });
    }

    const duplicateLegacyBlockIds = new Set<string>();
    const seenLegacyBlockIds = new Set<string>();
    for (const plan of plans) {
        if (!plan.legacyBlockId) {
            continue;
        }
        if (seenLegacyBlockIds.has(plan.legacyBlockId)) {
            duplicateLegacyBlockIds.add(plan.legacyBlockId);
        }
        seenLegacyBlockIds.add(plan.legacyBlockId);
    }

    const safePlans = plans.filter((plan) => {
        if (
            !plan.legacyBlockId ||
            !duplicateLegacyBlockIds.has(plan.legacyBlockId)
        ) {
            return true;
        }
        unsafe.push({
            blockId: plan.canonicalBlockId,
            gardenId: plan.gardenId,
            raisedBedId: plan.raisedBedId,
            reason: `legacy half ${plan.legacyBlockId} matches multiple raised beds`,
        });
        return false;
    });
    const consumedLegacyBlockIds = new Set(
        safePlans.flatMap((plan) =>
            plan.legacyBlockId ? [plan.legacyBlockId] : [],
        ),
    );
    for (const placement of placements) {
        if (
            placement.referenced ||
            consumedLegacyBlockIds.has(placement.blockId)
        ) {
            continue;
        }
        unsafe.push({
            blockId: placement.blockId,
            gardenId: placement.gardenId,
            raisedBedId: null,
            reason: 'unreferenced Raised_Bed block was not matched to a canonical block',
        });
    }

    return {
        alreadySingle,
        plans: safePlans,
        unplaced,
        unsafe,
    };
}
