import { unwrapSchema } from '@gredice/js/jsonSchema';
import {
    type ExtendedAttributeDefinition,
    getAttributeDefinitions,
    getEntityTypes,
} from '@gredice/storage';
import type { OpenAPIV3_1 } from 'openapi-types';

export type DirectoryAttributeDefinition = Pick<
    ExtendedAttributeDefinition,
    | 'category'
    | 'dataType'
    | 'description'
    | 'entityTypeName'
    | 'multiple'
    | 'name'
    | 'required'
>;

type AttributeDefinitionLoader = (
    entityTypeName: string,
) => Promise<DirectoryAttributeDefinition[]>;

type AttributePropertiesResult = {
    properties: NonNullable<OpenAPIV3_1.SchemaObject['properties']>;
    requiredCategories: string[];
};

export class UnsupportedCmsAttributeDataTypeError extends Error {
    constructor(
        attributeDefinition: Pick<
            DirectoryAttributeDefinition,
            'category' | 'dataType' | 'entityTypeName' | 'name'
        >,
        detail?: string,
    ) {
        super(
            [
                `Unsupported CMS attribute data type "${attributeDefinition.dataType}"`,
                `for ${attributeDefinition.entityTypeName}.${attributeDefinition.category}.${attributeDefinition.name}.`,
                detail,
            ]
                .filter(Boolean)
                .join(' '),
        );
        this.name = 'UnsupportedCmsAttributeDataTypeError';
    }
}

function isRangeDataType(dataType: string) {
    return dataType === 'range' || dataType.startsWith('range|');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonScalarPropertyData(
    attributeDefinition: DirectoryAttributeDefinition,
    value: string,
    path: string,
): OpenAPIV3_1.SchemaObject {
    switch (value) {
        case 'number':
            return { type: 'number' };
        case 'boolean':
            return { type: 'boolean' };
        case 'text':
            return {
                type: 'string',
                description: 'Long text field',
            };
        case 'barcode':
            return {
                type: 'string',
                description: 'Barcode string',
            };
        case 'markdown':
            return {
                type: 'string',
                description: 'Markdown formatted text',
            };
        case 'string':
            return { type: 'string' };
        default:
            throw new UnsupportedCmsAttributeDataTypeError(
                attributeDefinition,
                `Unsupported JSON schema type "${value}" at "${path}".`,
            );
    }
}

function resolveJsonPropertyData(
    schema: string,
    attributeDefinition: DirectoryAttributeDefinition,
) {
    const unwrapped = unwrapSchema(schema);

    function unwrapToOpenApiProperties(
        schemaObj: Record<string, unknown>,
        path: string,
    ): OpenAPIV3_1.SchemaObject {
        const properties: Record<
            string,
            OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject
        > = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(schemaObj)) {
            required.push(key);
            const propertyPath = path ? `${path}.${key}` : key;
            if (typeof value === 'string') {
                properties[key] = jsonScalarPropertyData(
                    attributeDefinition,
                    value,
                    propertyPath,
                );
            } else if (isRecord(value)) {
                const nestedSchema = unwrapToOpenApiProperties(
                    value,
                    propertyPath,
                );
                properties[key] = {
                    type: 'object',
                    properties: nestedSchema.properties,
                    required: nestedSchema.required,
                };
            }
        }

        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
        };
    }

    return unwrapToOpenApiProperties(unwrapped, '');
}

function resolvePropertyDataType(
    attributeDefinition: DirectoryAttributeDefinition,
) {
    switch (attributeDefinition.dataType) {
        case 'text':
        case 'barcode':
        case 'markdown':
            return {
                type: 'string',
                description: attributeDefinition.description || undefined,
            } satisfies OpenAPIV3_1.SchemaObject;
        case 'number':
            return {
                type: 'number',
                description: attributeDefinition.description || undefined,
            } satisfies OpenAPIV3_1.SchemaObject;
        case 'boolean':
            return {
                type: 'boolean',
                description: attributeDefinition.description || undefined,
            } satisfies OpenAPIV3_1.SchemaObject;
        case 'image':
            return {
                $ref: '#/components/schemas/image',
                description: attributeDefinition.description || undefined,
            } satisfies OpenAPIV3_1.ReferenceObject;
        case 'json':
            return {
                description: attributeDefinition.description || undefined,
            } satisfies OpenAPIV3_1.SchemaObject;
        default:
            if (isRangeDataType(attributeDefinition.dataType)) {
                return {
                    type: 'object',
                    properties: {
                        min: {
                            type: 'number',
                        },
                        max: {
                            type: 'number',
                        },
                    },
                    required: ['min', 'max'],
                    description: attributeDefinition.description || undefined,
                } satisfies OpenAPIV3_1.SchemaObject;
            }
            return {
                unsupported: true,
            } satisfies { unsupported: true };
    }
}

async function resolvePropertyData(
    attributeDefinition: DirectoryAttributeDefinition,
    loadAttributeDefinitions: AttributeDefinitionLoader = getAttributeDefinitions,
) {
    if (attributeDefinition.dataType.startsWith('json|')) {
        const propertyData = resolveJsonPropertyData(
            attributeDefinition.dataType.substring(5),
            attributeDefinition,
        );
        propertyData.description =
            attributeDefinition.description || propertyData.description;
        if (attributeDefinition.multiple) {
            return {
                type: 'array',
                items: propertyData,
                description: attributeDefinition.description || undefined,
            } satisfies OpenAPIV3_1.SchemaObject;
        }
        return propertyData;
    }

    if (attributeDefinition.dataType.startsWith('ref:')) {
        const refType = attributeDefinition.dataType.substring(4);
        const refAttributeDefinitions = await loadAttributeDefinitions(refType);
        const {
            properties: refAttributeDefinitionsProperties,
            requiredCategories: refRequiredCategories,
        } = await buildAttributeDefinitionProperties(
            refAttributeDefinitions,
            loadAttributeDefinitions,
        );
        const refObject = {
            type: 'object',
            properties: {
                id: {
                    type: 'number',
                },
                ...refAttributeDefinitionsProperties,
            },
            required: ['id', ...refRequiredCategories],
            description: attributeDefinition.description || undefined,
        } satisfies OpenAPIV3_1.SchemaObject;

        if (attributeDefinition.multiple) {
            return {
                type: 'array',
                items: refObject,
                description: attributeDefinition.description || undefined,
            } satisfies OpenAPIV3_1.SchemaObject;
        }
        return refObject;
    }

    const propertyData = resolvePropertyDataType(attributeDefinition);
    if ('unsupported' in propertyData) {
        throw new UnsupportedCmsAttributeDataTypeError(attributeDefinition);
    }
    if (attributeDefinition.multiple) {
        return {
            type: 'array',
            items: propertyData,
            description: attributeDefinition.description || undefined,
        } satisfies OpenAPIV3_1.SchemaObject;
    }
    return propertyData;
}

export async function buildAttributeDefinitionProperties(
    attributeDefinitions: DirectoryAttributeDefinition[],
    loadAttributeDefinitions: AttributeDefinitionLoader = getAttributeDefinitions,
): Promise<AttributePropertiesResult> {
    const properties: NonNullable<OpenAPIV3_1.SchemaObject['properties']> = {};
    const requiredCategories = new Set<string>();

    for (const attributeDefinition of attributeDefinitions) {
        const categoryObject = properties[attributeDefinition.category];
        const propertyData = await resolvePropertyData(
            attributeDefinition,
            loadAttributeDefinitions,
        );
        if (attributeDefinition.required) {
            requiredCategories.add(attributeDefinition.category);
        }
        if (categoryObject === undefined) {
            properties[attributeDefinition.category] = {
                type: 'object',
                properties: {
                    [attributeDefinition.name]: propertyData,
                },
                required: attributeDefinition.required
                    ? [attributeDefinition.name]
                    : undefined,
            };
        } else {
            const category = categoryObject as OpenAPIV3_1.SchemaObject;
            category.properties = {
                ...category.properties,
                [attributeDefinition.name]: propertyData,
            };
            if (attributeDefinition.required) {
                category.required = [
                    ...new Set([
                        ...(category.required ?? []),
                        attributeDefinition.name,
                    ]),
                ];
            }
        }
    }

    return {
        properties,
        requiredCategories: Array.from(requiredCategories),
    };
}

async function openApiEntitiesDoc(
    entityType: Awaited<ReturnType<typeof getEntityTypes>>[0],
): Promise<Required<Pick<OpenAPIV3_1.Document, 'paths' | 'components'>>> {
    let properties: OpenAPIV3_1.SchemaObject['properties'] = {
        id: {
            type: 'number',
        },
        entityType: {
            type: 'object',
            properties: {
                id: {
                    type: 'number',
                    default: entityType.id,
                },
                name: {
                    type: 'string',
                    default: entityType.name,
                },
                label: {
                    type: 'string',
                    default: entityType.label,
                },
            },
            required: ['id', 'name', 'label'],
        },
        slug: {
            type: 'string',
        },
    };

    const attributeDefinitions = await getAttributeDefinitions(entityType.name);
    const { properties: attributeProperties, requiredCategories } =
        await buildAttributeDefinitionProperties(attributeDefinitions);

    properties = {
        ...properties,
        ...attributeProperties,
    };

    properties = {
        ...properties,
        createdAt: {
            type: 'string',
            format: 'date-time',
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
        },
    };

    return {
        paths: {
            [`/entities/${entityType.name}`]: {
                get: {
                    summary: `/entities/${entityType.name}`,
                    description: `Get all entities of type ${entityType.name}.`,
                    responses: {
                        200: {
                            description: 'Successful response',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: {
                                            $ref: `#/components/schemas/entity-${entityType.name}`,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        components: {
            schemas: {
                [`entity-${entityType.name}`]: {
                    type: 'object',
                    properties,
                    required: [
                        'id',
                        'entityType',
                        'slug',
                        'createdAt',
                        'updatedAt',
                        ...requiredCategories,
                    ],
                },
            },
        },
    };
}

export type OpenApiDocsConfig = Partial<
    Omit<OpenAPIV3_1.Document, 'openapi' | 'paths' | 'components'>
>;

export async function openApiDocs(
    config?: OpenApiDocsConfig,
): Promise<OpenAPIV3_1.Document> {
    const baseDoc: OpenAPIV3_1.Document = {
        openapi: '3.1.0',
        info: {
            title: 'Gredice CMS API',
            version: '0.1.0',
            description: 'API documentation for Gredice CMS',
            contact: {
                name: 'Gredice',
                url: 'http://gredice.com',
                email: 'kontakt@gredice.com',
                ...config?.info?.contact,
            },
            termsOfService: 'https://www.gredice.com/legalno/uvjeti-koristenja',
            license: {
                name: 'AGPL-3.0',
                url: 'https://www.gredice.com/legalno/licenca',
                identifier: 'AGPL-3.0',
                ...config?.info?.license,
            },
            ...config?.info,
        },
        servers: config?.servers ?? [
            {
                url: 'https://api.gredice.com/api/directories',
                description: 'Production API',
            },
            {
                url: 'https://api.gredice.test/api/directories',
                description: 'Local API',
            },
        ],
        security: [],
        paths: {},
        components: {
            schemas: {
                image: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            format: 'uri',
                        },
                    },
                    required: ['url'],
                },
            },
        },
    };

    const paths = baseDoc.paths ?? {};
    baseDoc.paths = paths;

    paths['/pages'] = {
        get: {
            summary: '/pages',
            description: 'Get published CMS pages.',
            responses: {
                200: {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: {
                                    $ref: '#/components/schemas/page-summary',
                                },
                            },
                        },
                    },
                },
            },
        },
    };

    paths['/search'] = {
        get: {
            summary: '/search',
            description: 'Search published directory entities.',
            parameters: [
                {
                    name: 'q',
                    in: 'query',
                    required: true,
                    schema: { type: 'string', minLength: 2, maxLength: 200 },
                },
                {
                    name: 'category',
                    in: 'query',
                    required: false,
                    schema: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } },
                        ],
                    },
                },
                {
                    name: 'entityType',
                    in: 'query',
                    required: false,
                    schema: {
                        oneOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } },
                        ],
                    },
                },
                {
                    name: 'limit',
                    in: 'query',
                    required: false,
                    schema: { type: 'integer', minimum: 1, maximum: 50 },
                },
                {
                    name: 'offset',
                    in: 'query',
                    required: false,
                    schema: { type: 'integer', minimum: 0, maximum: 500 },
                },
            ],
            responses: {
                200: {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/directory-search-response',
                            },
                        },
                    },
                },
            },
        },
    };

    paths['/pages/{slug}'] = {
        get: {
            summary: '/pages/{slug}',
            description: 'Get a published CMS page by slug/path.',
            parameters: [
                {
                    name: 'slug',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                },
            ],
            responses: {
                200: {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/page-detail',
                            },
                        },
                    },
                },
                404: {
                    description: 'Page not found',
                },
            },
        },
    };

    if (baseDoc.components?.schemas) {
        baseDoc.components.schemas['section-data'] = {
            type: 'object',
            additionalProperties: true,
            required: ['component'],
            properties: {
                component: {
                    type: 'string',
                },
            },
        };
        baseDoc.components.schemas['page-summary'] = {
            type: 'object',
            required: ['slug', 'title', 'state', 'updatedAt'],
            properties: {
                slug: { type: 'string' },
                title: { type: 'string' },
                state: { type: 'string', enum: ['published'] },
                publishedAt: { type: ['string', 'null'], format: 'date-time' },
                metaTitle: { type: ['string', 'null'] },
                metaDescription: { type: ['string', 'null'] },
                metaImageUrl: { type: ['string', 'null'] },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        };
        baseDoc.components.schemas['page-detail'] = {
            allOf: [
                { $ref: '#/components/schemas/page-summary' },
                {
                    type: 'object',
                    required: ['content'],
                    properties: {
                        content: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/section-data',
                            },
                        },
                    },
                },
            ],
        };
        baseDoc.components.schemas['directory-search-result'] = {
            type: 'object',
            required: [
                'entityId',
                'entityType',
                'category',
                'categoryLabel',
                'title',
                'href',
                'rank',
                'publishedAt',
                'updatedAt',
            ],
            properties: {
                entityId: { type: 'number' },
                entityType: { type: 'string' },
                category: { type: 'string' },
                categoryLabel: { type: 'string' },
                title: { type: 'string' },
                summary: { type: ['string', 'null'] },
                imageUrl: { type: ['string', 'null'] },
                imageAlt: { type: ['string', 'null'] },
                visualKey: { type: ['string', 'null'] },
                href: { type: 'string', format: 'uri' },
                rank: { type: 'number' },
                publishedAt: { type: ['string', 'null'], format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        };
        baseDoc.components.schemas['directory-search-response'] = {
            type: 'object',
            required: ['query', 'limit', 'offset', 'count', 'results'],
            properties: {
                query: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' },
                count: { type: 'number' },
                results: {
                    type: 'array',
                    items: {
                        $ref: '#/components/schemas/directory-search-result',
                    },
                },
            },
        };
    }

    const entityTypes = await getEntityTypes();
    const typeDocs = await Promise.all(
        entityTypes.map((entityType) => openApiEntitiesDoc(entityType)),
    );
    for (const typeDoc of typeDocs) {
        if (baseDoc.paths) {
            Object.assign(baseDoc.paths, typeDoc.paths);
        }
        if (baseDoc.components?.schemas) {
            Object.assign(
                baseDoc.components.schemas,
                typeDoc.components.schemas,
            );
        }
    }

    return baseDoc;
}
