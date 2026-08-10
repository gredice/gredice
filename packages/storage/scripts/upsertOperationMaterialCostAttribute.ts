import {
    closeStorage,
    createAttributeDefinition,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    updateAttributeDefinition,
} from '../src';

const entityTypeName = 'operation';
const attributePath = 'prices.materialCost';
const definitionConfig = {
    category: 'prices',
    dataType: 'number',
    defaultValue: null,
    description:
        'Procijenjeni trošak materijala u EUR potreban za izvršavanje jedne operacije.',
    display: false,
    entityTypeName,
    label: 'Trošak materijala',
    multiple: false,
    name: 'materialCost',
    order: null,
    required: false,
    unit: '€',
};

function parseArgs(argv: string[]) {
    let apply = false;

    for (const arg of argv) {
        if (arg === '--') {
            continue;
        }
        if (arg === '--apply') {
            apply = true;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return { apply };
}

function definitionPath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

function findDefinition(definitions: SelectAttributeDefinition[]) {
    const matches = definitions.filter(
        (definition) => definitionPath(definition) === attributePath,
    );
    if (matches.length > 1) {
        throw new Error(
            `Expected at most one active ${entityTypeName} ${attributePath} definition, found ${matches.length}.`,
        );
    }
    return matches[0] ?? null;
}

function definitionNeedsUpdate(definition: SelectAttributeDefinition) {
    return (
        definition.dataType !== definitionConfig.dataType ||
        definition.defaultValue !== definitionConfig.defaultValue ||
        definition.description !== definitionConfig.description ||
        definition.display !== definitionConfig.display ||
        definition.label !== definitionConfig.label ||
        definition.multiple !== definitionConfig.multiple ||
        definition.order !== definitionConfig.order ||
        definition.required !== definitionConfig.required ||
        definition.unit !== definitionConfig.unit
    );
}

async function main() {
    const { apply } = parseArgs(process.argv.slice(2));
    const existing = findDefinition(
        await getAttributeDefinitions(entityTypeName),
    );
    const action = existing
        ? definitionNeedsUpdate(existing)
            ? 'update'
            : 'unchanged'
        : 'create';

    if (apply && action === 'create') {
        await createAttributeDefinition(definitionConfig);
    } else if (apply && action === 'update' && existing) {
        await updateAttributeDefinition({
            id: existing.id,
            ...definitionConfig,
        });
    }

    const persisted = apply
        ? findDefinition(await getAttributeDefinitions(entityTypeName))
        : existing;
    if (apply && (!persisted || definitionNeedsUpdate(persisted))) {
        throw new Error(`Failed to verify ${attributePath} definition.`);
    }

    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                attribute: {
                    path: attributePath,
                    action,
                    definitionId: persisted?.id ?? null,
                    dataType: definitionConfig.dataType,
                    unit: definitionConfig.unit,
                    required: definitionConfig.required,
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
