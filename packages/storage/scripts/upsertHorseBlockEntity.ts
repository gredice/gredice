import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    createEntity,
    entities,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
} from '../src';
import {
    horseBlockAttributes,
    parseHorseCatalogOptions,
} from './lib/horseBlockCatalog';

// Deploy the runtime model and public covers before using --apply. The default
// dry-run prevents the catalogue from pointing at assets that are not live.

const actor = {
    id: 'codex',
    name: 'Codex',
};

const blockName = 'Horse';
const entityTypeName = 'block';

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

function orderedAttributeEntries(attributes: Record<string, string>) {
    return Object.entries(attributes).sort(([leftPath], [rightPath]) => {
        const leftIsName = leftPath === 'information.name';
        const rightIsName = rightPath === 'information.name';
        return Number(rightIsName) - Number(leftIsName);
    });
}

async function findBlockEntity(nameDefinitionId: number) {
    const matches = await storage()
        .select({
            id: entities.id,
            publishedAt: entities.publishedAt,
            state: entities.state,
        })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.value, blockName),
            ),
        )
        .limit(2);

    if (matches.length > 1) {
        throw new Error(
            `Multiple active block entities found for ${blockName}.`,
        );
    }

    return matches[0] ?? null;
}

async function getExistingAttributeValue({
    attributeDefinitionId,
    entityId,
}: {
    attributeDefinitionId: number;
    entityId: number;
}) {
    return storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function main() {
    const { apply } = parseHorseCatalogOptions(process.argv.slice(2));
    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const missingDefinitions = Object.keys(horseBlockAttributes).filter(
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

    let entity = await findBlockEntity(nameDefinition.id);
    let entityId = entity?.id ?? null;
    const changedAttributes: string[] = [];

    if (entityId) {
        for (const [path, expectedValue] of Object.entries(
            horseBlockAttributes,
        )) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                continue;
            }
            const existingValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId,
            });
            if (existingValue?.value !== expectedValue) {
                changedAttributes.push(path);
            }
        }
    } else {
        changedAttributes.push(...Object.keys(horseBlockAttributes));
    }

    const publish =
        entity?.state !== 'published' || entity?.publishedAt === null;
    const action = !entity
        ? 'create'
        : changedAttributes.length > 0 || publish
          ? 'update'
          : 'unchanged';
    const summary = {
        name: blockName,
        entityId,
        action,
        changedAttributes,
        publish,
    };

    if (!apply) {
        console.log(
            JSON.stringify(
                {
                    mode: 'dry-run',
                    block: summary,
                },
                null,
                2,
            ),
        );
        return;
    }

    if (!entityId) {
        entityId = await createEntity(entityTypeName, actor);
        summary.entityId = entityId;
    }

    for (const [path, expectedValue] of orderedAttributeEntries(
        horseBlockAttributes,
    )) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} while applying ${blockName}.`);
        }
        const existingValue = await getExistingAttributeValue({
            attributeDefinitionId: definition.id,
            entityId,
        });
        if (existingValue?.value === expectedValue) {
            continue;
        }
        await upsertAttributeValue(
            {
                id: existingValue?.id,
                attributeDefinitionId: definition.id,
                entityId,
                entityTypeName,
                order: definition.order,
                value: expectedValue,
            },
            actor,
        );
    }

    if (publish) {
        await updateEntity({ id: entityId, state: 'published' }, actor);
    }

    entity = await findBlockEntity(nameDefinition.id);
    if (
        !entity ||
        entity.id !== entityId ||
        entity.state !== 'published' ||
        entity.publishedAt === null
    ) {
        throw new Error(`Failed to publish ${blockName} block entity.`);
    }

    for (const [path, expectedValue] of Object.entries(horseBlockAttributes)) {
        const definition = definitionsByPath.get(path);
        if (!definition) {
            throw new Error(`Missing ${path} while verifying ${blockName}.`);
        }
        const storedValue = await getExistingAttributeValue({
            attributeDefinitionId: definition.id,
            entityId,
        });
        if (storedValue?.value !== expectedValue) {
            throw new Error(
                `Unexpected ${path} for ${blockName}: ${storedValue?.value ?? 'missing'}`,
            );
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: 'apply',
                block: summary,
                readback: {
                    attributeCount: Object.keys(horseBlockAttributes).length,
                    published: true,
                },
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
