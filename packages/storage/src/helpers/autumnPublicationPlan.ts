import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getEntityCompleteness } from './entityCompleteness';

const id = z.number().int().positive().max(2_147_483_647);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().max(20_000);
const instant = z.iso.datetime();
export const autumnPublicationNames = [
    'HarvestPumpkinSquatOrange',
    'HarvestPumpkinSquatCream',
    'HarvestPumpkinSquatGreen',
    'HarvestPumpkinGourdOrange',
    'HarvestPumpkinGourdCream',
    'HarvestPumpkinGourdGreen',
    'HarvestPumpkinGroupOrange',
    'HarvestPumpkinGroupCream',
    'HarvestPumpkinGroupGreen',
    'GardenScarecrow',
    'HarvestCrate',
    'HarvestCrateOrchard',
    'HarvestWheelbarrow',
    'AutumnAsterPotMauve',
    'AutumnAsterPotCream',
    'AutumnAsterPotGold',
    'AutumnShrub',
    'WoodlandMushrooms',
    'FallenLog',
    'AutumnLeafPileMound',
    'AutumnLeafPileCrescent',
    'LeafRake',
    'AutumnBlanketBench',
    'GardenTeaTable',
];
export const autumnDefinitionSchema = z.strictObject({
    id,
    category: text.min(1),
    name: text.min(1),
    label: text,
    required: z.boolean(),
    defaultValue: text.nullable(),
    multiple: z.boolean(),
    dataType: text.min(1),
    entityTypeName: z.literal('block'),
    unit: text.nullable(),
    order: text.nullable(),
    display: z.boolean(),
    updatedAt: instant,
});
export const autumnCmsEntitySchema = z.strictObject({
    id,
    entityTypeName: z.literal('block'),
    parentId: id.nullable(),
    hierarchyOrder: z.number().int(),
    state: z.enum(['draft', 'published']),
    publishedAt: instant.nullable(),
    createdAt: instant,
    updatedAt: instant,
    latestRevision: z
        .strictObject({
            id,
            action: text,
            previousState: text.nullable(),
            nextState: text.nullable(),
            previousValue: text.nullable(),
            nextValue: text.nullable(),
        })
        .nullable(),
    attributes: z
        .array(
            z.strictObject({
                id,
                attributeDefinitionId: id,
                value: text.nullable(),
                order: text.nullable(),
                updatedAt: instant,
            }),
        )
        .max(1_000),
});
export const autumnCmsExportSchema = z.strictObject({
    schemaVersion: z.literal(1),
    definitions: z.array(autumnDefinitionSchema).min(1).max(1_000),
    entities: z.array(autumnCmsEntitySchema).max(10_000),
});
export type AutumnCmsExport = z.infer<typeof autumnCmsExportSchema>;
export type AutumnCmsEntity = z.infer<typeof autumnCmsEntitySchema>;

export function canonicalPublicationJson(value: unknown): string {
    if (Array.isArray(value))
        return `[${value.map(canonicalPublicationJson).join(',')}]`;
    if (value !== null && typeof value === 'object')
        return `{${Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(
                ([key, entry]) =>
                    `${JSON.stringify(key)}:${canonicalPublicationJson(entry)}`,
            )
            .join(',')}}`;
    const serialized = JSON.stringify(value);
    if (
        serialized === undefined ||
        (typeof value === 'number' && !Number.isFinite(value))
    )
        throw new Error('Non-JSON publication input');
    return serialized;
}
export function publicationDigest(value: unknown) {
    return createHash('sha256')
        .update(canonicalPublicationJson(value))
        .digest('hex');
}
export function sortedDefinitions(definitions: AutumnCmsExport['definitions']) {
    return [...definitions].sort((a, b) => a.id - b.id);
}
export function publicationContent(entity: AutumnCmsEntity) {
    // Lifecycle timestamps/revision change on our own publication. All attribute
    // identities, raw values and update times remain part of the frozen content.
    const {
        state: _state,
        publishedAt: _published,
        updatedAt: _updated,
        latestRevision: _revision,
        ...content
    } = entity;
    return {
        ...content,
        attributes: [...content.attributes].sort((a, b) => a.id - b.id),
    };
}
export function publicationEntityDigest(entity: AutumnCmsEntity) {
    return publicationDigest({
        ...entity,
        attributes: [...entity.attributes].sort((a, b) => a.id - b.id),
    });
}
export function publicationAttributeMap(
    entity: AutumnCmsEntity,
    definitions: AutumnCmsExport['definitions'],
) {
    const paths = new Map(
        definitions.map((definition) => [
            definition.id,
            `${definition.category}.${definition.name}`,
        ]),
    );
    const values = new Map<string, string | null>();
    const seen = new Set<number>();
    for (const attribute of entity.attributes) {
        const path = paths.get(attribute.attributeDefinitionId);
        if (!path || seen.has(attribute.id) || values.has(path))
            throw new Error(
                `Unknown/duplicate attribute on entity ${entity.id}`,
            );
        seen.add(attribute.id);
        values.set(path, attribute.value);
    }
    return values;
}
export function validatePublicationExport(input: unknown) {
    const parsed = autumnCmsExportSchema.parse(input);
    const ids = new Set<number>();
    const paths = new Set<string>();
    for (const definition of parsed.definitions) {
        const path = `${definition.category}.${definition.name}`;
        if (ids.has(definition.id) || paths.has(path))
            throw new Error('Duplicate block definition');
        ids.add(definition.id);
        paths.add(path);
    }
    const entityIds = new Set<number>();
    const names = new Set<string>();
    const attributeIds = new Set<number>();
    for (const entity of parsed.entities) {
        const values = publicationAttributeMap(entity, parsed.definitions);
        const name = values.get('information.name');
        if (!name || entityIds.has(entity.id) || names.has(name))
            throw new Error('Missing/duplicate block identity');
        entityIds.add(entity.id);
        names.add(name);
        for (const attribute of entity.attributes) {
            if (attributeIds.has(attribute.id))
                throw new Error('Duplicate attribute ID');
            attributeIds.add(attribute.id);
        }
        if ((entity.state === 'published') !== (entity.publishedAt !== null))
            throw new Error(`Inconsistent publication state: ${name}`);
    }
    return parsed;
}
export function assertReviewedPublicationEntity(
    entity: AutumnCmsEntity,
    definitions: AutumnCmsExport['definitions'],
    expected: Record<string, string>,
) {
    if (entity.parentId !== null)
        throw new Error('Inherited block publication is unsupported');
    const values = publicationAttributeMap(entity, definitions);
    for (const [path, value] of Object.entries(expected)) {
        const actual = values.get(path);
        if (path === 'image.cover') {
            if (
                actual === null ||
                actual === undefined ||
                canonicalPublicationJson(JSON.parse(actual)) !==
                    canonicalPublicationJson(JSON.parse(value))
            )
                throw new Error(
                    `Reviewed attribute differs: ${entity.id} ${path}`,
                );
        } else if (actual !== value)
            throw new Error(`Reviewed attribute differs: ${entity.id} ${path}`);
    }
    const price = values.get('prices.sunflowers');
    if (!price || !/^[1-9][0-9]*$/.test(price) || Number(price) > 2_147_483_647)
        throw new Error(
            `Actual positive ordinary price required: ${entity.id}`,
        );
    if (!getEntityCompleteness(entity, definitions).isComplete)
        throw new Error(`Incomplete block: ${entity.id}`);
    return Number(price);
}
export const autumnPublicationPlanSchema = z.strictObject({
    schemaVersion: z.literal(1),
    scope: z.literal('autumn-ab-pilot'),
    sourceFingerprint: hash,
    definitionsDigest: hash,
    definitions: z.array(autumnDefinitionSchema).min(1).max(1_000),
    operations: z
        .array(
            z.strictObject({
                name: z.string().min(1).max(100),
                expected: autumnCmsEntitySchema,
                expectedDigest: hash,
                contentDigest: hash,
                reviewedAttributes: z.record(z.string().min(1).max(100), text),
                actualPrice: id,
                action: z.enum(['publish', 'noop']),
            }),
        )
        .length(24),
    deployedAssets: z
        .array(
            z.strictObject({
                path: z.string().min(1).max(500),
                url: z.url(),
                sha256: hash,
                bytes: z.number().int().positive().max(50_000_000),
            }),
        )
        .min(1)
        .max(400),
});
export type AutumnPublicationPlan = z.infer<typeof autumnPublicationPlanSchema>;
export function validateAutumnPublicationPlan(input: unknown) {
    const plan = autumnPublicationPlanSchema.parse(input);
    const parsed = validatePublicationExport({
        schemaVersion: 1,
        definitions: plan.definitions,
        entities: plan.operations.map((operation) => operation.expected),
    });
    if (
        publicationDigest(sortedDefinitions(parsed.definitions)) !==
        plan.definitionsDigest
    )
        throw new Error('Definition fingerprint differs');
    if (
        plan.operations.map((operation) => operation.name).join('|') !==
        [...autumnPublicationNames].sort().join('|')
    )
        throw new Error(
            'Exactly the sorted 24 reviewed A/B identities required',
        );
    for (const operation of plan.operations) {
        const name = publicationAttributeMap(
            operation.expected,
            plan.definitions,
        ).get('information.name');
        if (
            name !== operation.name ||
            operation.expectedDigest !==
                publicationEntityDigest(operation.expected) ||
            operation.contentDigest !==
                publicationDigest(publicationContent(operation.expected)) ||
            (operation.action === 'noop') !==
                (operation.expected.state === 'published') ||
            assertReviewedPublicationEntity(
                operation.expected,
                plan.definitions,
                operation.reviewedAttributes,
            ) !== operation.actualPrice
        )
            throw new Error(`Invalid publication operation: ${operation.name}`);
    }
    return plan;
}
