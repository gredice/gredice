export function getCurrentGardenQueryPolicy({
    authenticatedGardenQueriesEnabled,
    isLocalSandbox,
    isMock,
}: {
    authenticatedGardenQueriesEnabled: boolean;
    isLocalSandbox: boolean;
    isMock: boolean;
}) {
    const accountGardenQueriesEnabled =
        authenticatedGardenQueriesEnabled && !isLocalSandbox && !isMock;

    return {
        accountGardenQueriesEnabled,
        currentGardenQueryEnabled:
            accountGardenQueriesEnabled || isLocalSandbox || isMock,
    };
}
