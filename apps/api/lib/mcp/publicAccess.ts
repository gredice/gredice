const truthyValues = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const legacyMcpPrefixes = [
    '/api/mcp/commerce',
    '/api/mcp/core',
    '/api/mcp/directories',
    '/api/mcp/gardens',
] as const;

export const mcpPublicAccessFlagName = 'GREDICE_MCP_PUBLIC_ENABLED';
export const mcpPublicDocumentationUrl = 'https://www.gredice.com/mcp';

export function parseMcpPublicAccessFlag(value: string | undefined) {
    const normalized = value?.trim().toLowerCase();
    return normalized ? truthyValues.has(normalized) : false;
}

export function isMcpPublicAccessEnabled() {
    return parseMcpPublicAccessFlag(process.env[mcpPublicAccessFlagName]);
}

export function isLegacyMcpPath(pathname: string) {
    return legacyMcpPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

export function canCallProtectedMcpToolWhilePublicAccessIsDisabled({
    authorization,
    exposure,
    method,
}: {
    authorization: string | null;
    exposure: string | undefined;
    method: string | undefined;
}) {
    if (
        method !== 'tools/call' ||
        !authorization?.toLowerCase().startsWith('bearer ')
    ) {
        return false;
    }

    return (
        exposure === 'auth-read' ||
        exposure === 'auth-mutation' ||
        exposure === 'admin-internal'
    );
}
