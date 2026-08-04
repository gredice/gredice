# MCP Server Contract

Gredice exposes one supported Streamable HTTP endpoint:

```text
https://api.gredice.com/api/mcp
```

The endpoint is public by default and has no runtime enablement or rollout-stage
flag. Access control is defined per tool in
[`apps/api/app/api/mcp/catalog.ts`](../apps/api/app/api/mcp/catalog.ts).

## Routes

| Route | Purpose |
| --- | --- |
| `/api/mcp` | MCP discovery and JSON-RPC requests. |
| `/.well-known/oauth-protected-resource/api/mcp` | OAuth protected-resource metadata for authenticated tools. |
| `/test` | Developer documentation and JSON-RPC test console. |

The former domain-specific handlers below were retired and removed:

- `/api/mcp/core`
- `/api/mcp/directories`
- `/api/mcp/gardens`
- `/api/mcp/commerce`
- `/api/mcp/.well-known/oauth-protected-resource`

Clients must use `/api/mcp`; the canonical protected-resource metadata route is
the root `/.well-known/oauth-protected-resource/api/mcp` path.

## Access boundary

Public reads expose only data already published through the Gredice API:

- directory plants, plant details, sorts, search results, operations, and seeds;
- published plant-sort product listings, search results, and product details;
- directory entity-type resource metadata.

User and account data remains protected:

- garden, raised-bed, field, operation, lifecycle, and saved AI history reads
  require `mcp:read`;
- cart reads require `mcp:read`;
- cart additions and updates require `mcp:write`;
- internal administrative tools, if added, require `mcp:admin`.

Protected calls validate the standard Gredice API bearer token, derive the user
and selected account from that identity, and verify account ownership before
executing. MCP inputs do not expose user or account identifiers.

## Protocol and safety controls

- JSON-RPC 2.0 over Streamable HTTP.
- Protocol versions `2025-03-26` and `2024-11-05`.
- Methods `initialize`, `notifications/initialized`, `tools/list`, `tools/call`,
  `resources/list`, `resources/templates/list`, and `prompts/list`.
- Maximum request body of 256 KiB.
- Tool timeout of 8 seconds.
- Per-runtime rate limits; shared production rate limiting remains a publication
  prerequisite.
- Optional comma-separated `MCP_ALLOWED_ORIGINS` allowlist.

The complete tool table, local validation commands, and example request are in
[`apps/api/MCP_README.md`](../apps/api/MCP_README.md). Marketplace release gates
are tracked in
[`docs/plugin-marketplaces.md`](./plugin-marketplaces.md).
