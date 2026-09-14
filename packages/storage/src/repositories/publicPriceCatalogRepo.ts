import 'server-only';
import type {
    HqLocationsData,
    OperationData,
    PlantData,
    PlantSortData,
} from '@gredice/directory-types';
import { serviceAnchorDate } from '@gredice/js/pricing';
import { getEntitiesFormatted } from './entitiesRepo';
import { getEntityAnchorPrices } from './entityAnchorPricesRepo';
import { getPublishedSunflowerPackages } from './sunflowerPackagesRepo';

export const publicPriceEntityTypes = [
    'plant',
    'plantSort',
    'operation',
    'hqLocations',
    'sunflowerPackage',
];

/** The catalog sells cultivation, garden actions, delivery and prepaid credit;
 * harvested food is not sold here as a separate retail product. */
export async function getPublicPriceCatalog() {
    const [plants, sorts, operations, locations, packages] = await Promise.all([
        getEntitiesFormatted<PlantData>('plant'),
        getEntitiesFormatted<PlantSortData & { prices?: PlantData['prices'] }>(
            'plantSort',
        ),
        getEntitiesFormatted<OperationData>('operation'),
        getEntitiesFormatted<HqLocationsData>('hqLocations'),
        getPublishedSunflowerPackages(),
    ]);
    const entries = [
        ...plants.map((plant) => ({
            entityId: plant.id,
            entityTypeName: 'plant',
            name: `Uzgoj: ${plant.information.name}`,
            price: plant.prices?.perPlant,
            attributeCategory: 'prices',
            attributeName: 'perPlant',
            unit: 'biljka',
        })),
        ...sorts.map((sort) => ({
            entityId: sort.id,
            entityTypeName: 'plantSort',
            name: `Uzgoj: ${[
                sort.information.plant?.information?.name,
                sort.information.name,
            ]
                .filter(Boolean)
                .join(' – ')}`,
            price: sort.prices?.perPlant,
            attributeCategory: 'prices',
            attributeName: 'perPlant',
            unit: 'biljka',
        })),
        ...operations
            .filter((operation) => !operation.attributes?.internal)
            .map((operation) => ({
                entityId: operation.id,
                entityTypeName: 'operation',
                name: operation.information.label,
                price: operation.prices?.perOperation,
                attributeCategory: 'prices',
                attributeName: 'perOperation',
                unit: 'radnja',
            })),
        ...locations.map((location) => ({
            entityId: location.id,
            entityTypeName: 'hqLocations',
            name: `Dostava: ${location.information.label}`,
            price: location.prices?.pricePerKilometer,
            attributeCategory: 'prices',
            attributeName: 'pricePerKilometer',
            unit: 'km',
        })),
        ...packages.map((pkg) => ({
            entityId: pkg.entityId,
            entityTypeName: 'sunflowerPackage',
            name: pkg.name,
            packageCode: pkg.code,
            price: pkg.priceEur,
            attributeCategory: 'pricing',
            attributeName: 'priceEur',
            unit: 'paket',
        })),
    ].flatMap((entry) =>
        typeof entry.price === 'number' &&
        Number.isFinite(entry.price) &&
        entry.price >= 0
            ? [
                  {
                      ...entry,
                      price: entry.price,
                      key: `${entry.entityTypeName}:${'packageCode' in entry ? entry.packageCode : entry.entityId}`,
                  },
              ]
            : [],
    );
    const anchors = await getEntityAnchorPrices(
        entries.map((entry) => ({ ...entry, currentPrice: entry.price })),
        serviceAnchorDate,
    );
    return entries
        .map((entry) => ({
            key: entry.key,
            entityId: entry.entityId,
            entityTypeName: entry.entityTypeName,
            name: entry.name,
            price: entry.price,
            currency: 'EUR',
            unit: entry.unit,
            available:
                entry.entityTypeName === 'hqLocations' || entry.price > 0,
            specialSale: '',
            anchorPrice: anchors[entry.key] ?? null,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
}
