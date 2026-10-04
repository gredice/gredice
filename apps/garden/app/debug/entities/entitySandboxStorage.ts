export const entityGridSandboxStorageKey = 'gredice.debug.entities.sandbox.v1';

export function getEntitySandboxStorageKey(entityName: string) {
    return `gredice.debug.entity.${encodeURIComponent(entityName)}.sandbox.v1`;
}
