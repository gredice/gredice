export function resolveGardenStructureBuildModeEnabled({
    fixture = false,
    managedEnabled,
    serverEnabled,
}: {
    fixture?: boolean;
    managedEnabled: boolean;
    serverEnabled: boolean;
}) {
    return managedEnabled && (fixture || serverEnabled);
}
