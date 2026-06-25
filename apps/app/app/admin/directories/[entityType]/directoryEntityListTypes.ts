export type DirectoryEntityListSortDirection = 'asc' | 'desc';
export type DirectoryEntityListSortKey =
    | 'name'
    | 'inventory'
    | 'updatedAt'
    | `attribute:${number}`;

export type DirectoryEntityListSort = {
    key: DirectoryEntityListSortKey;
    direction: DirectoryEntityListSortDirection;
};

export type DirectoryAttributeDefinition = {
    id: number;
    category: string;
    name: string;
    label: string;
    entityTypeName: string;
    dataType: string;
    defaultValue: string | null;
    unit: string | null;
    required: boolean;
    display: boolean;
};

export type DirectoryEntityAttribute = {
    attributeDefinitionId: number;
    value: string | null;
    attributeDefinition: DirectoryAttributeDefinition;
};

export type DirectoryEntityListEntity = {
    id: number;
    entityTypeName: string;
    state: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
    entityType: {
        name: string;
        label: string;
    };
    attributes: DirectoryEntityAttribute[];
};

export type DirectoryEntityInventoryItem = {
    entityId: number | null;
    quantity: number;
    lowCountThreshold: number | null;
};

export type DirectoryEntityListPage = {
    entities: DirectoryEntityListEntity[];
    inventoryItems: DirectoryEntityInventoryItem[];
    hasMore: boolean;
    nextOffset: number | null;
    pageSize: number;
    totalCount: number;
};

export type DirectoryEntityFilterOption = {
    value: string;
    label: string;
};
