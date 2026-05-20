export function resolveMcpAccountId(
    selectedAccountId: string | undefined,
    accountIds: string[],
) {
    if (selectedAccountId) {
        return accountIds.includes(selectedAccountId)
            ? selectedAccountId
            : null;
    }
    return accountIds[0] ?? null;
}
