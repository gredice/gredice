import type { BlockData, GardenPackInventoryResponse } from '@gredice/client';
import { getEntityAppearanceVariantDefinition } from '@gredice/js/entityAppearanceVariants';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import { gameAssetModels } from '../data/gameAssetModels.generated';
import { isInternalSceneBlockData } from '../internalSceneBlockData';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';

// Colour variants can share a GLB. Their runtime identities are also registered
// in the local catalogue rather than appearing as separate asset filenames.
const supportedModels = new Set([
    ...Object.keys(gameAssetModels),
    ...getLocalSandboxBlockData().map((block) => block.information.name),
]);

export type OwnedGardenPack = GardenPackInventoryResponse['purchases'][number];
export type OwnedGardenPackLine = OwnedGardenPack['lines'][number];
export type GardenPackInventoryUnit = Pick<
    OwnedGardenPackLine,
    'lineId' | 'entityId' | 'modelName' | 'variant'
> & { purchaseId: string; unitOrdinal: number };
export type GardenPackInventoryPlacement = {
    place: (unit: GardenPackInventoryUnit) => Promise<unknown>;
    isPending: boolean;
    error: Error | null;
};

export function canQueryGardenPackInventory({
    rolloutEnabled,
    authenticatedQueriesEnabled,
    isMock,
    isLocalSandbox,
    isSandbox,
    userId,
    accountId,
}: {
    rolloutEnabled: boolean;
    authenticatedQueriesEnabled: boolean;
    isMock: boolean;
    isLocalSandbox: boolean;
    isSandbox: boolean | undefined;
    userId?: string;
    accountId?: string;
}) {
    return Boolean(
        rolloutEnabled &&
            authenticatedQueriesEnabled &&
            !isMock &&
            !isLocalSandbox &&
            isSandbox === false &&
            userId &&
            accountId,
    );
}

export function getOwnedPackStateLabel(
    pack: Pick<OwnedGardenPack, 'remainingQuantity' | 'totalQuantity'>,
) {
    if (pack.remainingQuantity === 0) return 'Iskorišten';
    return pack.remainingQuantity === pack.totalQuantity
        ? 'Neotvoren'
        : 'Djelomično iskorišten';
}

/** Catalogue availability gates new offers, not already paid quantities. */
export function getOwnedPackLineBlock(
    line: OwnedGardenPackLine,
    blocks: BlockData[] | null | undefined,
) {
    if (!supportedModels.has(line.modelName)) return undefined;
    try {
        resolveGardenPackLineVariant(line);
    } catch {
        return undefined;
    }
    return blocks?.find(
        (block) =>
            !isInternalSceneBlockData(block) &&
            block.id.toString() === line.entityId &&
            block.information.name === line.modelName,
    );
}

export function getOwnedPackNextUnit(
    pack: OwnedGardenPack,
    line: OwnedGardenPackLine,
): GardenPackInventoryUnit | undefined {
    if (line.remainingQuantity <= 0) return undefined;
    const ordinals = line.availableUnitOrdinals.filter(
        (ordinal) =>
            Number.isInteger(ordinal) &&
            ordinal > 0 &&
            ordinal <= line.quantity,
    );
    if (
        ordinals.length !== line.remainingQuantity ||
        new Set(ordinals).size !== ordinals.length
    )
        return undefined;
    const unitOrdinal = Math.min(...ordinals);
    return {
        purchaseId: pack.purchaseId,
        lineId: line.lineId,
        entityId: line.entityId,
        modelName: line.modelName,
        variant: line.variant,
        unitOrdinal,
    };
}

function getSupportedOwnedPackVariant(line: OwnedGardenPackLine) {
    try {
        const value = resolveGardenPackLineVariant(line);
        return getEntityAppearanceVariantDefinition(
            line.modelName,
        )?.variants.find((variant) => variant.value === value);
    } catch {
        return undefined;
    }
}

export function getOwnedPackVariantLabel(line: OwnedGardenPackLine) {
    if (!line.variant) return null;
    const variant = getSupportedOwnedPackVariant(line);
    if (!variant) return 'Kupljeni izgled trenutačno nije dostupan.';
    return 'label' in variant ? variant.label : 'Kupljeni izgled';
}
