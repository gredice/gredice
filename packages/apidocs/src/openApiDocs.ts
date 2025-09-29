import { ExtendedAttributeDefinition, getAttributeDefinitions, getEntityTypes } from "@gredice/storage";
import { OpenAPIV3_1 } from "openapi-types";
import { unwrapSchema } from '@gredice/js/jsonSchema';

function resolveJsonPropertyData(schema: string) {
    const unwrapped = unwrapSchema(schema);

    function unwrapToOpenApiProperties(schemaObj: Record<string, string | Record<string, any>>): OpenAPIV3_1.SchemaObject {
        const properties: Record<string, OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject> = {};

        for (const [key, value] of Object.entries(schemaObj)) {
            if (typeof value === 'string') {
                // Map primitive types
                switch (value) {
                    case 'number':
                        properties[key] = { type: 'number' };
                        break;
                    case 'boolean':
                        properties[key] = { type: 'boolean' };
                        break;
                    case 'text':
                    case 'barcode':
                    case 'markdown':
                    case 'string':
                        properties[key] = { type: 'string' };
                        break;
                    default:
                        properties[key] = { type: 'string' }; // Default to string for unknown types
                }
            } else if (typeof value === 'object') {
                // Recursively process nested schemas
                const nestedSchema = unwrapToOpenApiProperties(value);
                properties[key] = {
                    type: 'object',
                    properties: nestedSchema.properties
                } as OpenAPIV3_1.SchemaObject;
            }
        }

        return {
            type: 'object',
            properties: properties as Record<string, OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject>
        };
    }

    return unwrapToOpenApiProperties(unwrapped);
}

function resolvePropertyDataType(attributeDefinition: ExtendedAttributeDefinition) {
    switch (attributeDefinition.dataType) {
        case 'number':
            return {
                type: 'number',
                description: attributeDefinition.description || undefined
            } satisfies OpenAPIV3_1.SchemaObject;
        case 'boolean':
            return {
                type: 'boolean',
                description: attributeDefinition.description || undefined
            } satisfies OpenAPIV3_1.SchemaObject;
        case 'image':
            return {
                $ref: '#/components/schemas/image',
                description: attributeDefinition.description || undefined
            } satisfies OpenAPIV3_1.ReferenceObject;
        default:
            return {
                type: 'string',
                description: attributeDefinition.description || undefined
            } satisfies OpenAPIV3_1.SchemaObject;
    }
}

async function resolvePropertyData(attributeDefinition: ExtendedAttributeDefinition) {
    if (attributeDefinition.dataType.startsWith('json|')) {
        const propertyData = resolveJsonPropertyData(attributeDefinition.dataType.substring(5));
        if (attributeDefinition.multiple) {
            return {
                type: 'array',
                items: propertyData
            } satisfies OpenAPIV3_1.SchemaObject;
        } else {
            return propertyData;
        }
    }

    if (attributeDefinition.dataType.startsWith('ref:')) {
        const refType = attributeDefinition.dataType.substring(4);
        const refAttributeDefinitions = await getAttributeDefinitions(refType);
        if (attributeDefinition.multiple) {
            return {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'number'
                        },
                        ...await populateAttributeDefinitionsProperties(refAttributeDefinitions)
                    },
                    description: attributeDefinition.description || undefined
                }
            } satisfies OpenAPIV3_1.SchemaObject;
        }
        return {
            type: 'object',
            properties: {
                id: {
                    type: 'number'
                },
                ...await populateAttributeDefinitionsProperties(refAttributeDefinitions)
            },
            description: attributeDefinition.description || undefined
        } satisfies OpenAPIV3_1.SchemaObject;
    }

    const propertyData = resolvePropertyDataType(attributeDefinition);
    if (attributeDefinition.multiple) {
        return {
            type: 'array',
            items: propertyData
        } satisfies OpenAPIV3_1.SchemaObject;
    }
    return propertyData;
}

async function populateAttributeDefinitionsProperties(attributeDefinitions: ExtendedAttributeDefinition[]) {
    const properties: OpenAPIV3_1.SchemaObject['properties'] = {};
    for (const attributeDefinition of attributeDefinitions) {
        const categoryObject = properties[attributeDefinition.category];
        const propertyData = await resolvePropertyData(attributeDefinition);
        if (categoryObject === undefined) {
            properties[attributeDefinition.category] = {
                type: 'object',
                properties: {
                    [attributeDefinition.name]: propertyData
                },
                required: attributeDefinition.required ? [attributeDefinition.name] : undefined
            };
        } else {
            const category = categoryObject as OpenAPIV3_1.SchemaObject;
            if (propertyData) {
                category.properties = {
                    ...category.properties,
                    [attributeDefinition.name]: propertyData
                };
                // Add required attribute
                if (attributeDefinition.required) {
                    if (category.required === undefined) {
                        category.required = [];
                    }
                    category.required.push(attributeDefinition.name);
                }
            }
        }
    }
    return properties;
}

async function openApiEntitiesDoc(entityType: Awaited<ReturnType<typeof getEntityTypes>>[0]): Promise<Required<Pick<OpenAPIV3_1.Document, 'paths' | 'components'>>> {
    let properties: OpenAPIV3_1.SchemaObject['properties'] = {
        id: {
            type: 'number'
        },
        entityType: {
            type: 'object',
            properties: {
                id: {
                    type: 'number',
                    default: entityType.id
                },
                name: {
                    type: 'string',
                    default: entityType.name
                },
                label: {
                    type: 'string',
                    default: entityType.label
                }
            },
            required: ['id', 'name', 'label']
        }
    };

    const attributeDefinitions = await getAttributeDefinitions(entityType.name);
    const attributeProperties = await populateAttributeDefinitionsProperties(attributeDefinitions);

    // Merge attribute properties into the main properties object
    properties = {
        ...properties,
        ...attributeProperties
    };

    // Append other properties
    properties = {
        ...properties,
        createdAt: {
            type: 'string',
            format: 'date-time'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time'
        }
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
                                            $ref: `#/components/schemas/entity-${entityType.name}`
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        components: {
            schemas: {
                [`entity-${entityType.name}`]: {
                    type: 'object',
                    properties,
                    required: ['id', 'entityType', 'createdAt', 'updatedAt', ...attributeDefinitions.map(attribute => `${attribute.category}`)]
                }
            }
        }
    }
}

export type OpenApiDocsConfig = Partial<Omit<OpenAPIV3_1.Document, 'openapi' | 'paths' | 'components'>>;

export async function openApiDocs(config?: OpenApiDocsConfig): Promise<OpenAPIV3_1.Document> {
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
                ...config?.info?.contact
            },
            termsOfService: 'https://www.gredice.com/legalno/uvjeti-koristenja',
            license: {
                name: 'AGPL-3.0',
                url: 'https://www.gredice.com/legalno/licenca',
                identifier: 'AGPL-3.0',
                ...config?.info?.license
            },
            ...config?.info
        },
        servers: config?.servers ?? [
            {
                url: 'https://api.gredice.com/api/directories',
                description: 'Production API'
            },
            {
                url: 'https://api.gredice.test/api/directories',
                description: 'Local API'
            }
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
                            format: 'uri'
                        }
                    },
                    required: ['url'],
                }
            }
        }
    }

    const entityTypes = await getEntityTypes();
    const typeDocs = await Promise.all(entityTypes.map(entityType => openApiEntitiesDoc(entityType)))
    for (const typeDoc of typeDocs) {
        if (baseDoc.paths) {
            Object.assign(baseDoc.paths, typeDoc.paths);
        }
        if (baseDoc.components?.schemas) {
            Object.assign(baseDoc.components.schemas, typeDoc.components.schemas);
        }
    }

    return baseDoc;
}
