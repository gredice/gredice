import { getEntityTypes } from '@gredice/storage';

type McpExposure =
    | 'public-read'
    | 'auth-read'
    | 'auth-mutation'
    | 'admin-internal'
    | 'excluded';

export type { McpExposure };

type JsonSchemaObject = {
    type: 'object';
    properties: Record<string, { type: string }>;
};

type McpToolCatalogEntry = {
    name: string;
    description: string;
    domain: 'directories' | 'gardens' | 'commerce';
    exposure: McpExposure;
    inputSchema: JsonSchemaObject;
};

type McpResourceCatalogEntry =
    | {
          name: string;
          description: string;
          exposure: McpExposure;
          mimeType: string;
          uri: string;
      }
    | {
          name: string;
          description: string;
          exposure: McpExposure;
          mimeType: string;
          uriTemplate: string;
      };

export type { McpResourceCatalogEntry, McpToolCatalogEntry };

const TOOL_CATALOG: readonly McpToolCatalogEntry[] = [
    {
        name: 'directories/get-plants',
        description:
            'Get Croatian plant catalog with attributes and calendar data.',
        domain: 'directories',
        exposure: 'public-read',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number' },
                offset: { type: 'number' },
                category: { type: 'string' },
            },
        },
    },
    {
        name: 'directories/get-plant',
        description: 'Get one plant by name and optional sorts.',
        domain: 'directories',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                plantName: { type: 'string' },
                includeSorts: { type: 'boolean' },
            },
        },
    },
    {
        name: 'directories/get-plant-sorts',
        description:
            'List plant sorts with optional plant filter and pagination.',
        domain: 'directories',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                plant_type: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
        },
    },
    {
        name: 'directories/search-entities',
        description:
            'Search directory entities by free text and optional type filters.',
        domain: 'directories',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                entityTypes: { type: 'array' },
                limit: { type: 'number' },
            },
        },
    },
    {
        name: 'directories/get-operations',
        description: 'List gardening operations with optional category filter.',
        domain: 'directories',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
        },
    },
    {
        name: 'directories/get-seeds',
        description: 'List seeds with optional plant and variety filters.',
        domain: 'directories',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                plant_type: { type: 'string' },
                variety: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
        },
    },
    {
        name: 'gardens/list-gardens',
        description: 'List gardens for the authenticated account.',
        domain: 'gardens',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
        },
    },
    {
        name: 'gardens/list-raised-beds',
        description: 'List raised beds for an authenticated account garden.',
        domain: 'gardens',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                gardenId: { type: 'number' },
            },
        },
    },
    {
        name: 'gardens/get-raised-bed-fields',
        description: 'Get field and plant lifecycle state for one raised bed.',
        domain: 'gardens',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                gardenId: { type: 'number' },
                raisedBedId: { type: 'number' },
            },
        },
    },
    {
        name: 'gardens/list-operations',
        description: 'List scheduled and completed operations for a garden.',
        domain: 'gardens',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                gardenId: { type: 'number' },
                raisedBedId: { type: 'number' },
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
        },
    },
    {
        name: 'gardens/get-lifecycle-context',
        description: 'Summarize active plant lifecycle state for a garden.',
        domain: 'gardens',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                gardenId: { type: 'number' },
            },
        },
    },
    {
        name: 'gardens/get-raised-bed-ai-history',
        description: 'Get previous AI suggestions saved for a raised bed.',
        domain: 'gardens',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                gardenId: { type: 'number' },
                raisedBedId: { type: 'number' },
                limit: { type: 'number' },
            },
        },
    },
    {
        name: 'commerce/get-products',
        description: 'List plant-sort products available for cart actions.',
        domain: 'commerce',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
        },
    },
    {
        name: 'commerce/search-products',
        description: 'Search plant-sort products available for cart actions.',
        domain: 'commerce',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
        },
    },
    {
        name: 'commerce/get-product',
        description: 'Get one plant-sort product by product id.',
        domain: 'commerce',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                productId: { type: 'string' },
            },
        },
    },
    {
        name: 'commerce/get-cart',
        description: 'Get the authenticated account shopping cart.',
        domain: 'commerce',
        exposure: 'auth-read',
        inputSchema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
            },
        },
    },
    {
        name: 'commerce/add-to-cart',
        description: 'Add a product to the authenticated account cart.',
        domain: 'commerce',
        exposure: 'auth-mutation',
        inputSchema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
                productId: { type: 'string' },
                quantity: { type: 'number' },
                gardenId: { type: 'number' },
                raisedBedId: { type: 'number' },
                positionIndex: { type: 'number' },
                scheduledDate: { type: 'string' },
            },
        },
    },
    {
        name: 'commerce/update-cart-item',
        description: 'Update or remove an authenticated account cart item.',
        domain: 'commerce',
        exposure: 'auth-mutation',
        inputSchema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
                cartItemId: { type: 'number' },
                quantity: { type: 'number' },
            },
        },
    },
] as const;

const RESOURCE_CATALOG: readonly McpResourceCatalogEntry[] = [
    {
        uri: 'gredice://directories/entity-types',
        name: 'Directory entity types',
        description: 'List of available directory entity type names.',
        exposure: 'public-read',
        mimeType: 'application/json',
    },
    {
        uriTemplate: 'gredice://directories/entity-types/{entityTypeName}',
        name: 'Directory entity schema',
        description:
            'Dynamic schema resource for a single directory entity type from API metadata.',
        exposure: 'public-read',
        mimeType: 'application/json',
    },
];

export function getMcpToolCatalog() {
    return TOOL_CATALOG.filter((tool) => tool.exposure !== 'excluded');
}

export function getMcpToolCatalogEntry(name: string) {
    return getMcpToolCatalog().find((tool) => tool.name === name) ?? null;
}

export function getMcpTools() {
    return getMcpToolCatalog().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
    }));
}

export function getMcpToolNamesByDomain(domain: McpToolCatalogEntry['domain']) {
    return getMcpToolCatalog()
        .filter((tool) => tool.domain === domain)
        .map((tool) => tool.name);
}

export function getMcpResourceCatalog() {
    return RESOURCE_CATALOG;
}

export async function getMcpResources() {
    const entityTypes = await getEntityTypes();
    return getMcpResourceCatalog()
        .filter((resource) => 'uri' in resource)
        .map((resource) => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
            value: entityTypes,
        }));
}

export function getMcpResourceTemplates() {
    return getMcpResourceCatalog()
        .filter((resource) => 'uriTemplate' in resource)
        .map((resource) => ({
            uriTemplate: resource.uriTemplate,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
        }));
}
