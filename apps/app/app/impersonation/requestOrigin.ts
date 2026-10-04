export function requestOrigin(
    host: string | null,
    forwardedProtocol: string | null,
) {
    if (!host) {
        return undefined;
    }

    const protocol =
        forwardedProtocol?.split(',')[0]?.trim().toLowerCase() ||
        (host.startsWith('localhost') ? 'http' : 'https');
    return `${protocol}://${host}`;
}
