import type { Route } from 'next';
import { PublicDirectoryPaths } from '../../../../packages/directory-types/src/publicUrls.ts';

type EntityId = number | string;

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
    id: EntityId;
    slug?: string | null;
    information: {
        name: string;
    };
};

type NamedPlantSort = PerPlantPrice & {
    id: EntityId;
    slug?: string | null;
    information: {
        name: string;
        plant?: {
            id?: EntityId | null;
            slug?: string | null;
            information?: {
                name?: string | null;
            } | null;
        } | null;
    };
};

type NamedOperation = PerOperationPrice & {
    id: EntityId;
    slug?: string | null;
    information: {
        label: string;
    };
};

type DeliveryLocation = {
    id: EntityId;
    information: {
        label: string;
    };
    delivery: {
        freeRadius: number;
        zoneRadius: number;
    };
    prices: {
        pricePerKilometer: number;
    };
};

export type PlantPricingRow<
    TPlant extends NamedPlant = NamedPlant,
    TPlantSort extends NamedPlantSort = NamedPlantSort,
> =
    | {
          id: string;
          kind: 'plant';
          label: string;
          href: Route;
          price: number;
          plant: TPlant;
      }
    | {
          id: string;
          kind: 'sort';
          label: string;
          parentLabel: string;
          href: Route;
          price: number;
          plantSort: TPlantSort;
      };

export type OperationPricingRow<
    TOperation extends NamedOperation = NamedOperation,
> = {
    id: string;
    label: string;
    href: Route;
    price: number;
    operation: TOperation;
};

export type DeliveryPricingRow = {
    id: string;
    label: string;
    href: Route;
    freeRadius: number;
    zoneRadius: number;
    pricePerKilometer: number;
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

function comparePricingLabels(
    first: { label: string; parentLabel?: string },
    second: { label: string; parentLabel?: string },
) {
    return `${first.parentLabel ?? ''} ${first.label}`.localeCompare(
        `${second.parentLabel ?? ''} ${second.label}`,
        'hr-HR',
    );
}

export function getPlantSortParentName(sort: NamedPlantSort) {
    return sort.information.plant?.information?.name ?? 'Biljka';
}

function toRoute(path: string): Route {
    return path as Route;
}

export function buildPlantPricingRows<
    TPlant extends NamedPlant,
    TPlantSort extends NamedPlantSort,
>(
    plants: ReadonlyArray<TPlant>,
    plantSorts: ReadonlyArray<TPlantSort>,
): PlantPricingRow<TPlant, TPlantSort>[] {
    const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

    const plantRows = plants.filter(hasPerPlantPrice).map(
        (plant): PlantPricingRow<TPlant, TPlantSort> => ({
            id: `plant-${plant.id}`,
            kind: 'plant',
            label: plant.information.name,
            href: toRoute(PublicDirectoryPaths.Plant(plant.information.name)),
            price: plant.prices.perPlant,
            plant,
        }),
    );

    const sortRows = plantSorts
        .filter(hasPerPlantPrice)
        .map((sort): PlantPricingRow<TPlant, TPlantSort> => {
            const parentPlantId = sort.information.plant?.id;
            const parentPlant =
                parentPlantId === undefined || parentPlantId === null
                    ? undefined
                    : plantsById.get(parentPlantId);
            const parentLabel =
                parentPlant?.information.name ?? getPlantSortParentName(sort);

            return {
                id: `plant-sort-${sort.id}`,
                kind: 'sort',
                label: sort.information.name,
                parentLabel,
                href: toRoute(
                    PublicDirectoryPaths.PlantSort(
                        parentLabel,
                        sort.information.name,
                    ),
                ),
                price: sort.prices.perPlant,
                plantSort: sort,
            };
        });

    return [...plantRows, ...sortRows].sort(comparePricingLabels);
}

export function buildOperationPricingRows<TOperation extends NamedOperation>(
    operations: ReadonlyArray<TOperation>,
): OperationPricingRow<TOperation>[] {
    return operations
        .filter(hasPerOperationPrice)
        .map((operation) => ({
            id: `operation-${operation.id}`,
            label: operation.information.label,
            href: toRoute(
                PublicDirectoryPaths.Operation(operation.information.label),
            ),
            price: operation.prices.perOperation,
            operation,
        }))
        .sort((first, second) =>
            first.label.localeCompare(second.label, 'hr-HR'),
        );
}

export function buildDeliveryPricingRows(
    hqLocations: ReadonlyArray<DeliveryLocation>,
    deliveryHref: Route,
): DeliveryPricingRow[] {
    return hqLocations
        .map((location) => ({
            id: `delivery-${location.id}`,
            label: location.information.label,
            href: deliveryHref,
            freeRadius: location.delivery.freeRadius,
            zoneRadius: location.delivery.zoneRadius,
            pricePerKilometer: location.prices.pricePerKilometer,
        }))
        .sort((first, second) =>
            first.label.localeCompare(second.label, 'hr-HR'),
        );
}
