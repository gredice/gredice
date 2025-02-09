import { getAttributeDefinitions, getEntityTypes } from "@gredice/storage";
import { OpenAPIV3_1 } from "openapi-types";

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
    for (const attributeDefinition of attributeDefinitions) {
        const attributeType = attributeDefinition.dataType === 'json' ? 'object' : attributeDefinition.dataType;
        const categoryObject = properties[attributeDefinition.category];
        if (categoryObject === undefined) {
            properties[attributeDefinition.category] = {
                type: 'object',
                properties: {
                    [attributeDefinition.name]: {
                        type: attributeType === 'number' ? 'number' : attributeType === 'boolean' ? 'boolean' : 'string',
                        description: attributeDefinition.description || undefined
                    }
                },
                required: attributeDefinition.required ? [attributeDefinition.name] : undefined
            };
        } else {
            const category = categoryObject as OpenAPIV3_1.SchemaObject;
            category.properties = {
                ...category.properties,
                [attributeDefinition.name]: {
                    type: attributeType === 'number' ? 'number' : attributeType === 'boolean' ? 'boolean' : 'string',
                    description: attributeDefinition.description || undefined
                }
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
                                            $ref: `#/components/schemas/Entity-${entityType.name}`
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
                [`Entity-${entityType.name}`]: {
                    type: 'object',
                    properties,
                    required: ['id', 'entityType', 'createdAt', 'updatedAt', ...attributeDefinitions.map(attribute => `${attribute.category}`)]
                }
            }
        }
    }
};

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
            }
        ],
        security: [],
        paths: {},
        components: {
            schemas: {}
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
