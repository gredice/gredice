export function resolvePostLoginAccountId({
    accountIds,
    attachedTemporaryAccountIds,
    defaultGardenAccountId,
}: {
    accountIds: readonly string[];
    attachedTemporaryAccountIds: readonly string[] | undefined;
    defaultGardenAccountId: string | undefined;
}) {
    if (!attachedTemporaryAccountIds?.length) {
        return undefined;
    }

    const attachedAccountIds = new Set(attachedTemporaryAccountIds);
    const existingAccountIds = accountIds.filter(
        (accountId) => !attachedAccountIds.has(accountId),
    );

    if (
        defaultGardenAccountId &&
        existingAccountIds.includes(defaultGardenAccountId)
    ) {
        return defaultGardenAccountId;
    }

    return existingAccountIds[0] ?? attachedTemporaryAccountIds[0];
}
