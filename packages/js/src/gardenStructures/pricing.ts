import type {
    GardenStructureDocumentV1,
    GardenStructurePriceDelta,
} from './types';
import { gardenStructureSunflowerPricePerCell } from './types';

function requireNonNegativeInteger(value: number, name: string) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer.`);
    }
}

export function getGardenStructureFootprintPrice(
    cellCount: number,
    unitPrice = gardenStructureSunflowerPricePerCell,
) {
    requireNonNegativeInteger(cellCount, 'cellCount');
    requireNonNegativeInteger(unitPrice, 'unitPrice');
    const price = cellCount * unitPrice;
    if (!Number.isSafeInteger(price)) {
        throw new RangeError(
            'Calculated footprint price exceeds safe integer bounds.',
        );
    }
    return price;
}

export function getGardenStructureDocumentPrice(
    document: GardenStructureDocumentV1,
    unitPrice = gardenStructureSunflowerPricePerCell,
) {
    return getGardenStructureFootprintPrice(
        document.footprint.cells.length,
        unitPrice,
    );
}

export function calculateGardenStructurePriceDelta({
    persistedCellCount,
    candidateCellCount,
    unitPrice = gardenStructureSunflowerPricePerCell,
    refundablePrincipal,
}: {
    persistedCellCount: number;
    candidateCellCount: number;
    unitPrice?: number;
    refundablePrincipal: number;
}): GardenStructurePriceDelta {
    requireNonNegativeInteger(persistedCellCount, 'persistedCellCount');
    requireNonNegativeInteger(candidateCellCount, 'candidateCellCount');
    requireNonNegativeInteger(unitPrice, 'unitPrice');
    requireNonNegativeInteger(refundablePrincipal, 'refundablePrincipal');

    const maximumPersistedPrincipal = getGardenStructureFootprintPrice(
        persistedCellCount,
        unitPrice,
    );
    getGardenStructureFootprintPrice(candidateCellCount, unitPrice);
    if (refundablePrincipal > maximumPersistedPrincipal) {
        throw new RangeError(
            'refundablePrincipal exceeds the persisted footprint value.',
        );
    }

    const cellDelta = candidateCellCount - persistedCellCount;
    const debit = getGardenStructureFootprintPrice(
        Math.max(cellDelta, 0),
        unitPrice,
    );
    const refund = Math.min(
        getGardenStructureFootprintPrice(Math.max(-cellDelta, 0), unitPrice),
        refundablePrincipal,
    );
    const nextRefundablePrincipal = refundablePrincipal + debit - refund;
    if (!Number.isSafeInteger(nextRefundablePrincipal)) {
        throw new RangeError(
            'Calculated refundable principal exceeds safe integer bounds.',
        );
    }

    return {
        cellDelta,
        debit,
        refund,
        nextRefundablePrincipal,
    };
}
