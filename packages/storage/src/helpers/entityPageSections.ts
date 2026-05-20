export type EntitySectionData = {
    component: string;
    header?: string;
    description?: string;
};

export type EntitySectionTransformInput = {
    id: number | string;
    entityType?: {
        name?: string;
        label?: string;
    };
    [key: string]: unknown;
};

type SectionTemplate = {
    requiredFields: string[];
    buildSection: (entity: EntitySectionTransformInput) => EntitySectionData;
};

type EntityAttributeValue = {
    value?: unknown;
    attributeDefinition: Record<string, unknown>;
};

const sectionTemplatesByEntityType: Record<string, SectionTemplate[]> = {
    operation: [
        {
            requiredFields: ['information.label'],
            buildSection: (entity) => ({
                component: 'PageHeader',
                header: entityTitle(entity),
                description:
                    firstText(
                        getValue(entity, 'information.shortDescription'),
                        getValue(entity, 'information.description'),
                    ) ?? undefined,
            }),
        },
        {
            requiredFields: ['information.description'],
            buildSection: (entity) => ({
                component: 'Heading1',
                header: 'Opis',
                description:
                    firstText(getValue(entity, 'information.description')) ??
                    undefined,
            }),
        },
    ],
};

export function transformEntityToSectionData(
    entity: EntitySectionTransformInput,
): EntitySectionData[] {
    const entityTypeName = entity.entityType?.name;
    if (!entityTypeName) {
        throw new Error(
            'Entity is missing entityType.name required for transformation.',
        );
    }

    const templates = sectionTemplatesByEntityType[entityTypeName];
    if (!templates) {
        return buildGenericEntitySections(entity);
    }

    return templates.map((template) => {
        const missingField = template.requiredFields.find(
            (field) => !hasValidValue(getValue(entity, field)),
        );
        if (missingField) {
            throw new Error(
                `Entity ${entityTypeName}#${entity.id} is missing required field: ${missingField}.`,
            );
        }

        return template.buildSection(entity);
    });
}

function getValue(entity: EntitySectionTransformInput, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = entity;

    for (let index = 0; index < parts.length; index++) {
        const key = parts[index];
        if (!isRecord(current)) {
            return undefined;
        }

        if (key in current) {
            current = current[key];
            continue;
        }

        if (index < parts.length - 1) {
            const attributeValue = getAttributePathValue(
                current.attributes,
                key,
                parts[index + 1],
            );
            if (typeof attributeValue !== 'undefined') {
                return attributeValue;
            }
        }

        return undefined;
    }

    return current;
}

function buildGenericEntitySections(
    entity: EntitySectionTransformInput,
): EntitySectionData[] {
    const details = genericDetailDescription(entity);
    const sections: EntitySectionData[] = [
        {
            component: 'PageHeader',
            header: entityTitle(entity),
            description:
                firstText(
                    getValue(entity, 'information.description'),
                    getValue(entity, 'information.shortDescription'),
                    getValue(entity, 'attributes.notes'),
                ) ?? entity.entityType?.label,
        },
    ];

    if (details) {
        sections.push({
            component: 'Heading1',
            header: 'Detalji',
            description: details,
        });
    }

    return sections;
}

function entityTitle(entity: EntitySectionTransformInput): string {
    const entityTypeLabel = firstText(entity.entityType?.label) ?? 'Zapis';

    return (
        firstText(
            getValue(entity, 'information.label'),
            getValue(entity, 'information.name'),
            getValue(entity, 'label'),
            getValue(entity, 'name'),
        ) ?? `${entityTypeLabel} ${entity.id}`
    );
}

function hasValidValue(value: unknown): boolean {
    if (value === null || typeof value === 'undefined') {
        return false;
    }

    if (typeof value === 'string') {
        return value.trim().length > 0;
    }

    return true;
}

function firstText(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value !== 'string') {
            continue;
        }

        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    return null;
}

function genericDetailDescription(
    entity: EntitySectionTransformInput,
): string | null {
    const entries = [
        ...collectAttributePreviewFields(entity),
        ...collectPreviewFields(entity)
            .filter(([path]) => !isExcludedGenericDetailPath(entity, path))
            .map(([path, value]): [string, string] => [
                formatFieldLabel(path),
                value,
            ]),
    ].slice(0, 10);

    if (entries.length === 0) {
        return null;
    }

    return entries.map(([label, value]) => `${label}: ${value}`).join(' · ');
}

function collectAttributePreviewFields(
    entity: EntitySectionTransformInput,
): Array<[string, string]> {
    return getEntityAttributes(entity)
        .filter((attribute) => !isPrimaryInformationAttribute(attribute))
        .flatMap((attribute): Array<[string, string]> => {
            const formattedValue = formatPreviewValue(attribute.value);
            if (!formattedValue) {
                return [];
            }

            return [[formatAttributeLabel(attribute), formattedValue]];
        });
}

function getAttributePathValue(
    attributes: unknown,
    category: string,
    name: string,
): unknown {
    const attribute = getEntityAttributes({ id: '', attributes }).find(
        (entry) =>
            stringValue(entry.attributeDefinition.category) === category &&
            stringValue(entry.attributeDefinition.name) === name,
    );

    return attribute?.value;
}

function getEntityAttributes(
    entity: Pick<EntitySectionTransformInput, 'id'> & {
        attributes?: unknown;
    },
): EntityAttributeValue[] {
    if (!Array.isArray(entity.attributes)) {
        return [];
    }

    return entity.attributes.filter(isAttributeValue);
}

function isAttributeValue(value: unknown): value is EntityAttributeValue {
    return isRecord(value) && isRecord(value.attributeDefinition);
}

function isPrimaryInformationAttribute(attribute: EntityAttributeValue) {
    const category = stringValue(attribute.attributeDefinition.category);
    const name = stringValue(attribute.attributeDefinition.name);

    return (
        category === 'information' &&
        (name === 'label' ||
            name === 'name' ||
            name === 'description' ||
            name === 'shortDescription')
    );
}

function formatAttributeLabel(attribute: EntityAttributeValue): string {
    return (
        stringValue(attribute.attributeDefinition.label) ??
        formatFieldLabel(
            [
                stringValue(attribute.attributeDefinition.category),
                stringValue(attribute.attributeDefinition.name),
            ]
                .filter((part) => typeof part === 'string')
                .join('.'),
        )
    );
}

function stringValue(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function collectPreviewFields(
    value: unknown,
    path: string[] = [],
): Array<[string, string]> {
    const formattedValue = formatPreviewValue(value);
    if (formattedValue) {
        return [[path.join('.'), formattedValue]];
    }

    if (!isRecord(value)) {
        return [];
    }

    return Object.entries(value).flatMap(([key, entryValue]) =>
        collectPreviewFields(entryValue, [...path, key]),
    );
}

function formatPreviewValue(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    if (typeof value === 'boolean') {
        return value ? 'Da' : 'Ne';
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return null;
}

function formatFieldLabel(path: string): string {
    const labelPath = path
        .split('.')
        .filter((part) => !hiddenGenericDetailPathParts.has(part))
        .join(' ');

    return labelPath
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isExcludedGenericDetailPath(
    entity: EntitySectionTransformInput,
    path: string,
) {
    if (excludedGenericDetailPaths.has(path)) {
        return true;
    }

    if (
        Array.isArray(entity.attributes) &&
        (path === 'attributes' || path.startsWith('attributes.'))
    ) {
        return true;
    }

    return path.startsWith('entityType.attributeDefinitions.');
}

const hiddenGenericDetailPathParts = new Set([
    'attributes',
    'image',
    'images',
    'information',
]);

const excludedGenericDetailPaths = new Set([
    '',
    'id',
    'createdAt',
    'updatedAt',
    'slug',
    'entityType.id',
    'entityType.name',
    'entityType.label',
    'information.label',
    'information.name',
    'information.description',
    'information.shortDescription',
]);
