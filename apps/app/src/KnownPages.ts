export const KnownPages = {
    Dashboard: '/admin',
    Directories: '/admin/directories',
    DirectoryEntityType: (entityTypeName: string) => `/admin/directories/${entityTypeName}`,
    DirectoryEntityTypeAttributeDefinitions: (entityTypeName: string) => `/admin/directories/${entityTypeName}/attribute-definitions`,
    DirectoryEntityTypeAttributeDefinition: (entityTypeName: string, id: number) => `/admin/directories/${entityTypeName}/attribute-definitions/${id}`,
    DirectoryEntityTypeAttributeDefinitionCategory: (entityTypeName: string, id: number) => `/admin/directories/${entityTypeName}/attribute-definitions/categories/${id}`,
    DirectoryEntity: (entityTypeName: string, entityId: number) => `/admin/directories/${entityTypeName}/${entityId}`,
    Users: '/admin/users',
}