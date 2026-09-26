import { harvestPumpkins } from '@gredice/js/harvestPumpkins';
import { imageAttributeValueFromUrl } from '../src/helpers/generatedAttributeValues';

// Offline plan by default. This command has no publication mode: #5000 owns
// publication after the exact models and images have been deployed/read back.
const args = process.argv.slice(2);
if (
    args.some((arg) => !['--apply-drafts', '--dry-run'].includes(arg)) ||
    args.length > 1
) {
    throw new Error(
        'Use no arguments for an offline plan, --dry-run to compare the database, or --apply-drafts.',
    );
}
const specs = harvestPumpkins.map((item) => ({
    name: item.name,
    state: 'draft',
    attributes: {
        'information.name': item.name,
        ...Object.fromEntries(
            Object.entries(item.information).map(([key, value]) => [
                `information.${key}`,
                value,
            ]),
        ),
        ...Object.fromEntries(
            Object.entries(item.attributes).map(([key, value]) => [
                `attributes.${key}`,
                String(value),
            ]),
        ),
        'prices.sunflowers': String(item.sunflowers),
        'functions.raisedBed': 'false',
        'functions.recycler': 'false',
        'image.cover': imageAttributeValueFromUrl(
            `https://www.gredice.com/assets/blocks/${item.name}.webp`,
        ),
    },
}));

async function main() {
    if (args.length === 0) {
        console.log(
            JSON.stringify(
                { mode: 'offline-plan', publicationIssue: 5000, blocks: specs },
                null,
                2,
            ),
        );
        return;
    }
    const { and, eq } = await import('drizzle-orm');
    const {
        attributeValues,
        closeStorage,
        entities,
        getAttributeDefinitions,
        storage,
        upsertAttributeValue,
    } = await import('../src');
    const { createNamedEntity } = await import('./lib/createNamedEntity');
    const actor = { id: 'codex', name: 'Codex' };
    try {
        const definitions = new Map(
            (await getAttributeDefinitions('block')).map((definition) => [
                `${definition.category}.${definition.name}`,
                definition,
            ]),
        );
        for (const spec of specs) {
            for (const path of Object.keys(spec.attributes)) {
                if (!definitions.has(path))
                    throw new Error(
                        `Missing block attribute definition: ${path}`,
                    );
            }
        }
        const nameDefinition = definitions.get('information.name');
        if (!nameDefinition) throw new Error('Missing information.name');
        // Preflight the whole family before writing; never change a live item.
        const plans = [];
        for (const spec of specs) {
            const matches = await storage()
                .select({
                    id: entities.id,
                    state: entities.state,
                    publishedAt: entities.publishedAt,
                })
                .from(entities)
                .innerJoin(
                    attributeValues,
                    eq(attributeValues.entityId, entities.id),
                )
                .where(
                    and(
                        eq(entities.entityTypeName, 'block'),
                        eq(entities.isDeleted, false),
                        eq(attributeValues.isDeleted, false),
                        eq(
                            attributeValues.attributeDefinitionId,
                            nameDefinition.id,
                        ),
                        eq(attributeValues.value, spec.name),
                    ),
                )
                .limit(2);
            if (matches.length > 1)
                throw new Error(`Duplicate active block: ${spec.name}`);
            const entity = matches[0];
            if (
                entity &&
                (entity.state !== 'draft' || entity.publishedAt !== null)
            )
                throw new Error(
                    `Refusing to edit non-draft ${spec.name}; use the #5000 rollout.`,
                );
            plans.push({ spec, entity });
        }
        const summaries = [];
        for (const { spec, entity } of plans) {
            let entityId = entity?.id;
            const changedAttributes: string[] = [];
            if (!entityId && args[0] === '--apply-drafts') {
                entityId = await createNamedEntity({
                    actor,
                    entityTypeName: 'block',
                    name: spec.name,
                    nameDefinition,
                });
            }
            for (const [path, value] of Object.entries(spec.attributes)) {
                const definition = definitions.get(path);
                if (!definition) throw new Error(`Missing ${path}`);
                const existing = entityId
                    ? await storage().query.attributeValues.findFirst({
                          where: and(
                              eq(attributeValues.entityId, entityId),
                              eq(
                                  attributeValues.attributeDefinitionId,
                                  definition.id,
                              ),
                              eq(attributeValues.isDeleted, false),
                          ),
                      })
                    : undefined;
                if (existing?.value === value) continue;
                changedAttributes.push(path);
                if (args[0] === '--apply-drafts' && entityId) {
                    await upsertAttributeValue(
                        {
                            id: existing?.id,
                            entityId,
                            entityTypeName: 'block',
                            attributeDefinitionId: definition.id,
                            order: definition.order,
                            value,
                        },
                        actor,
                    );
                }
            }
            if (args[0] === '--apply-drafts' && entityId) {
                const stored = await storage().query.entities.findFirst({
                    where: eq(entities.id, entityId),
                });
                if (stored?.state !== 'draft' || stored.publishedAt !== null)
                    throw new Error(`Draft gate failed for ${spec.name}`);
                for (const [path, value] of Object.entries(spec.attributes)) {
                    const definition = definitions.get(path);
                    if (!definition) throw new Error(`Missing ${path}`);
                    const storedValue =
                        await storage().query.attributeValues.findFirst({
                            where: and(
                                eq(attributeValues.entityId, entityId),
                                eq(
                                    attributeValues.attributeDefinitionId,
                                    definition.id,
                                ),
                                eq(attributeValues.isDeleted, false),
                            ),
                        });
                    if (storedValue?.value !== value)
                        throw new Error(
                            `Readback failed: ${spec.name} ${path}`,
                        );
                }
            }
            summaries.push({
                name: spec.name,
                entityId: entityId ?? null,
                state: 'draft',
                changedAttributes,
            });
        }
        console.log(
            JSON.stringify({ mode: args[0], blocks: summaries }, null, 2),
        );
    } finally {
        await closeStorage();
    }
}

await main();
