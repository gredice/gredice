import { fileURLToPath } from 'node:url';
import { validatePublicationExport } from '../packages/storage/src/helpers/autumnPublicationPlan';
import { reviewedPublicationAttributes } from './autumn-publication-plan-core';
import {
    inspectAutumnSource,
    repositoryReader,
} from './autumn-release-preflight-core';

const root = fileURLToPath(new URL('../', import.meta.url));
export const publicationFixtureTime = '2026-10-01T00:00:00.000Z';
let sourcePromise: ReturnType<typeof inspectAutumnSource> | undefined;
export function publicationFixtureSource() {
    sourcePromise ??= inspectAutumnSource(repositoryReader(root));
    return sourcePromise;
}
/** Synthetic IDs/prices only for tests; not a CMS import or live seed. */
export async function publicationFixtureCms() {
    const source = await publicationFixtureSource();
    const paths = new Set<string>(['prices.sunflowers']);
    for (const item of source.items)
        for (const key of Object.keys(reviewedPublicationAttributes(item)))
            paths.add(key);
    const definitions = [...paths].sort().map((path, index) => {
        const [category, name] = path.split('.');
        return {
            id: index + 1,
            category,
            name,
            label: path,
            required: true,
            defaultValue: null,
            multiple: false,
            dataType: 'string',
            entityTypeName: 'block',
            unit: null,
            order: null,
            display: true,
            updatedAt: publicationFixtureTime,
        };
    });
    const entities = source.items.map((item, index) => {
        const values = {
            ...reviewedPublicationAttributes(item),
            'prices.sunflowers': String(10 + index),
        };
        return {
            id: 900_001 + index,
            entityTypeName: 'block',
            parentId: null,
            hierarchyOrder: 0,
            state: 'draft',
            publishedAt: null,
            createdAt: publicationFixtureTime,
            updatedAt: publicationFixtureTime,
            latestRevision: null,
            attributes: Object.entries(values).map(
                ([path, value], attributeIndex) => ({
                    id: index * 100 + attributeIndex + 1,
                    attributeDefinitionId: definitions.find(
                        (definition) =>
                            `${definition.category}.${definition.name}` ===
                            path,
                    )?.id,
                    value,
                    order: null,
                    updatedAt: publicationFixtureTime,
                }),
            ),
        };
    });
    return validatePublicationExport({
        schemaVersion: 1,
        definitions,
        entities,
    });
}
export async function publicationFixtureDirectory() {
    const source = await publicationFixtureSource();
    return [
        ...source.items.map((item, index) => ({
            id: 900_001 + index,
            entityType: { name: 'block' },
            information: { name: item.name, ...item.information },
            attributes: item.attributes,
            functions: { raisedBed: false, recycler: false },
            prices: { sunflowers: 10 + index },
            image: {
                cover: {
                    url: new URL(item.cover, 'https://www.gredice.com').href,
                },
            },
        })),
        ...['StoneMedium', 'EnamelGardenLamp'].map((name, index) => ({
            id: 910_001 + index,
            entityType: { name: 'block' },
            information: { name },
            attributes: {
                type: 'decoration',
                spanWidth: 1,
                spanDepth: 1,
                height: 0.4,
                stackable: false,
                placeableOnWater: false,
                nightOnlyPurchase: false,
            },
            functions: { raisedBed: false, recycler: false },
            prices: { sunflowers: 20 + index },
            image: {
                cover: {
                    url: `https://www.gredice.com/assets/blocks/${name}.webp`,
                },
            },
        })),
    ];
}
