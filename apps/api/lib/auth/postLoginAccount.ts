export function resolvePostLoginAccountId({
    accountIds,
    defaultGardenAccountId,
    selectedAccountId,
}: {
    accountIds: readonly string[];
    defaultGardenAccountId: string | undefined;
    selectedAccountId: string | undefined;
}) {
    if (selectedAccountId && accountIds.includes(selectedAccountId)) {
        return selectedAccountId;
    }

    if (defaultGardenAccountId && accountIds.includes(defaultGardenAccountId)) {
        return defaultGardenAccountId;
    }

    return accountIds[0];
}

export function resolveTemporaryUserIdToRetire({
    authenticatedUserId,
    currentTemporaryUserId,
}: {
    authenticatedUserId: string;
    currentTemporaryUserId: string | undefined;
}) {
    return currentTemporaryUserId &&
        currentTemporaryUserId !== authenticatedUserId
        ? currentTemporaryUserId
        : undefined;
}
