type PlantPriceEntity = {
    id: number;
    prices?: {
        perPlant?: number;
    };
};

export type PlantSowingPrice = {
    currentPrice: number;
    entityId: number;
    entityTypeName: 'plant' | 'plantSort';
};

export function resolvePlantSowingPrice(
    plant: PlantPriceEntity,
    sort?: PlantPriceEntity | null,
): PlantSowingPrice | null {
    const sortPrice = sort?.prices?.perPlant;

    if (sort && typeof sortPrice === 'number') {
        return {
            currentPrice: sortPrice,
            entityId: sort.id,
            entityTypeName: 'plantSort',
        };
    }

    const plantPrice = plant.prices?.perPlant;

    if (typeof plantPrice !== 'number') {
        return null;
    }

    return {
        currentPrice: plantPrice,
        entityId: plant.id,
        entityTypeName: 'plant',
    };
}
