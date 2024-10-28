export const KnownPages = {
    Dashboard: '/admin',
    Directories: '/admin/directories',
    DirectoryEntityType: (name: string) => `/admin/directories/${name}`,
    DirectoryEntityTypeAttributeDefinitions: (name: string) => `/admin/directories/${name}/attribute-definitions`,
    DirectoryEntityTypeAttributeDefinition: (name: string, id: number) => `/admin/directories/${name}/attribute-definitions/${id}`,
    DirectoryEntity: (entityType: string, entityId: number) => `/admin/directories/${entityType}/${entityId}`,
}