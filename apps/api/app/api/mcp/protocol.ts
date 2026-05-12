import type { NextRequest } from 'next/server';

export const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
    '2025-06-18',
    '2024-11-05',
] as const;

export function negotiateMcpProtocolVersion(request: NextRequest): string {
    const requested = request.headers.get('MCP-Protocol-Version');
    if (
        requested &&
        SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(
            requested as (typeof SUPPORTED_MCP_PROTOCOL_VERSIONS)[number],
        )
    ) {
        return requested;
    }

    return SUPPORTED_MCP_PROTOCOL_VERSIONS[0];
}
