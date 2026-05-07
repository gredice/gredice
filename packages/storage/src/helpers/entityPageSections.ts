export type EntitySectionData = {
    component: string;
    data: Record<string, unknown>;
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
    component: string;
    requiredFields: string[];
    buildData: (entity: EntitySectionTransformInput) => Record<string, unknown>;
};

const sectionTemplatesByEntityType: Record<string, SectionTemplate[]> = {
    operation: [
        {
            component: 'header',
            requiredFields: ['information.label'],
            buildData: (entity) => ({
                title: getValue(entity, 'information.label'),
                subtitle: getValue(entity, 'information.shortDescription'),
                image: getValue(entity, 'image.cover.url'),
            }),
        },
        {
            component: 'richtext',
            requiredFields: ['information.description'],
            buildData: (entity) => ({
                content: getValue(entity, 'information.description'),
            }),
        },
    ],
};

export function transformEntityToSectionData(
    entity: EntitySectionTransformInput,
): EntitySectionData[] {
    const entityTypeName = entity.entityType?.name;
    if (!entityTypeName) {
        throw new Error('Entity is missing entityType.name required for transformation.');
    }

    const templates = sectionTemplatesByEntityType[entityTypeName];
    if (!templates) {
        throw new Error(`Unsupported entity type for page transformation: ${entityTypeName}.`);
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

        return {
            component: template.component,
            data: template.buildData(entity),
        };
    });
}

function getValue(entity: EntitySectionTransformInput, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
        if (!current || typeof current !== 'object') {
            return undefined;
        }

        return readObjectProperty(current, key);
    }, entity);
}

function readObjectProperty(value: object, key: string): unknown {
    const property = Object.entries(value).find(([entryKey]) => entryKey === key);
    return property?.[1];
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
