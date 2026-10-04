import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    entities,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    storage,
    upsertAttributeValue,
} from '../src';

// Apply only in the same maintenance window as the raised-bed data conversion
// and runtime deployment. The default mode is read-only.

const actor = { id: 'codex', name: 'Codex' };
const blockName = 'Raised_Bed';
const entityTypeName = 'block';
const raisedBedAttributes = {
    'attributes.spanDepth': '2',
    'attributes.spanWidth': '1',
    'attributes.stackable': 'false',
    'prices.sunflowers': '200',
} satisfies Record<string, string>;

function parseApplyFlag(argv: string[]) {
    for (const argument of argv) {
        if (argument !== '--' && argument !== '--apply') {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    return argv.includes('--apply');
}

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

async function main() {
    const apply = parseApplyFlag(process.argv.slice(2));
    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const missingDefinitions = Object.keys(raisedBedAttributes).filter(
        (path) => !definitionsByPath.has(path),
    );
    if (missingDefinitions.length > 0) {
        throw new Error(
            `Missing block attribute definitions: ${missingDefinitions.join(', ')}`,
        );
    }

    const nameDefinition = definitionsByPath.get('information.name');
    if (!nameDefinition) {
        throw new Error('Missing information.name definition.');
    }
    const [entity] = await storage()
        .select({ id: entities.id, state: entities.state })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.value, blockName),
            ),
        )
        .limit(1);
    if (!entity) {
        throw new Error(`${blockName} block entity does not exist.`);
    }
    if (entity.state !== 'published') {
        throw new Error(`${blockName} block entity must already be published.`);
    }

    for (const [path, expectedValue] of Object.entries(raisedBedAttributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} definition.`);
        }
        const [storedValue] = await storage()
            .select({ id: attributeValues.id, value: attributeValues.value })
            .from(attributeValues)
            .where(
                and(
                    eq(attributeValues.entityId, entity.id),
                    eq(attributeValues.attributeDefinitionId, definition.id),
                    eq(attributeValues.isDeleted, false),
                ),
            )
            .limit(1);

        if (!apply) {
            console.log(
                `${path}: ${storedValue?.value ?? 'missing'} -> ${expectedValue}`,
            );
            continue;
        }
        if (storedValue?.value !== expectedValue) {
            await upsertAttributeValue(
                {
                    id: storedValue?.id,
                    attributeDefinitionId: definition.id,
                    entityId: entity.id,
                    entityTypeName,
                    order: definition.order,
                    value: expectedValue,
                },
                actor,
            );
        }
    }

    if (!apply) {
        console.log('Dry run only. Re-run with --apply to update Raised_Bed.');
        return;
    }

    for (const [path, expectedValue] of Object.entries(raisedBedAttributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} during readback.`);
        }
        const [storedValue] = await storage()
            .select({ value: attributeValues.value })
            .from(attributeValues)
            .where(
                and(
                    eq(attributeValues.entityId, entity.id),
                    eq(attributeValues.attributeDefinitionId, definition.id),
                    eq(attributeValues.isDeleted, false),
                ),
            )
            .limit(1);
        if (storedValue?.value !== expectedValue) {
            throw new Error(
                `Unexpected ${path} value: ${storedValue?.value ?? 'missing'}`,
            );
        }
    }

    console.log(
        `Updated and verified ${blockName} entity ${entity.id} as one 1x2 block costing 200 sunflowers.`,
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
