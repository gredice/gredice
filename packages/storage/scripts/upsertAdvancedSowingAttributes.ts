import {
    closeStorage,
    createAttributeDefinition,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    updateAttributeDefinition,
} from '../src';

type AdvancedSowingAttributeName =
    | 'seedingDistance'
    | 'seedingDistanceMax'
    | 'seedingDistanceMin';

type AttributeSpec = {
    description: string;
    label: string;
    name: AdvancedSowingAttributeName;
    order: string;
    required: boolean;
};

const attributeSpecs: AttributeSpec[] = [
    {
        name: 'seedingDistance',
        label: 'Preporučeni razmak sijanja/sadnje',
        description:
            'Optimalni razmak između biljaka u centimetrima. Ovo je zadani izbor pri sjetvi.',
        order: '110',
        required: true,
    },
    {
        name: 'seedingDistanceMin',
        label: 'Minimalni razmak sijanja/sadnje',
        description:
            'Najmanji podržani razmak između biljaka u centimetrima. Ako je prazno, minimalni razmak jednak je preporučenom; izbor gustoće isključen je samo kada su obje granice prazne.',
        order: '111',
        required: false,
    },
    {
        name: 'seedingDistanceMax',
        label: 'Maksimalni razmak sijanja/sadnje',
        description:
            'Najveći podržani razmak između biljaka u centimetrima. Ako je prazno, maksimalni razmak jednak je preporučenom; izbor gustoće isključen je samo kada su obje granice prazne.',
        order: '112',
        required: false,
    },
];

function definitionConfig(
    spec: AttributeSpec,
    existing?: SelectAttributeDefinition,
) {
    return {
        category: 'attributes',
        dataType: 'number',
        description: spec.description,
        display: existing?.display ?? true,
        entityTypeName: 'plant',
        label: spec.label,
        multiple: false,
        name: spec.name,
        order: existing?.order ?? spec.order,
        required:
            spec.name === 'seedingDistance'
                ? (existing?.required ?? spec.required)
                : false,
        unit: 'cm',
    };
}

function needsUpdate(
    existing: SelectAttributeDefinition,
    config: ReturnType<typeof definitionConfig>,
) {
    return (
        existing.category !== config.category ||
        existing.dataType !== config.dataType ||
        existing.description !== config.description ||
        existing.display !== config.display ||
        existing.entityTypeName !== config.entityTypeName ||
        existing.label !== config.label ||
        existing.multiple !== config.multiple ||
        existing.name !== config.name ||
        existing.order !== config.order ||
        existing.required !== config.required ||
        existing.unit !== config.unit
    );
}

async function run() {
    const apply = process.argv.includes('--apply');
    const existingDefinitions = await getAttributeDefinitions('plant');
    const existingByName = new Map<string, SelectAttributeDefinition>();
    for (const definition of existingDefinitions.filter(
        (item) => item.category === 'attributes',
    )) {
        if (existingByName.has(definition.name)) {
            throw new Error(
                `Multiple active plant attribute definitions found for attributes.${definition.name}.`,
            );
        }
        existingByName.set(definition.name, definition);
    }
    const changes: string[] = [];

    for (const spec of attributeSpecs) {
        const existing = existingByName.get(spec.name);
        const config = definitionConfig(spec, existing);

        if (!existing) {
            changes.push(`create attributes.${spec.name}`);
            if (apply) {
                await createAttributeDefinition(config);
            }
            continue;
        }

        if (!needsUpdate(existing, config)) {
            continue;
        }

        changes.push(`update attributes.${spec.name} (id ${existing.id})`);
        if (apply) {
            await updateAttributeDefinition({
                id: existing.id,
                ...config,
            });
        }
    }

    if (changes.length === 0) {
        console.info('Advanced sowing attribute definitions are up to date.');
        return;
    }

    console.info(`${apply ? 'Applied' : 'Planned'} changes:`);
    for (const change of changes) {
        console.info(`- ${change}`);
    }

    if (!apply) {
        console.info('Run again with --apply to persist these changes.');
        return;
    }

    const appliedDefinitions = await getAttributeDefinitions('plant');
    for (const spec of attributeSpecs) {
        const matches = appliedDefinitions.filter(
            (definition) =>
                definition.category === 'attributes' &&
                definition.name === spec.name,
        );
        if (matches.length !== 1) {
            throw new Error(
                `Expected exactly one active attributes.${spec.name} definition after apply; found ${matches.length.toString()}.`,
            );
        }
        const expected = definitionConfig(spec, matches[0]);
        if (needsUpdate(matches[0], expected)) {
            throw new Error(
                `Attribute definition attributes.${spec.name} failed readback verification.`,
            );
        }
    }
}

try {
    await run();
} finally {
    await closeStorage();
}
