export type BlockPlaceOperationIdentity = {
    operationId?: string;
};

/**
 * Mutates the React Query variables object once so an automatic network retry
 * reuses the same durable server command identity. A new explicit placement
 * receives a new variables object and therefore a new operation ID.
 */
export function ensureBlockPlaceOperationId(
    variables: BlockPlaceOperationIdentity,
    createId: () => string = () => globalThis.crypto.randomUUID(),
) {
    variables.operationId ??= createId();
    return variables.operationId;
}
