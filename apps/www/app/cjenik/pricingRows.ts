type PerPlantPrice = {
    prices?: {
        perPlant?: number | null;
    } | null;
};

type PerOperationPrice = {
    prices?: {
        perOperation?: number | null;
    } | null;
};

type PricedPerPlant<T extends PerPlantPrice> = T & {
    prices: {
        perPlant: number;
    };
};

type PricedPerOperation<T extends PerOperationPrice> = T & {
    prices: {
        perOperation: number;
    };
};

type NamedPlant = PerPlantPrice & {
    information: {
        name: string;
    };
};

type NamedPlantSort = PerPlantPrice & {
    information: {
        name: string;
        plant?: {
            information?: {
                name?: string | null;
            } | null;
        } | null;
    };
};

type NamedOperation = PerOperationPrice & {
    information: {
        label: string;
    };
};

function hasPerPlantPrice<T extends PerPlantPrice>(
    entity: T,
): entity is PricedPerPlant<T> {
    return typeof entity.prices?.perPlant === 'number';
}

function hasPerOperationPrice<T extends PerOperationPrice>(
    entity: T,
): entity is PricedPerOperation<T> {
    return typeof entity.prices?.perOperation === 'number';
}

export function getPricedPlantRows<T extends NamedPlant>(plants: T[]) {
    return plants
        .filter(hasPerPlantPrice)
        .sort((a, b) =>
            a.information.name.localeCompare(b.information.name, 'hr-HR'),
        );
}

export function getPricedPlantSortRows<T extends NamedPlantSort>(sorts: T[]) {
    return sorts.filter(hasPerPlantPrice).sort((a, b) => {
        const parentComparison = getPlantSortParentName(a).localeCompare(
            getPlantSortParentName(b),
            'hr-HR',
        );

        if (parentComparison !== 0) {
            return parentComparison;
        }

        return a.information.name.localeCompare(b.information.name, 'hr-HR');
    });
}

export function getPricedOperationRows<T extends NamedOperation>(
    operations: T[],
) {
    return operations
        .filter(hasPerOperationPrice)
        .sort((a, b) =>
            a.information.label.localeCompare(b.information.label, 'hr-HR'),
        );
}

export function getPlantSortParentName(sort: NamedPlantSort) {
    return sort.information.plant?.information?.name ?? 'Biljka';
}
